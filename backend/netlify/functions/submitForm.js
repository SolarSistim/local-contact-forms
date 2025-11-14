// netlify/functions/submitForm.js
require("dotenv").config();
const { google } = require("googleapis");

// Proper nodemailer import for Netlify functions
let nodemailer;
try {
  nodemailer = require("nodemailer");
  // If nodemailer is wrapped, unwrap it
  if (nodemailer.default) {
    nodemailer = nodemailer.default;
  }
} catch (err) {
  console.error("Failed to load nodemailer:", err);
}

// Dynamic import for node-fetch (supports both CommonJS and ESM)
let fetch;
(async () => {
  if (!fetch) {
    const fetchModule = await import('node-fetch');
    fetch = fetchModule.default;
  }
})();

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://localcontactforms.com',
  'https://www.localcontactforms.com',
  'https://local-contact-forms.netlify.app',
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

/**
 * Verify reCAPTCHA token with Google
 */
async function verifyRecaptcha(token, remoteip) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  if (!secretKey) {
    console.error("RECAPTCHA_SECRET_KEY environment variable is not set");
    throw new Error("RECAPTCHA_SECRET_KEY not configured");
  }

  console.log("Verifying reCAPTCHA token...");

  const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
  
  const params = new URLSearchParams({
    secret: secretKey,
    response: token,
  });

  if (remoteip) {
    params.append('remoteip', remoteip);
  }

  try {
    // Ensure fetch is loaded
    if (!fetch) {
      const fetchModule = await import('node-fetch');
      fetch = fetchModule.default;
    }

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    if (!response.ok) {
      console.error(`reCAPTCHA API returned status: ${response.status}`);
      throw new Error(`reCAPTCHA verification request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log("reCAPTCHA verification result:", { success: data.success, errorCodes: data['error-codes'] });
    return data;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    throw new Error(`Failed to verify reCAPTCHA: ${error.message}`);
  }
}

function validateSubmission(body, ip, userAgent) {
  // HONEYPOT CHECK - If any honeypot field is filled, it's a bot
  // Check multiple possible honeypot field names
  const honeypotFields = ['website', 'honeypot', 'url', 'homepage'];
  
  for (const field of honeypotFields) {
    if (body[field] !== undefined && body[field] !== null) {
      const value = String(body[field]).trim();
      if (value !== '') {
        // LOG BOT ATTEMPT WITH FULL DETAILS
        console.warn('═══════════════════════════════════════════════════════');
        console.warn('🚨 BOT DETECTED - HONEYPOT TRIGGERED 🚨');
        console.warn('═══════════════════════════════════════════════════════');
        console.warn('Timestamp:', new Date().toISOString());
        console.warn('Detection Method: Honeypot Field');
        console.warn('Honeypot Field:', field);
        console.warn('Honeypot Value:', value.substring(0, 100)); // First 100 chars
        console.warn('-----------------------------------------------------------');
        console.warn('Submitted Data:');
        console.warn('  First Name:', body.firstName || '[empty]');
        console.warn('  Last Name:', body.lastName || '[empty]');
        console.warn('  Email:', body.email || '[empty]');
        console.warn('  Phone:', body.phone || '[empty]');
        console.warn('  Reason:', body.reason || '[empty]');
        console.warn('  Message:', (body.notes || '[empty]').substring(0, 100));
        console.warn('-----------------------------------------------------------');
        console.warn('Request Info:');
        console.warn('  IP Address:', ip);
        console.warn('  User Agent:', userAgent);
        console.warn('═══════════════════════════════════════════════════════');
        
        return {
          valid: false,
          error: 'Invalid submission',
          code: 'HONEYPOT_TRIGGERED',
          isBot: true
        };
      }
    }
  }

  // Check for reCAPTCHA token
  if (!body.recaptchaToken) {
    return {
      valid: false,
      error: 'reCAPTCHA token is required',
      code: 'RECAPTCHA_MISSING'
    };
  }

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
      error: `Required fields missing: ${missing.join(', ')}`,
      code: 'VALIDATION_FAILED'
    };
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return { 
      valid: false, 
      error: "Invalid email format",
      code: 'VALIDATION_FAILED'
    };
  }

  // Phone validation - matches frontend exactly
  const cleanedPhone = body.phone.replace(/[\s\-()]/g, '');
  
  // Check if it contains only digits
  if (!/^\d+$/.test(cleanedPhone)) {
    return { 
      valid: false, 
      error: "Phone number must contain only digits",
      code: 'VALIDATION_FAILED'
    };
  }

  // Must be exactly 10 digits
  if (cleanedPhone.length !== 10) {
    return { 
      valid: false, 
      error: "Phone number must be exactly 10 digits",
      code: 'VALIDATION_FAILED'
    };
  }

  // Validate against allowed formats
  const phonePattern = /^(\d{10}|\(\d{3}\)\s?\d{3}-\d{4}|\d{3}[-\s]?\d{3}[-\s]?\d{4})$/;
  if (!phonePattern.test(body.phone)) {
    return { 
      valid: false, 
      error: "Invalid phone number format",
      code: 'VALIDATION_FAILED'
    };
  }
  
  // Length checks to prevent abuse
  if (body.firstName && body.firstName.length > 100) {
    return { valid: false, error: "First name too long", code: 'VALIDATION_FAILED' };
  }
  
  if (body.lastName && body.lastName.length > 100) {
    return { valid: false, error: "Last name too long", code: 'VALIDATION_FAILED' };
  }
  
  if (body.notes && body.notes.length > 5000) {
    return { valid: false, error: "Message too long (max 5000 characters)", code: 'VALIDATION_FAILED' };
  }
  
  if (body.phone && body.phone.length > 20) {
    return { valid: false, error: "Phone number too long", code: 'VALIDATION_FAILED' };
  }
  
  if (body.reason && body.reason.length > 200) {
    return { valid: false, error: "Reason too long", code: 'VALIDATION_FAILED' };
  }
  
  // Validate submissionsSheetId format (Google Sheet IDs are alphanumeric)
  if (body.submissionsSheetId && !/^[a-zA-Z0-9_-]{40,}$/.test(body.submissionsSheetId)) {
    return { valid: false, error: "Invalid sheet ID format", code: 'VALIDATION_FAILED' };
  }
  
  // Validate notifyTo email if provided
  if (body.notifyTo && !emailRegex.test(body.notifyTo)) {
    return { valid: false, error: "Invalid notification email format", code: 'VALIDATION_FAILED' };
  }
  
  return { valid: true };
}

function getGmailTransport() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD;

  console.log("Email config check:", {
    gmailUserSet: !!gmailUser,
    gmailPassSet: !!gmailPass,
    gmailUser: gmailUser ? gmailUser.substring(0, 3) + '***' : 'NOT SET',
    nodemailerAvailable: !!nodemailer,
    nodemailerType: typeof nodemailer,
    hasCreateTransporter: !!(nodemailer && nodemailer.createTransport)
  });

  if (!gmailUser || !gmailPass) {
    const err = new Error("Gmail credentials not set (GMAIL_USER + GMAIL_PASS or GMAIL_APP_PASSWORD).");
    err.code = "EMAIL_CONFIG_MISSING";
    throw err;
  }

  if (!nodemailer || !nodemailer.createTransport) {
    const err = new Error("Nodemailer not properly loaded");
    err.code = "NODEMAILER_MISSING";
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
    console.log("Sending admin notification to:", adminTo);
    await transporter.sendMail({
      from: `"Local Contact Forms" <${process.env.GMAIL_USER}>`,
      to: adminTo,
      subject,
      text: message,
    });
    console.log("Admin notification sent successfully");
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
      body: JSON.stringify({ 
        success: false, 
        code: "METHOD_NOT_ALLOWED", 
        error: "Method not allowed" 
      }),
    };
  }

  // Rate limiting by IP
  const ip = event.headers['x-forwarded-for'] || event.headers['x-nf-client-connection-ip'] || context.ip;
  const userAgent = event.headers['user-agent'] || 'Unknown';
  
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
      body: JSON.stringify({ 
        success: false, 
        code: "BAD_JSON", 
        error: "Invalid JSON body" 
      }),
    };
  }

  // Check if honeypot fields exist in submission
  const honeypotPresent = !!(body.website || body.honeypot || body.url || body.homepage);

  console.log("Form submission received:", {
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    notifyTo: body.notifyTo,
    hasRecaptchaToken: !!body.recaptchaToken,
    honeypotPresent: honeypotPresent,
    ip: ip,
    userAgent: userAgent.substring(0, 100)
  });

  // Validate submission data (includes honeypot check)
  const validation = validateSubmission(body, ip, userAgent);
  if (!validation.valid) {
    console.error("Validation failed:", validation.error);
    
    // If honeypot was triggered, pretend it succeeded (don't let bot know)
    if (validation.isBot) {
      console.log("🤖 Returning fake success response to bot");
      console.log("Action taken: BOT BLOCKED - No data saved, no email sent");
      console.log("═══════════════════════════════════════════════════════");
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true, 
          sheet: true,
          email: true
        }),
      };
    }
    
    // For other validation errors, return the actual error
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: false, 
        code: validation.code || "VALIDATION_FAILED", 
        error: validation.error 
      }),
    };
  }

  // Verify reCAPTCHA token
  try {
    const recaptchaResult = await verifyRecaptcha(body.recaptchaToken, ip);
    
    if (!recaptchaResult.success) {
      console.warn('reCAPTCHA verification failed:', recaptchaResult['error-codes']);
      
      const errorCodes = recaptchaResult['error-codes'] || [];
      let errorMessage = 'reCAPTCHA verification failed';
      
      if (errorCodes.includes('timeout-or-duplicate')) {
        errorMessage = 'reCAPTCHA token has expired or been used. Please try again.';
      } else if (errorCodes.includes('invalid-input-response')) {
        errorMessage = 'Invalid reCAPTCHA token. Please refresh and try again.';
      }
      
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: false, 
          code: "RECAPTCHA_FAILED", 
          error: errorMessage
        }),
      };
    }

    console.log('✅ reCAPTCHA verified successfully for IP:', ip);

  } catch (recaptchaError) {
    console.error('reCAPTCHA verification error:', recaptchaError);
    
    await notifyAdminOnError(
      "LCF Error: reCAPTCHA Verification Failed",
      `reCAPTCHA verification encountered an error:\n${recaptchaError.message}\n\nIP: ${ip}`
    );
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: false, 
        code: "RECAPTCHA_ERROR", 
        error: "Unable to verify reCAPTCHA. Please try again later." 
      }),
    };
  }

  // Check for Google credentials
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error("Google credentials missing");
    await notifyAdminOnError(
      "LCF Error: Missing Google creds",
      "submitForm was called but GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY is missing."
    );
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: false, 
        code: "CONFIG_MISSING", 
        error: "Server not configured" 
      }),
    };
  }

  // Use submissionsSheetId from body (preferred), fallback to TEST_SHEET_ID (legacy)
  const submissionsSheetId = body.submissionsSheetId || process.env.TEST_SHEET_ID;

  if (!submissionsSheetId) {
    console.error("Submissions sheet ID missing");
    await notifyAdminOnError(
      "LCF Error: Missing sheet ID",
      "submitForm was called but submissionsSheetId and TEST_SHEET_ID are not set."
    );
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: false, 
        code: "SHEET_NOT_CONFIGURED", 
        error: "Sheet not configured" 
      }),
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

    console.log("Attempting to write to Google Sheet:", submissionsSheetId);

    try {
      // try insert row then update approach
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
      console.log("✅ Successfully wrote to Google Sheet");
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
      console.log("✅ Successfully appended to Google Sheet");
    }

    // Send notification email
    console.log("Attempting to send notification email...");
    try {
      const transporter = getGmailTransport();
      
      const emailTo = body.notifyTo || process.env.GMAIL_USER;
      console.log("Sending notification email to:", emailTo);

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

      const mailOptions = {
        from: `"Local Contact Forms" <${process.env.GMAIL_USER}>`,
        to: emailTo,
        subject: `New contact form submission from ${body.firstName || ""} ${body.lastName || ""}`,
        html: htmlContent,
        text: `New submission from ${body.firstName || ""} ${body.lastName || ""}\n\nFirst Name: ${body.firstName || ""}\nLast Name: ${body.lastName || ""}\nEmail: ${body.email || ""}\nPhone: ${body.phone || ""}\nReason: ${body.reason || ""}\nMessage: ${body.notes || ""}`,
      };

      console.log("Email options:", {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });

      const emailResult = await transporter.sendMail(mailOptions);
      emailOk = true;
      console.log("✅ Notification email sent successfully:", emailResult.messageId);
    } catch (emailErr) {
      emailOk = false;
      console.error("Notification email failed:", emailErr);
      console.error("Email error details:", {
        message: emailErr.message,
        code: emailErr.code,
        command: emailErr.command
      });
      
      // Don't try to send admin notification if email is broken
      console.error("Skipping admin notification due to email configuration issue");
    }

    console.log("✅ Form submission completed successfully:", { sheetOk, emailOk });

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
    console.error("Error stack:", err.stack);

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