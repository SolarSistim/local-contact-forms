// netlify/functions/submitForm.js
require("dotenv").config();
const { google } = require("googleapis");
const nodemailer = require("nodemailer");

function getGmailTransport() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    throw new Error("Gmail credentials not set (GMAIL_USER + GMAIL_PASS or GMAIL_APP_PASSWORD).");
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
  if (event.httpMethod && event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: "Method not allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, error: "Invalid JSON body" }),
    };
  }

  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    await notifyAdminOnError(
      "LCF Error: Missing Google creds",
      "submitForm was called but GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY is missing."
    );
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "Server not configured" }),
    };
  }

  if (!process.env.TEST_SHEET_ID) {
    await notifyAdminOnError(
      "LCF Error: Missing sheet ID",
      "submitForm was called but TEST_SHEET_ID is not set."
    );
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "Sheet not configured" }),
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

    // build row
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

    // 1) insert a new row at index 1 (i.e. row 2, assuming row 1 is headers)
    // if you have NO header row and want to insert at very top, change startIndex/endIndex to 0
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId: null, // null works if we address by sheet name below
                dimension: "ROWS",
                startIndex: 1, // insert at row 2
                endIndex: 2,
              },
              inheritFromBefore: false,
            },
          },
        ],
      },
    });

    // 2) write the values into the newly inserted row (row 2)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A2`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [row],
      },
    });

    sheetOk = true;

    // send notification email (same as before)
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
      body: JSON.stringify({
        success: false,
        error: err.message,
      }),
    };
  }
};
