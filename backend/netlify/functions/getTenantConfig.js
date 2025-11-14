// netlify/functions/getTenantConfig.js
require("dotenv").config();
const { google } = require("googleapis");

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
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  };
}

// Fields that are safe to return to the public
const PUBLIC_FIELDS = [
  'business_name',
  'intro_text',
  'meta_description',
  'meta_keywords',
  'post_submit_message',
  'business_phone',
  'business_address_1',
  'business_address_2',
  'business_city',
  'business_state',
  'business_zip',
  'business_web_url',
  'theme',
  'logo',
  'reason_for_contact',
  'facebook_url',
  'instagram_url',
  'linkedin_url',
  'pinterest_url',
  'reddit_url',
  'tiktok_url',
  'wechat_url',
  'x_url',
  'youtube_url',
  'submissionsSheetId', // Needed by submitForm
  'notify_on_submit',   // Needed by submitForm for email notifications
  'rate_limit_per_hour', // Needed by submitForm for rate limiting
  'tenantId',
  'status'
];

const REQUIRED_FIELDS = [
  "business_name",
  "notify_on_submit",
  "intro_text",
  "meta_description",
  "meta_keywords",
  "post_submit_message",
  "business_phone",
  "business_address_1",
  "business_city",
  "business_state",
  "business_zip",
  "theme",
];

const ALLOWED_THEMES = ["Fern", "Lilac", "Lemoncello", "Sapphire", "Crimson", "Light", "Dark"];

function validateTenantConfig(config = {}) {
  const missing = [];

  for (const field of REQUIRED_FIELDS) {
    const raw = config[field];
    const val = typeof raw === "string" ? raw.trim() : raw;
    if (!val) {
      missing.push(field);
    }
  }

  const errors = [];

  // basic email check for notify_on_submit
  if (config.notify_on_submit) {
    const email = config.notify_on_submit.trim();
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!emailOk) {
      errors.push(`notify_on_submit is not a valid email: "${email}"`);
    }
  }

  // optional: theme must be one of allowed
  if (config.theme && !ALLOWED_THEMES.includes(config.theme.trim())) {
    errors.push(
      `theme "${config.theme}" is not allowed. Allowed: ${ALLOWED_THEMES.join(", ")}`
    );
  }

  return {
    isValid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}

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
    range: `${tabName}!A:Z`,
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
  const submissionsSheetIdIdx = header.indexOf("submissions_sheet_id");
  const statusIdx = header.indexOf("status");
  const rateLimitIdx = header.indexOf("rate_limit_per_hour");

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
    submissionsSheetId: submissionsSheetIdIdx !== -1 ? match[submissionsSheetIdIdx] : null,
    status: statusIdx !== -1 ? match[statusIdx] : "unknown",
    rate_limit_per_hour: rateLimitIdx !== -1 ? match[rateLimitIdx] : null,
  };
}

async function getTenantConfigFromSheet(sheets, tenantConfigSheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: tenantConfigSheetId,
    range: "A:B",
  });

  const rows = res.data.values || [];
  const config = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = (row[0] || "").trim();
    const val = row[1] || "";

    // skip header-like row
    if (i === 0 && key.toLowerCase() === "key") {
      continue;
    }

    if (key) {
      config[key] = val;
    }
  }

  return config;
}

exports.handler = async (event) => {
  const corsHeaders = getCorsHeaders(event.headers.origin);

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "OK",
    };
  }

  // Only allow GET method
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: false, 
        code: "METHOD_NOT_ALLOWED", 
        error: "Only GET method is allowed" 
      }),
    };
  }

  // Get tenantId from query parameters only
  const tenantId = event.queryStringParameters?.tenantId || null;

  if (!tenantId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: false, 
        code: "MISSING_TENANT", 
        error: "tenantId is required" 
      }),
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
      submissionsSheetId: masterInfo.submissionsSheetId,
      rate_limit_per_hour: masterInfo.rate_limit_per_hour,
      ...tenantConfig,
    };

    // Validate the full config (including notify_on_submit)
    const validation = validateTenantConfig(combined);

    // Filter to only return public fields (now includes notify_on_submit)
    const publicConfig = {};
    for (const field of PUBLIC_FIELDS) {
      if (combined[field] !== undefined) {
        publicConfig[field] = combined[field];
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        config: publicConfig,
        valid: validation.isValid,
        missingRequiredFields: validation.missing,
        validationErrors: validation.errors,
      }),
    };
  } catch (err) {
    console.error("getTenantConfig error:", err.message);

    // 404 for missing tenant, 500 for everything else
    const isNotFound = err.code === "TENANT_NOT_FOUND";
    return {
      statusCode: isNotFound ? 404 : 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        code: err.code || "SERVER_ERROR",
        error: err.message,
      }),
    };
  }
};