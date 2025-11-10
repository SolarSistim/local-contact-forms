exports.handler = async (event, context) => {
  try {
    const path = require('path');
    const serverPath = path.join(__dirname, 'server', 'server.mjs');
    
    // Dynamic import of the Angular server
    const { AngularAppEngine } = await import('file://' + serverPath);
    
    // Create an instance of the Angular app engine
    const angularApp = new AngularAppEngine();
    
    // Build the request URL
    const url = event.path + (event.rawQuery ? `?${event.rawQuery}` : '');
    
    // Render the Angular application
    const html = await angularApp.render({
      url: url,
      headers: event.headers || {},
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
      body: html,
    };
  } catch (error) {
    console.error('SSR Error:', error);
    console.error('Stack:', error.stack);
    
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
            <pre>${error.stack}</pre>
          </body>
        </html>
      `,
    };
  }
};