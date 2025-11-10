// netlify/functions/getTenantConfig.js
require("dotenv").config();
const { google } = require("googleapis");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // or set to your domain later
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function normalizeTenantId(id) {
  return (id || "").trim().replace(/_/g, "-");
}

async function getSheetsClient() {
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    const err = new Error("Google credentials not set");
    err.code = "CONFIG_MISSING";
    throw err;
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

async function getMasterTabName(sheets, masterSheetId) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: masterSheetId,
  });

  const sheetsMeta = meta.data.sheets || [];

  if (process.env.MASTER_SHEET_TAB) {
    return process.env.MASTER_SHEET_TAB;
  }

  const explicit = sheetsMeta.find(
    (s) => s.properties && s.properties.title === "tenants_master_sheet"
  );
  if (explicit) {
    return "tenants_master_sheet";
  }

  if (sheetsMeta.length > 0) {
    return sheetsMeta[0].properties.title;
  }

  const err = new Error("Master sheet has no tabs");
  err.code = "MASTER_EMPTY";
  throw err;
}

async function getTenantRowFromMaster(sheets, tenantIdRaw) {
  const masterSheetId = process.env.MASTER_SHEET_ID;
  if (!masterSheetId) {
    const err = new Error("MASTER_SHEET_ID not set");
    err.code = "CONFIG_MISSING";
    throw err;
  }

  const tabName = await getMasterTabName(sheets, masterSheetId);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: masterSheetId,
    range: `${tabName}!A:D`,
  });

  const rows = res.data.values || [];
  if (!rows.length) {
    const err = new Error("Master sheet has no rows");
    err.code = "MASTER_EMPTY";
    throw err;
  }

  const tenantId = normalizeTenantId(tenantIdRaw);

  const header = rows[0];
  const tenantIdIdx = header.indexOf("tenant_id");
  const configSheetIdIdx = header.indexOf("config_sheet_id");
  const statusIdx = header.indexOf("status");

  if (tenantIdIdx === -1 || configSheetIdIdx === -1) {
    const err = new Error(
      `Master sheet missing tenant_id or config_sheet_id columns in tab "${tabName}"`
    );
    err.code = "MASTER_BAD_COLUMNS";
    throw err;
  }

  const match = rows.find((r, i) => {
    if (i === 0) return false;
    const sheetTenantId = normalizeTenantId(r[tenantIdIdx] || "");
    return sheetTenantId === tenantId;
  });

  if (!match) {
    const err = new Error(`Tenant ${tenantIdRaw} not found in master sheet`);
    err.code = "TENANT_NOT_FOUND";
    throw err;
  }

  return {
    tenantId: match[tenantIdIdx],
    configSheetId: match[configSheetIdIdx],
    status: statusIdx !== -1 ? match[statusIdx] : "unknown",
  };
}

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
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: "OK",
    };
  }

  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, code: "METHOD_NOT_ALLOWED", error: "Method not allowed" }),
    };
  }

  let tenantId =
    (event.queryStringParameters && event.queryStringParameters.tenantId) || null;

  if (!tenantId && event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      tenantId = body.tenantId;
    } catch (e) {
      // bad JSON
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, code: "BAD_JSON", error: "Invalid JSON body" }),
      };
    }
  }

  if (!tenantId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, code: "MISSING_TENANT", error: "tenantId is required" }),
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
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, config: combined }),
    };
  } catch (err) {
    console.error("getTenantConfig error:", err.message);

    // 404 for missing tenant, 500 for everything else
    const isNotFound = err.code === "TENANT_NOT_FOUND";
    return {
      statusCode: isNotFound ? 404 : 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        code: err.code || "SERVER_ERROR",
        error: err.message,
      }),
    };
  }
};
