import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 80;

// Utilitário para construir URL de destino no host atual porém na porta 4000
function buildTargetUrl(req, pathname) {
  const hostHeader = req.headers.host || '';
  const hostOnly = hostHeader.replace(/:.*/, ''); // remove ":<port>"
  const qsIndex = req.originalUrl.indexOf('?');
  const qs = qsIndex >= 0 ? req.originalUrl.slice(qsIndex) : '';
  return `http://${hostOnly}:4000${pathname}${qs}`;
}

// Apenas redirecionar as rotas de captive portal para o frontend na 4000
// Exemplos comuns: /guest/s/default, /guest/s/default/, /guest
app.get(['/guest', '/guest/s/:site', /^\/guest\/.*/, /^\/guest\/s\/[^/]+\/.*/, '/generate_204', '/hotspot-detect.html'], (req, res) => {
  const target = buildTargetUrl(req, '/portal/login');
  return res.redirect(302, target);
});

// Não redirecionar /portal/*; deixar Nginx servir build ou Vite dev conforme host

// Opcional: uma pequena página informativa na raiz
app.get('/', (_, res) => {
  res.status(200).send(
    '<html><body><h3>Portal Captivo</h3><p>Use http://<host>:4000 para o painel.</p></body></html>'
  );
});

// Nenhum outro conteúdo é servido aqui; sem proxies, sem build estático

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de redirecionamento do Portal ativo em http://localhost:${PORT}.`);
});