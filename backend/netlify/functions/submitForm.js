// netlify/functions/submitForm.js
require("dotenv").config();
const { google } = require("googleapis");
const nodemailer = require("nodemailer");

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://localcontactforms.com',
  'https://www.localcontactforms.com',
  'http://localhost:8888',
  'http://localhost:4200'
];

// Helper function to get CORS headers based on request origin
function getCorsHeaders(requestOrigin) {
  const origin = ALLOWED_ORIGINS.includes(requestOrigin) 
    ? requestOrigin 
    : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

// Simple in-memory rate limiting
const submitRateLimits = new Map();

function checkSubmitRateLimit(ip) {
  const now = Date.now();
  const record = submitRateLimits.get(ip) || { count: 0, resetTime: now + 3600000 }; // 1 hour
  
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + 3600000;
  } else {
    record.count++;
  }
  
  submitRateLimits.set(ip, record);
  return record.count <= 10; // 10 submissions per IP per hour
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of submitRateLimits.entries()) {
    if (now > record.resetTime) {
      submitRateLimits.delete(ip);
    }
  }
}, 3600000); // Clean up every hour

function validateSubmission(body) {
  // Required fields - match frontend requirements
  if (!body.firstName || !body.lastName || !body.email || !body.phone || !body.reason) {
    const missing = [];
    if (!body.firstName) missing.push('firstName');
    if (!body.lastName) missing.push('lastName');
    if (!body.email) missing.push('email');
    if (!body.phone) missing.push('phone');
    if (!body.reason) missing.push('reason');
    
    return { 
      valid: false, 
      error: `Required fields missing: ${missing.join(', ')}` 
    };
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return { valid: false, error: "Invalid email format" };
  }

  // Phone validation - matches frontend exactly
  const cleanedPhone = body.phone.replace(/[\s\-()]/g, '');
  
  // Check if it contains only digits
  if (!/^\d+$/.test(cleanedPhone)) {
    return { valid: false, error: "Phone number must contain only digits" };
  }

  // Must be exactly 10 digits
  if (cleanedPhone.length !== 10) {
    return { valid: false, error: "Phone number must be exactly 10 digits" };
  }

  // Validate against allowed formats:
  // 8504802892, (850) 480-2892, 850-480-2892, 850 480-2892, 850 4802892
  const phonePattern = /^(\d{10}|\(\d{3}\)\s?\d{3}-\d{4}|\d{3}[-\s]?\d{3}[-\s]?\d{4})$/;
  if (!phonePattern.test(body.phone)) {
    return { valid: false, error: "Invalid phone number format" };
  }
  
  // Length checks to prevent abuse
  if (body.firstName && body.firstName.length > 100) {
    return { valid: false, error: "First name too long" };
  }
  
  if (body.lastName && body.lastName.length > 100) {
    return { valid: false, error: "Last name too long" };
  }
  
  if (body.notes && body.notes.length > 5000) {
    return { valid: false, error: "Message too long (max 5000 characters)" };
  }
  
  if (body.phone && body.phone.length > 20) {
    return { valid: false, error: "Phone number too long" };
  }
  
  if (body.reason && body.reason.length > 200) {
    return { valid: false, error: "Reason too long" };
  }
  
  // Validate submissionsSheetId format (Google Sheet IDs are alphanumeric)
  if (body.submissionsSheetId && !/^[a-zA-Z0-9_-]{40,}$/.test(body.submissionsSheetId)) {
    return { valid: false, error: "Invalid sheet ID format" };
  }
  
  // Validate notifyTo email if provided
  if (body.notifyTo && !emailRegex.test(body.notifyTo)) {
    return { valid: false, error: "Invalid notification email format" };
  }
  
  return { valid: true };
}

function getGmailTransport() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    const err = new Error("Gmail credentials not set (GMAIL_USER + GMAIL_PASS or GMAIL_APP_PASSWORD).");
    err.code = "EMAIL_CONFIG_MISSING";
    throw err;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

async function notifyAdminOnError(subject, message) {
  try {
    const transporter = getGmailTransport();
    const adminTo = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
    await transporter.sendMail({
      from: `"Local Contact Forms" <${process.env.GMAIL_USER}>`,
      to: adminTo,
      subject,
      text: message,
    });
  } catch (err) {
    console.error("Failed to send admin alert:", err.message);
  }
}

