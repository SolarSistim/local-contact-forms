// backend/netlify/functions/render.mjs
import { reqHandler } from './server/server.mjs';

export const handler = async (event, context) => {
  const reqPath = event.path || '';
  
  // Skip static assets
  if (/\.(js|css|svg|ico|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|map)$/i.test(reqPath)) {
    return { statusCode: 404, body: 'Not Found' };
  }

  try {
    // Build full URL with query params
    const queryString = event.queryStringParameters 
      ? '?' + new URLSearchParams(event.queryStringParameters).toString()
      : '';
    const fullPath = reqPath + queryString;

    // Create mock request object
    const mockRequest = {
      method: event.httpMethod,
      url: fullPath,
      headers: event.headers,
      body: event.body,
      connection: {},
      socket: { encrypted: true },
    };

    // Create mock response object
    let responseBody = '';
    let responseHeaders = {};
    let statusCode = 200;

    const mockResponse = {
      statusCode: 200,
      setHeader: (name, value) => { responseHeaders[name.toLowerCase()] = value; },
      getHeader: (name) => responseHeaders[name.toLowerCase()],
      removeHeader: (name) => { delete responseHeaders[name.toLowerCase()]; },
      write: (chunk) => { responseBody += chunk; },
      end: (chunk) => { if (chunk) responseBody += chunk; },
      on: () => {},
      once: () => {},
      emit: () => {},
      writeHead: (code, headers) => {
        statusCode = code;
        if (headers) {
          Object.keys(headers).forEach(key => {
            responseHeaders[key.toLowerCase()] = headers[key];
          });
        }
      },
    };

    // Call Angular SSR
    await reqHandler(mockRequest, mockResponse);

    return {
      statusCode: statusCode,
      headers: responseHeaders,
      body: responseBody,
    };
  } catch (error) {
    console.error('Angular SSR Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `<!DOCTYPE html>
        <html><head><title>Error</title></head>
        <body><h1>Server Error</h1><p>Check Netlify function logs.</p></body>
        </html>`,
    };
  }
};