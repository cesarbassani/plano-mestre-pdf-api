# Plano Mestre PDF API

API para geração de PDFs de planos de aula usando **Playwright + Chromium** no servidor, eliminando os problemas de paginação do jsPDF/html2canvas no frontend.

## Stack

- **Runtime:** Node.js 20
- **Framework:** Express 5
- **PDF Engine:** Playwright (Chromium headless)
- **Banco:** Supabase (PostgreSQL + Storage)
- **Deploy:** Railway (Docker)
- **Linguagem:** TypeScript

## Arquitetura

```
Frontend (Netlify)
    │
    │  POST /api/pdf/generate { plano_id }
    ▼
┌─────────────────────────────────────┐
│  PDF API (Railway)                  │
│                                     │
│  1. Verifica cache (hash dos dados) │
│     ↓ cache hit → retorna URL       │
│     ↓ cache miss ↓                  │
│  2. Busca dados no Supabase         │
│  3. Renderiza HTML (template)       │
│  4. Playwright → PDF buffer         │
│  5. Upload → Supabase Storage       │
│  6. Salva no cache                  │
│  7. Retorna signed URL              │
└─────────────────────────────────────┘
```

## Endpoints

### `GET /health`
Health check público.

```json
{ "status": "ok", "service": "plano-mestre-pdf-api", "timestamp": "..." }
```

### `GET /health/full`
Health check com teste do Playwright/Chromium.

```json
{ "status": "ok", "playwright": "ok", "timestamp": "..." }
```

### `POST /api/pdf/generate` 🔒
Gera PDF de um plano de aula.

**Headers:**
```
Content-Type: application/json
x-api-key: <API_SECRET>
```

**Body:**
```json
{
  "plano_id": "uuid-do-plano",
  "force": false
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `plano_id` | string (UUID) | ✅ | ID do planejamento |
| `force` | boolean | ❌ | `true` para ignorar cache e regenerar |

**Resposta (200):**
```json
{
  "url": "https://xxx.supabase.co/storage/v1/.../plano.pdf?token=...",
  "cached": false,
  "size_kb": 45,
  "elapsed_ms": 3200
}
```

| Campo | Descrição |
|-------|-----------|
| `url` | URL assinada do PDF (expira em 1h) |
| `cached` | `true` se retornou do cache, `false` se gerou novo |
| `size_kb` | Tamanho do PDF em KB (só quando `cached: false`) |
| `elapsed_ms` | Tempo total de processamento |

**Erros:**
- `400` — `plano_id` ausente
- `401` — `x-api-key` inválido
- `404` — Plano não encontrado no Supabase
- `500` — Erro interno (Playwright, Storage, etc.)

### `POST /api/pdf/invalidate` 🔒
Invalida o cache de um plano específico. Útil quando o plano é editado.

**Body:**
```json
{ "plano_id": "uuid-do-plano" }
```

**Resposta:**
```json
{ "invalidated": true, "plano_id": "uuid-do-plano" }
```

### `GET /api/cache/stats` 🔒
Retorna estatísticas do cache.

**Resposta:**
```json
{ "entries": 12, "maxEntries": 500, "ttlMinutes": 50 }
```

## Sistema de Cache

O cache evita regenerar PDFs quando os dados do plano não mudaram.

### Como funciona

1. Ao receber uma requisição, a API busca os dados do plano no Supabase
2. Computa um **hash SHA-256** dos dados (header + dias + habilidades + recursos)
3. Se existe cache para esse `plano_id` com o **mesmo hash** e TTL válido → retorna a URL cacheada (~50ms)
4. Se o hash mudou (plano foi editado) ou TTL expirou → regenera o PDF

### Características

| Propriedade | Valor |
|-------------|-------|
| Tipo | In-memory (Map) |
| TTL | 50 minutos |
| Máximo de entradas | 500 |
| Invalidação automática | Por hash (dados mudaram) ou TTL |
| Invalidação manual | `POST /api/pdf/invalidate` |
| Evicção | LRU (remove mais antigo ao atingir limite) |
| Bypass | `force: true` no body |

### Performance esperada

| Cenário | Tempo |
|---------|-------|
| Cache hit | ~50-200ms |
| Cache miss (geração completa) | ~2-5s |
| Plano grande (30+ dias) | ~5-10s |

### Quando o cache é invalidado

- **Automático:** hash dos dados muda (professor editou o plano)
- **Automático:** TTL de 50 minutos expira
- **Manual:** `POST /api/pdf/invalidate` (chamar ao salvar plano no frontend)
- **Manual:** `force: true` no endpoint de geração
- **Deploy:** cache é perdido ao restartar o container

## Variáveis de Ambiente

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...
API_SECRET=<chave-secreta-para-x-api-key>
PORT=3000
FRONTEND_URL=https://seu-projeto.netlify.app
```

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (bypassa RLS) |
| `API_SECRET` | ✅ | Chave de autenticação da API |
| `PORT` | ❌ | Porta (padrão: 3000) |
| `FRONTEND_URL` | ❌ | URL do frontend para CORS (padrão: `*`) |

