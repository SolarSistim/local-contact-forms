exports.handler = async (event, context) => {
  // Get base index.html (your existing function)
  let html = getIndexHtml();

  const qs = event.queryStringParameters || {};
  const tenantId = qs.id || qs.tenantId || null;

  const title = tenantId
    ? `SSR TEST - ${tenantId}`
    : 'SSR TEST - NO TENANT';

  // Super simple title replacement
  const titleRegex = /<title>.*?<\/title>/i;

  if (titleRegex.test(html)) {
    html = html.replace(
      titleRegex,
      `<title>${title}</title>`
    );
  } else {
    html = html.replace(
      '</head>',
      `  <title>${title}</title>\n</head>`
    );
  }

  // Also inject a marker comment so you can see it in View Source
  html = html.replace(
    '<app-root>',
    '<!-- SSR RENDER HIT -->\n<app-root>'
  );

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
    body: html,
  };
};
