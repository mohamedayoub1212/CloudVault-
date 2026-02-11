const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Diretórios - suporta DATA_DIR para app desktop (ex: AppData)
const baseDir = process.env.DATA_DIR || __dirname;
const UPLOAD_DIR = path.join(baseDir, 'uploads');
const DB_FILE = path.join(baseDir, 'data', 'files.json');

// Garantir que os diretórios existam
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(DB_FILE))) fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

// Banco de dados simples (em produção use SQLite/PostgreSQL)
function getFiles() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveFiles(files) {
  fs.writeFileSync(DB_FILE, JSON.stringify(files, null, 2));
}

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Configurar multer para upload
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname) || '')
});
const upload = multer({ storage });

// Rotas da API

// Listar todos os arquivos
app.get('/api/files', (req, res) => {
  const files = getFiles();
  res.json(files);
});

// Obter detalhes de um arquivo
app.get('/api/files/:id', (req, res) => {
  const files = getFiles();
  const file = files.find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: 'Arquivo não encontrado' });
  res.json(file);
});

// Upload de arquivo
app.post('/api/files/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const files = getFiles();
  const newFile = {
    id: path.basename(req.file.filename, path.extname(req.file.filename)),
    name: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype,
    path: req.file.filename,
    createdAt: new Date().toISOString()
  };

  files.push(newFile);
  saveFiles(files);

  res.status(201).json(newFile);
});

// Download de arquivo
app.get('/api/files/:id/download', (req, res) => {
  const files = getFiles();
  const file = files.find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: 'Arquivo não encontrado' });

  const filePath = path.join(UPLOAD_DIR, file.path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado no disco' });

  res.download(filePath, file.name);
});

// Deletar arquivo
app.delete('/api/files/:id', (req, res) => {
  const files = getFiles();
  const index = files.findIndex(f => f.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Arquivo não encontrado' });

  const file = files[index];
  const filePath = path.join(UPLOAD_DIR, file.path);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  files.splice(index, 1);
  saveFiles(files);

  res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Servir frontend estático (modo desktop)
const STATIC_DIR = process.env.STATIC_DIR;
if (STATIC_DIR && fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(STATIC_DIR, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  if (!process.env.ELECTRON_RUN_AS_NODE) {
    console.log(`\n☁️ CloudVault API rodando em http://localhost:${PORT}`);
    console.log(`   Uploads em: ${UPLOAD_DIR}\n`);
  }
});
