# Plano Mestre PDF API

API de geração de PDF para planos de aula — usa **Playwright + Chromium** no servidor para gerar PDFs perfeitos com quebras de página inteligentes.

## Stack

- **Runtime:** Node.js 20+
- **Framework:** Express 5
- **PDF Engine:** Playwright (Chromium headless)
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage
- **Deploy:** Railway (Docker)

## Setup Local

```bash
# Instalar dependências
npm install

# Copiar e preencher variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Rodar em desenvolvimento
npm run dev

# Build para produção
npm run build
npm start
```

## Deploy no Railway

1. Push para o GitHub
2. No Railway: New Project → Deploy from GitHub
3. Selecionar o repositório
4. Configurar variáveis de ambiente (ver `.env.example`)
5. O Dockerfile será detectado automaticamente

## Endpoints

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/health` | Não | Health check básico |
| GET | `/health/full` | Não | Health check + teste Playwright |
| POST | `/api/pdf/generate` | Sim (x-api-key) | Gerar PDF de um plano |

## Uso

```bash
curl -X POST https://sua-url.railway.app/api/pdf/generate \
  -H "Content-Type: application/json" \
  -H "x-api-key: sua-chave-secreta" \
  -d '{"plano_id": "uuid-do-plano"}'
```
