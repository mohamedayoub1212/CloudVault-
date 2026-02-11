# Auto-Update com Repositório Privado

O repositório privado bloqueia a API do GitHub. Use **GitHub Gist** para que o auto-update funcione.

## Configuração (uma vez)

### 1. Criar o Gist
1. Acesse https://gist.github.com
2. Clique em "New gist"
3. Nome do arquivo: `latest.yml`
4. Conteúdo: `version: 0.0.0` (será substituído)
5. Marque como **Public**
6. Clique em "Create public gist"
7. Copie o **ID** da URL (ex: `https://gist.github.com/ usuario/abc123def456` → ID é `abc123def456`)

### 2. Configurar no projeto
Edite `desktop/update-config.json`:
```json
{
  "gistId": "SEU_GIST_ID_AQUI"
}
```

### 3. Atualizar o Gist após cada release
Após rodar `release-completo.bat`, execute:
```batch
atualizar-gist.bat
```
Ou manualmente:
```batch
set GIST_ID=seu_gist_id
set GH_TOKEN=seu_token
cd desktop
node scripts\update-gist.js
```

## Fluxo completo

1. `release-completo.bat` – build, publica, push
2. `atualizar-gist.bat` – atualiza o Gist com o latest.yml
3. Os usuários recebem a atualização automaticamente
