# CloudVault ☁️

Armazenamento em nuvem estilo Google Drive, com web app e aplicativo desktop nativo. **Integrado à API Supabase.**

## Estrutura do Projeto

```
CloudVault/
├── backend/     # API Node.js local (opcional, para desenvolvimento)
├── web/         # Interface web React + Auth
├── desktop/     # App desktop Electron
└── README.md
```

## Como Rodar

### Web App (desenvolvimento)

```bash
cd web
npm install
npm run dev
```

Interface em: http://localhost:5173

### Desktop App (Standalone)

O app desktop usa a **API Supabase** diretamente. Duplo clique em `CloudVault.bat` ou:

```bash
cd desktop
npm install
npm start
```

Na primeira execução, o web app é compilado. Login e arquivos são gerenciados pela API Supabase.

### Iniciar com duplo clique

- **CloudVault.bat** – Dê duplo clique no arquivo na raiz do projeto para iniciar o app.
- **Atalho na área de trabalho** – Execute `.\Criar-Atalho.ps1` no PowerShell para criar um atalho com ícone.

### Instalar em outros computadores

Para gerar o instalador do Windows:

```bash
cd desktop
npm install
npm run build
```

Os arquivos serão gerados na pasta `desktop/release/`:
- **CloudVault Setup 1.0.0.exe** – Instalador (executa e escolhe a pasta de instalação)
- **CloudVault 1.0.0.exe** – Versão portátil (não precisa instalar, só executar)

Copie o arquivo desejado para outro computador e execute. **Não é necessário ter Node.js instalado** no computador de destino.

## Funcionalidades

- ✅ Upload de arquivos
- ✅ Download de arquivos
- ✅ Listagem de arquivos
- ✅ Exclusão de arquivos
- ✅ Interface web moderna
- ✅ App desktop nativo (Windows/Mac/Linux)

## Requisitos

- Node.js 18+
- npm ou yarn

## Próximos Passos

- [ ] Autenticação de usuários
- [ ] Pasta de sincronização local
- [ ] Sincronização em tempo real
- [ ] Menu de contexto "Enviar para CloudVault"
