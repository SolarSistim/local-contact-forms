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

  if (!process.env.TEST_SHEET_ID) {
    await notifyAdminOnError(
      "LCF Error: Missing sheet ID",
      "submitForm was called but TEST_SHEET_ID is not set."
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

    const spreadsheetId = process.env.TEST_SHEET_ID;
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
      await transporter.sendMail({
        from: `"Local Contact Forms" <${process.env.GMAIL_USER}>`,
        to: body.notifyTo || process.env.GMAIL_USER,
        subject: "New contact form submission",
        text: `New submission from ${body.firstName || ""} ${body.lastName || ""}`,
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
