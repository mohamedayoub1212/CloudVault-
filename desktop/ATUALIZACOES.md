# Atualizações do CloudVault Desktop

O app verifica atualizações automaticamente ao iniciar. Quando há uma nova versão, o usuário é notificado e pode reiniciar para atualizar.

## Como publicar uma atualização

### 1. Aumente a versão

Edite `package.json` e altere a versão (ex: `1.0.0` → `1.0.1`).

### 2. Configure a URL de atualizações

Em `package.json`, na seção `build.publish`, altere a URL para onde você hospeda os arquivos:

```json
"publish": {
  "provider": "generic",
  "url": "https://SEU-SERVIDOR.com/cloudvault-updates"
}
```

### 3. Gere o build

```bash
npm run build
```

### 4. Envie os arquivos para o servidor

Faça upload da pasta `release/` para a URL configurada. O servidor precisa ter:

- `latest.yml` (gerado automaticamente)
- `CloudVault Setup X.X.X.exe` (o instalador)

**Exemplo de estrutura no servidor:**
```
https://seu-servidor.com/cloudvault-updates/
├── latest.yml
├── CloudVault Setup 1.0.1.exe
└── CloudVault 1.0.1.exe (opcional - versão portátil)
```

### 5. Opção: GitHub Releases

Se preferir usar GitHub:

1. Crie um repositório no GitHub
2. Em `package.json`, altere o publish:

```json
"publish": {
  "provider": "github",
  "owner": "seu-usuario",
  "repo": "CloudVault"
}
```

3. Configure a variável de ambiente `GH_TOKEN` (token do GitHub com permissão de repo)
4. Execute `npm run build` – os arquivos serão enviados automaticamente para o GitHub Releases

## Fluxo para o usuário

1. Usuário abre o app
2. Após 5 segundos, o app verifica se há atualização
3. Se houver: baixa em segundo plano
4. Ao terminar: mostra diálogo "Reiniciar agora para atualizar?"
5. Usuário clica "Reiniciar agora" → app reinicia com a nova versão
