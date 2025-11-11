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
    path.join(__dirname, '..', '..', '..', 'frontend', 'dist', 'frontend', 'browser', 'index.html'),
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

exports.handler = async (event, context) => {
  const path = event.path || '';

  // Don't handle static assets - let Netlify serve them directly
  if (/\.(js|css|svg|ico|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot)$/i.test(path)) {
    return {
      statusCode: 404,
      body: 'Not Found'
    };
  }

  try {
    // Get the index HTML
    const html = getIndexHtml();

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
