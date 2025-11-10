const { join } = require('path');
const fs = require('fs');

exports.handler = async (event, context) => {
  try {
    // Debug: List what's actually in the functions directory
    const functionsDir = __dirname;
    const serverDir = join(functionsDir, 'server');
    
    console.log('Functions dir:', functionsDir);
    console.log('Server dir:', serverDir);
    
    if (fs.existsSync(serverDir)) {
      const files = fs.readdirSync(serverDir);
      console.log('Files in server dir:', files);
    } else {
      console.log('Server directory does not exist!');
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
      body: `Debug info logged to function console. Check Netlify function logs.`,
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: error.message,
    };
  }
};