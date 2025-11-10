const { join } = require('path');

exports.handler = async (event, context) => {
  try {
    // Import the Angular SSR server
    const serverPath = join(__dirname, 'server', 'server.mjs');
    const { app } = await import(serverPath);
    
    // Create Express-like request/response objects
    const req = {
      url: event.path + (event.rawQuery ? `?${event.rawQuery}` : ''),
      method: event.httpMethod,
      headers: event.headers,
    };

    // Render the Angular app
    const html = await app(req);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
      body: html,
    };
  } catch (error) {
    console.error('SSR Error:', error);
    return {
      statusCode: 500,
      body: `SSR Error: ${error.message}`,
    };
  }
};