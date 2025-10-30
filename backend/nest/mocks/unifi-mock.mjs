import http from 'http';

const port = Number(process.env.UNIFI_MOCK_PORT || 4010);

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const bodyStr = Buffer.concat(chunks).toString('utf8');
    let body;
    try { body = bodyStr ? JSON.parse(bodyStr) : {}; } catch { body = {}; }

    const url = req.url || '';
    const method = req.method || 'GET';

    let payload;
    if (method === 'POST' && /\/cmd\/stamgr/.test(url)) {
      // Simula respostas de sucesso do UniFi para kick/ban/unban/authorize
      payload = { meta: { rc: 'ok' }, data: [] };
    } else if (method === 'POST' && /\/(logout|login)/.test(url)) {
      // Resposta de login com cookie
      payload = { meta: { rc: 'ok' }, data: [] };
      res.setHeader('Set-Cookie', [
        'TOKEN=mock-session-token; Path=/; HttpOnly',
        'csrf=mock-csrf; Path=/'
      ]);
    } else if (/\/system/i.test(url)) {
      payload = { data: [{ version: 'mock-1.0.0', hostname: 'unifi-mock' }], meta: { rc: 'ok' } };
    } else {
      payload = { ok: true, echo: { method, url, body } };
    }

    // Define Content-Type e deixa possíveis cabeçalhos já definidos (p.ex. Set-Cookie)
    res.statusCode = 200;
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json');
    }
    res.end(JSON.stringify(payload));
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[unifi-mock] listening on http://localhost:${port}`);
});