// netlify/functions/sendEmail.js
require("dotenv").config();
const nodemailer = require("nodemailer");

function getGmailTransport() {
  const gmailUser = process.env.GMAIL_USER;
  // allow either name in .env
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

exports.handler = async (event) => {
  // only allow POST
  if (event.httpMethod && event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: "Method not allowed" }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, error: "Invalid JSON body" }),
    };
  }

  const { to, subject, message, cc } = payload;

  if (!to || !subject || !message) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
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
      body: JSON.stringify({
        success: true,
        messageId: info.messageId,
      }),
    };
  } catch (error) {
    console.error("Email send error:", error);

    // try to notify admin, but don't throw
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
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
