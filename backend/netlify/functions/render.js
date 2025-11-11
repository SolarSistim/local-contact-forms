const fs = require('fs');
const path = require('path');

// Cache for the prerendered index.html
let cachedHtml = null;

function getPrerenderedHtml() {
  if (cachedHtml) return cachedHtml;

  // Get the prerendered index.html
  const indexPath = path.join(__dirname, 'server', 'assets-chunks', 'index_html.mjs');

  try {
    // For development, we'll try to load from the assets-chunks
    // In production, Netlify's runtime will handle this differently
    const content = fs.readFileSync(indexPath, 'utf-8');

    // Extract the HTML from the module
    // The file exports a string as default
    const match = content.match(/export\s+default\s+["'](.+?)["']/s) ||
                  content.match(/export\s+default\s+"([\s\S]+)"/);

    if (match && match[1]) {
      cachedHtml = match[1]
        // Unescape newlines and other escape sequences
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\"/g, '"')
        .replace(/\\\//g, '/');
      return cachedHtml;
    }
  } catch (e) {
    console.error('Failed to read prerendered HTML:', e.message);
  }

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
    <script src="/main.js" type="module"></script>
  </body>
</html>`;
}

exports.handler = async (event, context) => {
  try {
    // Get the prerendered HTML
    const html = getPrerenderedHtml();

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
            <p>${error.message}</p>
          </body>
        </html>
      `,
    };
  }
};