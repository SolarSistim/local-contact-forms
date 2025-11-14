const fs = require('fs');
const path = require('path');

// Cache for the index.html
let cachedHtml = null;

function getIndexHtml() {
  if (cachedHtml) return cachedHtml;

  // Try to load the built index.html
  // In Netlify, included_files are bundled with the function
  const indexPaths = [
    // Netlify production: included in function bundle
    path.join(__dirname, 'index.html'),
    // Local development: from the built dist folder
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      'frontend',
      'dist',
      'frontend',
      'browser',
      'index.html'
    ),
  ];

  for (const indexPath of indexPaths) {
    try {
      const content = fs.readFileSync(indexPath, 'utf-8');
      cachedHtml = content;
      return cachedHtml;
    } catch (e) {
      // Continue to next path
    }
  }

  console.error('Failed to read index.html from any path');

  // Fallback to a basic HTML structure
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Local Contact Forms</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body>
    <app-root></app-root>
    <p>Error: Unable to load application</p>
  </body>
</html>`;
}

// Very small HTML escaper for title/meta content
function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Inject title + meta tags based on tenant config
function applyTenantMeta(html, config) {
  if (!config) return html;

  const title = config.business_name || 'Local Contact Forms';
  const description = config.meta_description || '';
  const keywords = config.meta_keywords || '';

const titleRegex = /<title>.*?<\/title>/i;

if (titleRegex.test(html)) {
  html = html.replace(
    titleRegex,
    `<title>${escapeHtml(title)}</title>`
  );
} else {
  html = html.replace(
    '</head>',
    `  <title>${escapeHtml(title)}</title>\n</head>`
  );
}

  // Description meta
  if (description) {
    if (/<meta[^>]+name=["']description["'][^>]*>/i.test(html)) {
      html = html.replace(
        /<meta[^>]+name=["']description["'][^>]*>/i,
        `<meta name="description" content="${escapeHtml(description)}">`
      );
    } else {
      html = html.replace(
        '</head>',
        `  <meta name="description" content="${escapeHtml(description)}">\n</head>`
      );
    }
  }

  // Keywords meta
  if (keywords) {
    if (/<meta[^>]+name=["']keywords["'][^>]*>/i.test(html)) {
      html = html.replace(
        /<meta[^>]+name=["']keywords["'][^>]*>/i,
        `<meta name="keywords" content="${escapeHtml(keywords)}">`
      );
    } else {
      html = html.replace(
        '</head>',
        `  <meta name="keywords" content="${escapeHtml(keywords)}">\n</head>`
      );
    }
  }

  return html;
}

exports.handler = async (event, context) => {
  const reqPath = event.path || '';

  // Don't handle static assets - let Netlify serve them directly
  if (/\.(js|css|svg|ico|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot)$/i.test(reqPath)) {
    return {
      statusCode: 404,
      body: 'Not Found',
    };
  }

  try {
    // Get the base index HTML
    let html = getIndexHtml();

    // Read tenant id from query string. Support both ?id= and ?tenantId=
    const qs = event.queryStringParameters || {};
    const tenantId = qs.id || qs.tenantId || null;

    if (tenantId) {
      try {
        // Re-use the existing Netlify function to fetch config
        const getTenantConfig = require('./getTenantConfig');

        const origin =
          (event.headers && event.headers.origin) ||
          'https://localcontactforms.com';

        const cfgResponse = await getTenantConfig.handler(
          {
            httpMethod: 'GET',
            headers: { origin },
            queryStringParameters: { tenantId },
          },
          {}
        );

        if (cfgResponse.statusCode === 200) {
          const body = JSON.parse(cfgResponse.body || '{}');
          if (body.success && body.config) {
            html = applyTenantMeta(html, body.config);
          }
        } else {
          console.warn(
            'getTenantConfig returned non-200:',
            cfgResponse.statusCode,
            cfgResponse.body
          );
        }
      } catch (cfgErr) {
        console.error('Error fetching tenant config for SSR:', cfgErr);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
      body: html,
    };
  } catch (error) {
    console.error('Render Error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/html',
      },
      body: `
        <!DOCTYPE html>
        <html>
          <head><title>Error</title></head>
          <body>
            <h1>Server Error</h1>
            <p>${escapeHtml(error.message)}</p>
          </body>
        </html>
      `,
    };
  }
};
