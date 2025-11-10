// netlify/functions/getTenantConfig.js
require("dotenv").config();
const { google } = require("googleapis");

async function getSheetsClient() {
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error("Google credentials not set");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

/**
 * Figure out which tab to read in the master sheet.
 * Priority:
 * 1. process.env.MASTER_SHEET_TAB
 * 2. a sheet literally named "tenants_master_sheet"
 * 3. the first sheet in the spreadsheet
 */
async function getMasterTabName(sheets, masterSheetId) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: masterSheetId,
  });

  const sheetsMeta = meta.data.sheets || [];

  // 1) env override
  if (process.env.MASTER_SHEET_TAB) {
    return process.env.MASTER_SHEET_TAB;
  }

  // 2) look for one actually named tenants_master_sheet
  const explicit = sheetsMeta.find(
    (s) => s.properties && s.properties.title === "tenants_master_sheet"
  );
  if (explicit) {
    return "tenants_master_sheet";
  }

  // 3) fallback to first sheet
  if (sheetsMeta.length > 0) {
    return sheetsMeta[0].properties.title;
  }

  throw new Error("Master sheet has no tabs");
}

/**
 * Read the master sheet and find the row matching tenantId.
 * Expected columns (header row):
 *  tenant_id | tenant_name | config_sheet_id | status
 */
async function getTenantRowFromMaster(sheets, tenantId) {
  const masterSheetId = process.env.MASTER_SHEET_ID;
  if (!masterSheetId) {
    throw new Error("MASTER_SHEET_ID not set");
  }

  const tabName = await getMasterTabName(sheets, masterSheetId);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: masterSheetId,
    range: `${tabName}!A:D`,
  });

  const rows = res.data.values || [];
  if (!rows.length) {
    throw new Error("Master sheet has no rows");
  }

  const header = rows[0];
  const tenantIdIdx = header.indexOf("tenant_id");
  const configSheetIdIdx = header.indexOf("config_sheet_id");
  const statusIdx = header.indexOf("status");

  if (tenantIdIdx === -1 || configSheetIdIdx === -1) {
    throw new Error(
      `Master sheet missing tenant_id or config_sheet_id columns in tab "${tabName}"`
    );
  }

  const match = rows.find((r, i) => {
    if (i === 0) return false;
    return (r[tenantIdIdx] || "").trim() === tenantId;
  });

  if (!match) {
    throw new Error(`Tenant ${tenantId} not found in master sheet`);
  }

  return {
    tenantId: match[tenantIdIdx],
    configSheetId: match[configSheetIdIdx],
    status: statusIdx !== -1 ? match[statusIdx] : "unknown",
  };
}

/**
 * Tenant sheet is already key/value in A:B
 */
async function getTenantConfigFromSheet(sheets, tenantConfigSheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: tenantConfigSheetId,
    range: "A:B",
  });

  const rows = res.data.values || [];
  const config = {};

  for (const row of rows) {
    const key = (row[0] || "").trim();
    const val = row[1] || "";
    if (key) {
      config[key] = val;
    }
  }

  return config;
}

exports.handler = async (event) => {

    console.log("ENV SEEN BY FUNCTION:", {
        GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
        GOOGLE_PRIVATE_KEY_PRESENT: !!process.env.GOOGLE_PRIVATE_KEY,
        MASTER_SHEET_ID: process.env.MASTER_SHEET_ID,
    });

  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: "Method not allowed" }),
    };
  }

  let tenantId =
    (event.queryStringParameters && event.queryStringParameters.tenantId) || null;

  if (!tenantId && event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      tenantId = body.tenantId;
    } catch (e) {}
  }

  if (!tenantId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, error: "tenantId is required" }),
    };
  }

  try {
    const sheets = await getSheetsClient();

    const masterInfo = await getTenantRowFromMaster(sheets, tenantId);

    const tenantConfig = await getTenantConfigFromSheet(
      sheets,
      masterInfo.configSheetId
    );

    const combined = {
      tenantId: masterInfo.tenantId,
      status: masterInfo.status,
      ...tenantConfig,
    };

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, config: combined }),
    };
  } catch (err) {
    console.error("getTenantConfig error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
