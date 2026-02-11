/**
 * Atualiza latest.yml na raiz do repo com URLs absolutas para o GitHub Releases.
 * Execute após: npm run build
 * Depois: git add ../latest.yml && git commit -m "Update latest.yml vX.X.X" && git push
 */
const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const version = pkg.version;
const repo = pkg.build?.publish?.repo || 'CloudVault-';
const owner = pkg.build?.publish?.owner || 'mohamedayoub1212';

const releaseYml = path.join(__dirname, '../release/latest.yml');
if (!fs.existsSync(releaseYml)) {
  console.error('release/latest.yml não encontrado. Execute npm run build primeiro.');
  process.exit(1);
}

const content = fs.readFileSync(releaseYml, 'utf8');
const baseUrl = `https://github.com/${owner}/${repo}/releases/download/v${version}/`;

// electron-builder pode gerar com espaço ou hífen para GitHub
const filenameSpace = `CloudVault Setup ${version}.exe`;
const filenameHyphen = `CloudVault-Setup-${version}.exe`;
const fullUrl = baseUrl + filenameHyphen; // GitHub usa hífen

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let result = content
  .replace(new RegExp(`path: ${escapeRe(filenameSpace)}\\b`, 'g'), `path: ${fullUrl}`)
  .replace(new RegExp(`url: ${escapeRe(filenameSpace)}\\b`, 'g'), `url: ${fullUrl}`)
  .replace(new RegExp(`path: ${escapeRe(filenameHyphen)}\\b`, 'g'), `path: ${fullUrl}`)
  .replace(new RegExp(`url: ${escapeRe(filenameHyphen)}\\b`, 'g'), `url: ${fullUrl}`);

const outPath = path.join(__dirname, '../../latest.yml');
fs.writeFileSync(outPath, result);
console.log(`latest.yml atualizado em ${outPath} (v${version})`);