## Estrutura do Projeto

```
src/
├── config.ts               # Variáveis de ambiente
├── server.ts               # Express: rotas + middlewares
├── types.ts                # Interfaces TypeScript
├── services/
│   ├── supabase.ts         # Cliente Supabase + fetchPlanoData()
│   ├── pdf-generator.ts    # Playwright: HTML → PDF buffer
│   ├── storage.ts          # Upload Supabase Storage → signed URL
│   └── cache.ts            # Cache em memória com hash + TTL
└── templates/
    └── plano.ts            # Template HTML + CSS do PDF
```

## Setup Local

```bash
# Instalar dependências
npm install

# Instalar Chromium do Playwright
npx playwright install chromium

# Copiar e configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Rodar em desenvolvimento
npx ts-node src/server.ts
```

## Deploy (Railway)

1. Criar novo projeto no Railway
2. Conectar repositório Git
3. Configurar variáveis de ambiente no painel
4. O Dockerfile já está configurado — deploy automático
5. Verificar: `curl https://sua-url.railway.app/health`

### Supabase Storage

Criar bucket antes do primeiro uso:
- **Nome:** `pdfs`
- **Público:** Não
- **Limite:** 10MB
- **MIME types:** `application/pdf`

## Integração com Frontend

### Exemplo de chamada

```typescript
async function gerarPdf(planoId: string): Promise<string> {
  const response = await fetch('https://sua-api.railway.app/api/pdf/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.NEXT_PUBLIC_PDF_API_KEY!,
    },
    body: JSON.stringify({ plano_id: planoId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const { url } = await response.json();
  return url;
}
```

### Abrir PDF no navegador

```typescript
const url = await gerarPdf(planoId);
window.open(url, '_blank');
```

### Invalidar cache ao salvar plano

```typescript
async function invalidarCachePdf(planoId: string): Promise<void> {
  await fetch('https://sua-api.railway.app/api/pdf/invalidate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.NEXT_PUBLIC_PDF_API_KEY!,
    },
    body: JSON.stringify({ plano_id: planoId }),
  });
}
```

## Tabelas Supabase Utilizadas

| Tabela | Função |
|--------|--------|
| `planejamentos` | Dados principais do plano |
| `dias_planejamento` | Dias do plano |
| `dias_habilidades` | Junção dia ↔ habilidade |
| `habilidades` | Habilidades BNCC |
| `objetos_conhecimento` | Objetos de conhecimento |
| `componentes_curriculares` | Componentes (Matemática, etc.) |
| `dias_recursos` | Junção dia ↔ recurso |
| `recursos_catalogo` | Catálogo de recursos |
| `escolas` | Escolas |
| `turmas` | Turmas |
| `planejamentos_turmas` | Junção plano ↔ turma |
| `planejamentos_componentes` | Junção plano ↔ componente |
| `profiles` | Perfil do professor |
| `instituicao_config` | Config institucional (logo, prefeitura) |