exports.handler = async (event, context) => {
  const corsHeaders = getCorsHeaders(event.headers.origin);

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "OK",
    };
  }

  if (event.httpMethod && event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, code: "METHOD_NOT_ALLOWED", error: "Method not allowed" }),
    };
  }

  // Rate limiting by IP
  const ip = event.headers['x-forwarded-for'] || context.ip;
  if (!checkSubmitRateLimit(ip)) {
    console.warn(`Rate limit exceeded for IP: ${ip}`);
    return {
      statusCode: 429,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: false, 
        code: "RATE_LIMIT_EXCEEDED", 
        error: "Too many submissions. Please try again later." 
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, code: "BAD_JSON", error: "Invalid JSON body" }),
    };
  }

  // Validate submission data
  const validation = validateSubmission(body);
  if (!validation.valid) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: false, 
        code: "VALIDATION_FAILED", 
        error: validation.error 
      }),
    };
  }

  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    await notifyAdminOnError(
      "LCF Error: Missing Google creds",
      "submitForm was called but GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY is missing."
    );
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, code: "CONFIG_MISSING", error: "Server not configured" }),
    };
  }

  // Use submissionsSheetId from body (preferred), fallback to TEST_SHEET_ID (legacy)
  const submissionsSheetId = body.submissionsSheetId || process.env.TEST_SHEET_ID;

  if (!submissionsSheetId) {
    await notifyAdminOnError(
      "LCF Error: Missing sheet ID",
      "submitForm was called but submissionsSheetId and TEST_SHEET_ID are not set."
    );
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, code: "SHEET_NOT_CONFIGURED", error: "Sheet not configured" }),
    };
  }

  let sheetOk = false;
  let emailOk = false;

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const row = [
      new Date().toISOString(),
      body.firstName || "",
      body.lastName || "",
      body.email || "",
      body.phone || "",
      body.reason || "",
      body.notes || "",
    ];

    const spreadsheetId = submissionsSheetId;
    const sheetName = "submissions";

    try {
      // try your original "insert row then update" approach
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: null,
                  dimension: "ROWS",
                  startIndex: 1,
                  endIndex: 2,
                },
                inheritFromBefore: false,
              },
            },
          ],
        },
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A2`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [row],
        },
      });

      sheetOk = true;
    } catch (insertErr) {
      console.error("Row insert failed, trying append:", insertErr.message);
      // fallback to simple append at end
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [row],
        },
      });
      sheetOk = true;
    }

    // notification email
    try {
      const transporter = getGmailTransport();
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .header h2 { margin: 0 0 10px 0; color: #2c3e50; }
            .header p { margin: 0; color: #7f8c8d; }
            .field { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #ecf0f1; }
            .field:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #2c3e50; margin-bottom: 5px; }
            .value { color: #555; word-break: break-word; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; text-align: center; color: #95a5a6; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Contact Form Submission</h2>
              <p>You have received a new message from your contact form.</p>
            </div>

            <div>
              <div class="field">
                <div class="label">First Name</div>
                <div class="value">${escapeHtml(body.firstName || "")}</div>
              </div>

              <div class="field">
                <div class="label">Last Name</div>
                <div class="value">${escapeHtml(body.lastName || "")}</div>
              </div>

              <div class="field">
                <div class="label">Email</div>
                <div class="value"><a href="mailto:${escapeHtml(body.email || "")}">${escapeHtml(body.email || "")}</a></div>
              </div>

              <div class="field">
                <div class="label">Phone</div>
                <div class="value"><a href="tel:${escapeHtml(body.phone || "")}">${escapeHtml(body.phone || "")}</a></div>
              </div>

              <div class="field">
                <div class="label">Reason for Contact</div>
                <div class="value">${escapeHtml(body.reason || "")}</div>
              </div>

              <div class="field">
                <div class="label">Message</div>
                <div class="value">${escapeHtml(body.notes || "").replace(/\n/g, "<br>")}</div>
              </div>
            </div>

            <div class="footer">
              <p>This email was sent by Local Contact Forms</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: `"Local Contact Forms" <${process.env.GMAIL_USER}>`,
        to: body.notifyTo || process.env.GMAIL_USER,
        subject: `New contact form submission from ${body.firstName || ""} ${body.lastName || ""}`,
        html: htmlContent,
        text: `New submission from ${body.firstName || ""} ${body.lastName || ""}\n\nFirst Name: ${body.firstName || ""}\nLast Name: ${body.lastName || ""}\nEmail: ${body.email || ""}\nPhone: ${body.phone || ""}\nReason: ${body.reason || ""}\nMessage: ${body.notes || ""}`,
      });
      emailOk = true;
    } catch (emailErr) {
      emailOk = false;
      console.error("Notification email failed:", emailErr.message);
      await notifyAdminOnError(
        "LCF Warning: Notification email failed",
        `Submit succeeded but notification email failed.\nError: ${emailErr.message}`
      );
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        sheet: sheetOk,
        email: emailOk,
      }),
    };
  } catch (err) {
    console.error("submitForm fatal error:", err);

    await notifyAdminOnError(
      "LCF Error: submitForm failed",
      `submitForm failed with error:\n${err.message}`
    );

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        code: "SERVER_ERROR",
        error: err.message,
      }),
    };
  }
};