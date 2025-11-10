exports.handler = async (event, context) => {
  try {
    const path = require('path');
    const serverPath = path.join(__dirname, 'server', 'server.mjs');
    
    // Dynamic import of the Angular server
    const { AngularAppEngine } = await import('file://' + serverPath);
    
    // Create an instance of the Angular app engine
    const angularApp = new AngularAppEngine();
    
    // Build the full URL
    const url = event.path + (event.rawQuery ? `?${event.rawQuery}` : '');
    
    // Create a Request object (Web API standard)
    const request = new Request(`https://${event.headers.host || 'localhost'}${url}`, {
      method: event.httpMethod || 'GET',
      headers: event.headers || {},
    });
    
    // Handle the request with Angular's engine
    const response = await angularApp.handle(request);
    
    // Convert Response to Netlify function format
    const body = await response.text();
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    return {
      statusCode: response.status,
      headers: headers,
      body: body,
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
          </body>
        </html>
      `,
    };
  }
};