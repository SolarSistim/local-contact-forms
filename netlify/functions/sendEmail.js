// netlify/functions/sendEmail.js
require("dotenv").config();
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

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, code: "BAD_JSON", error: "Invalid JSON body" }),
    };
  }

  const { to, subject, message, cc } = payload;

  if (!to || !subject || !message) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        code: "MISSING_FIELDS",
        error: "to, subject, and message are required",
      }),
    };
  }

  try {
    const transporter = getGmailTransport();

    const info = await transporter.sendMail({
      from: `"Local Contact Forms" <${process.env.GMAIL_USER}>`,
      to,
      cc: cc || undefined,
      subject,
      text: message,
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        messageId: info.messageId,
      }),
    };
  } catch (error) {
    console.error("Email send error:", error);

    // best-effort admin alert
    try {
      if (process.env.ADMIN_EMAIL) {
        const transporter = getGmailTransport();
        await transporter.sendMail({
          from: `"Local Contact Forms" <${process.env.GMAIL_USER}>`,
          to: process.env.ADMIN_EMAIL,
          subject: "LCF Error: sendEmail failed",
          text: `sendEmail failed with:\n${error.message}`,
        });
      }
    } catch (alertErr) {
      console.error("Failed to send admin alert from sendEmail:", alertErr.message);
    }

    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        code: error.code || "EMAIL_SEND_FAILED",
        error: error.message,
      }),
    };
  }
};
