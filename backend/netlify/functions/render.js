exports.handler = async (event, context) => {
  try {
    const path = require('path');
    const serverPath = path.join(__dirname, 'server', 'server.mjs');
    
    // Dynamic import of the Angular server
    const serverModule = await import('file://' + serverPath);
    const app = serverModule.default || serverModule.app;
    
    if (typeof app !== 'function') {
      throw new Error('Server module did not export a valid app function');
    }
    
    // Build the request URL
    const url = event.path + (event.rawQuery ? `?${event.rawQuery}` : '');
    
    // Create a mock request object
    const mockRequest = {
      url: url,
      method: event.httpMethod || 'GET',
      headers: event.headers || {},
    };
    
    // Render the page
    const html = await app(mockRequest);
    
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
    
    // Return a user-friendly error page
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
            <p>The application failed to render.</p>
            <pre>${error.message}</pre>
          </body>
        </html>
      `,
    };
  }
};