exports.handler = async (event, context) => {
  try {
    const path = require('path');
    const serverPath = path.join(__dirname, 'server', 'server.mjs');
    
    // Dynamic import of the Angular server
    const serverModule = await import('file://' + serverPath);
    
    // Debug: Log what's actually exported
    console.log('Server module keys:', Object.keys(serverModule));
    console.log('Default export type:', typeof serverModule.default);
    console.log('App export type:', typeof serverModule.app);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
      body: `Check function logs for module exports. Keys: ${Object.keys(serverModule).join(', ')}`,
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: error.message,
    };
  }
};