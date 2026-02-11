/**
 * Publica release manualmente no GitHub via API.
 * Use quando electron-builder --publish falhar.
 * 
 * Uso: GH_TOKEN=seu_token node scripts/publish-release.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN = (process.env.GH_TOKEN || '').trim();
const OWNER = 'mohamedayoub1212';
const REPO = 'CloudVault-';

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const version = pkg.version;
const tag = `v${version}`;

const installerPath = path.join(__dirname, '../release', `CloudVault Setup ${version}.exe`);
if (!fs.existsSync(installerPath)) {
  console.error('Instalador nao encontrado:', installerPath);
  console.error('Execute npm run build primeiro.');
  process.exit(1);
}

if (!TOKEN) {
  console.error('Defina GH_TOKEN. Ex: set GH_TOKEN=ghp_xxx');
  process.exit(1);
}

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'CloudVault-Publisher'
      }
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
          else reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } catch (e) {
          reject(new Error(data || e.message));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function uploadAsset(releaseId, filePath) {
  return new Promise((resolve, reject) => {
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath);

    const opts = {
      hostname: 'uploads.github.com',
      path: `/repos/${OWNER}/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/octet-stream',
        'Content-Length': stats.size
      }
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data || '{}'));
        } else {
          reject(new Error(`Upload falhou ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(content);
    req.end();
  });
}

async function main() {
  console.log('Publicando v' + version + ' em', OWNER + '/' + REPO);
  try {
    const release = await api('POST', `/repos/${OWNER}/${REPO}/releases`, JSON.stringify({
      tag_name: tag,
      name: `CloudVault ${version}`,
      body: `Versão ${version}`,
      draft: false
    }));
    console.log('Release criado:', release.html_url);

    console.log('Enviando instalador...');
    await uploadAsset(release.id, installerPath);
    console.log('Pronto!', release.html_url);
  } catch (err) {
    if (err.message.includes('422')) {
      console.error('Erro 422: A tag ou release pode ja existir.');
      console.error('Delete o release em https://github.com/' + OWNER + '/' + REPO + '/releases e tente novamente.');
    } else {
      console.error('Erro:', err.message);
    }
    process.exit(1);
  }
}

main();
