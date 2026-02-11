/**
 * Atualiza o GitHub Gist com latest.yml para auto-update funcionar com repo privado.
 * Execute apos: release-completo.bat (ou depois de ter latest.yml na raiz)
 * Variaveis: GIST_ID, GH_TOKEN
 * 
 * Como configurar:
 * 1. Crie um Gist publico em https://gist.github.com
 * 2. Adicione arquivo "latest.yml" (pode ser vazio)
 * 3. Copie o ID do Gist da URL (ex: gist.github.com/user/abc123 -> abc123)
 * 4. GIST_ID=abc123 GH_TOKEN=seu_token node scripts/update-gist.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const GIST_ID = process.env.GIST_ID;
const GH_TOKEN = process.env.GH_TOKEN;
const latestPath = path.join(__dirname, '../../latest.yml');

if (!GIST_ID || !GH_TOKEN) {
  console.error('Erro: Defina GIST_ID e GH_TOKEN');
  console.error('Ex: GIST_ID=abc123 GH_TOKEN=ghp_xxx node scripts/update-gist.js');
  process.exit(1);
}

if (!fs.existsSync(latestPath)) {
  console.error('Erro: latest.yml nao encontrado. Execute npm run build primeiro.');
  process.exit(1);
}

const content = fs.readFileSync(latestPath, 'utf8');

const body = JSON.stringify({
  files: { 'latest.yml': { content } }
});

const req = https.request({
  hostname: 'api.github.com',
  path: `/gists/${GIST_ID}`,
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `token ${GH_TOKEN}`,
    'User-Agent': 'CloudVault-Updater'
  }
}, (res) => {
  let data = '';
  res.on('data', (c) => { data += c; });
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('Gist atualizado! Auto-update deve funcionar agora.');
    } else {
      console.error('Erro:', res.statusCode, data);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('Erro de rede:', e.message);
  process.exit(1);
});
req.write(body);
req.end();
