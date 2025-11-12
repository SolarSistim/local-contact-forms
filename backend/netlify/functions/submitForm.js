// netlify/functions/submitForm.js
require("dotenv").config();
const { google } = require("googleapis");
const nodemailer = require("nodemailer");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: "OK",
    };
  }

  if (event.httpMethod && event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, code: "METHOD_NOT_ALLOWED", error: "Method not allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, code: "BAD_JSON", error: "Invalid JSON body" }),
    };
  }

  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    await notifyAdminOnError(
      "LCF Error: Missing Google creds",
      "submitForm was called but GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY is missing."
    );
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
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
      headers: CORS_HEADERS,
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
      headers: CORS_HEADERS,
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
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        code: "SERVER_ERROR",
        error: err.message,
      }),
    };
  }
};
