exports.handler = async (event, context) => {
  try {
    const path = require('path');
    const serverPath = path.join(__dirname, 'server', 'server.mjs');
    
    // Dynamic import of the Angular server
    const { AngularAppEngine } = await import('file://' + serverPath);
    
    // Create an instance of the Angular app engine
    const angularApp = new AngularAppEngine();
    
    // Debug: Check available methods
    console.log('AngularAppEngine methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(angularApp)));
    console.log('AngularAppEngine instance keys:', Object.keys(angularApp));
    
    // Build the request URL
    const url = event.path + (event.rawQuery ? `?${event.rawQuery}` : '');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
      body: `Check logs. Methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(angularApp)).join(', ')}`,
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: error.message + '\n' + error.stack,
    };
  }
};