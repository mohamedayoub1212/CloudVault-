/**
 * Atualiza o GitHub Gist com latest.yml para auto-update funcionar com repo privado.
 * Se o Gist nao existir (404), cria um novo automaticamente.
 * Execute apos: release-completo.bat (ou depois de ter latest.yml na raiz)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

let GIST_ID = process.env.GIST_ID;
let GH_TOKEN = (process.env.GH_TOKEN || '').trim();
const latestPath = path.join(__dirname, '../../latest.yml');
const configPath = path.join(__dirname, '../update-config.json');

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${GH_TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'CloudVault-Updater'
};

function api(method, path, body, cb) {
  const req = https.request({
    hostname: 'api.github.com',
    path,
    method,
    headers: { ...headers, ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}) }
  }, (res) => {
    let data = '';
    res.on('data', (c) => { data += c; });
    res.on('end', () => {
      try {
        const json = data ? JSON.parse(data) : {};
        cb(res.statusCode, json, data);
      } catch {
        cb(res.statusCode, null, data);
      }
    });
  });
  req.on('error', (e) => cb(-1, null, e.message));
  if (body) req.write(body);
  req.end();
}

function saveGistId(id) {
  const cfg = { gistId: id };
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
}

if (!GIST_ID) {
  try {
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (cfg.gistId) GIST_ID = cfg.gistId;
    }
  } catch (_) {}
}

if (!GH_TOKEN) {
  console.error('Erro: Defina GH_TOKEN (token GitHub)');
  process.exit(1);
}

if (!fs.existsSync(latestPath)) {
  console.error('Erro: latest.yml nao encontrado. Execute npm run build primeiro.');
  process.exit(1);
}

const content = fs.readFileSync(latestPath, 'utf8');

function doCreate() {
  console.log('Criando novo Gist...');
  const body = JSON.stringify({
    description: 'CloudVault auto-update',
    public: true,
    files: { 'latest.yml': { content } }
  });
  api('POST', '/gists', body, (code, json, raw) => {
    if (code >= 200 && code < 300 && json.id) {
      saveGistId(json.id);
      console.log('Gist criado! ID:', json.id);
      console.log('Salvo em update-config.json. Auto-update deve funcionar agora.');
    } else {
      console.error('Erro ao criar Gist:', code, raw);
      if (code === 404 || code === 403) {
        console.error('');
        console.error('  O token NAO tem permissao para Gists.');
        console.error('  Solucao: crie um novo token em https://github.com/settings/tokens');
        console.error('');
        console.error('  Token CLASSICO: marque "gist" nas permissoes.');
        console.error('  Token GRANULAR: em Permissoes -> Conta -> Gists = Leitura e gravacao.');
        console.error('');
      }
      process.exit(1);
    }
  });
}

function doUpdate() {
  const body = JSON.stringify({ files: { 'latest.yml': { content } } });
  api('PATCH', `/gists/${GIST_ID}`, body, (code, json, raw) => {
    if (code >= 200 && code < 300) {
      console.log('Gist atualizado! Auto-update deve funcionar agora.');
    } else if (code === 404) {
      console.log('Gist nao encontrado. Criando um novo...');
      GIST_ID = null;
      doCreate();
    } else {
      console.error('Erro:', code, raw);
      process.exit(1);
    }
  });
}

if (GIST_ID) {
  doUpdate();
} else {
  doCreate();
}
