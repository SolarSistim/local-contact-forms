const { join } = require('path');

exports.handler = async (event, context) => {
  try {
    // The server files are copied to backend/netlify/functions/server/
    // But at runtime, __dirname is /var/task/backend/netlify/functions/
    const serverPath = join(__dirname, 'server', 'server.mjs');
    
    console.log('Looking for server at:', serverPath);
    console.log('__dirname:', __dirname);
    
    const { default: serverApp } = await import('file://' + serverPath);
    
    // Build the full URL
    const url = event.path + (event.rawQuery ? `?${event.rawQuery}` : '');
    
    // Call the Angular server
    const response = await serverApp(url, event);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
      body: response,
    };
  } catch (error) {
    console.error('SSR Error:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
      body: `SSR Error: ${error.message}\nStack: ${error.stack}`,
    };
  }
};