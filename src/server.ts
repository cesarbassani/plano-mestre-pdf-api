// ============================================================
// Plano Mestre PDF API — Servidor Express
// ============================================================

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { testPlaywright, closeBrowser, generatePdf } from './services/pdf-generator';
import { fetchPlanoData } from './services/supabase';
import { renderPlanoHtml } from './templates/plano';
import { uploadPdf } from './services/storage';
import { computeHash, getCachedUrl, setCachedUrl, invalidateCache, getCacheStats } from './services/cache';

const app = express();

// ── Middlewares globais ──────────────────────────────────────

app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.use(cors({
  origin: config.frontendUrl === '*' ? '*' : [config.frontendUrl],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
}));

// ── Middleware de autenticação ───────────────────────────────

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== config.apiSecret) {
    res.status(401).json({
      error: 'Não autorizado',
      message: 'Header x-api-key ausente ou inválido',
    });
    return;
  }
  next();
}

// ── Rotas ────────────────────────────────────────────────────

// Health check — público
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'plano-mestre-pdf-api',
    timestamp: new Date().toISOString(),
  });
});

// Health check completo — testa Playwright
app.get('/health/full', async (_req: Request, res: Response) => {
  const playwrightOk = await testPlaywright();
  res.status(playwrightOk ? 200 : 503).json({
    status: playwrightOk ? 'ok' : 'degraded',
    playwright: playwrightOk ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
  });
});

// ── Endpoint principal — Geração de PDF ─────────────────────

app.post('/api/pdf/generate', authMiddleware, async (req: Request, res: Response) => {
  const { plano_id, force } = req.body;
  const start = Date.now();

  if (!plano_id) {
    res.status(400).json({
      error: 'Campo obrigatório',
      message: 'plano_id é obrigatório no body',
    });
    return;
  }

  try {
    console.log(`\n🔄 Gerando PDF para plano: ${plano_id}`);

    // 1. Buscar dados do plano no Supabase
    console.log('  📥 Buscando dados...');
    const { header, dias } = await fetchPlanoData(plano_id);
    console.log(`  ✅ Dados: ${dias.length} dia(s), ${header.componentes.length} componente(s)`);

    // 2. Computar hash dos dados para verificar cache
    const dataHash = computeHash(JSON.stringify({ header, dias }));

    // 3. Verificar cache (pular se force=true)
    if (!force) {
      const cachedUrl = getCachedUrl(plano_id, dataHash);
      if (cachedUrl) {
        const elapsed = Date.now() - start;
        console.log(`  ⚡ Cache hit em ${elapsed}ms\n`);
        res.json({
          url: cachedUrl,
          cached: true,
          elapsed_ms: elapsed,
        });
        return;
      }
    }

    // 4. Renderizar template HTML
    console.log('  🎨 Renderizando HTML...');
    const html = renderPlanoHtml(header, dias);

    // 5. Gerar PDF com Playwright
    console.log('  📄 Gerando PDF...');
    const pdfBuffer = await generatePdf(html);

    // 6. Upload para Supabase Storage
    console.log('  📦 Fazendo upload...');
    const signedUrl = await uploadPdf(pdfBuffer, plano_id);

    // 7. Salvar no cache
    const sizeKb = Math.round(pdfBuffer.length / 1024);
    setCachedUrl(plano_id, signedUrl, dataHash, sizeKb);

    const elapsed = Date.now() - start;
    console.log(`  ✅ Concluído em ${elapsed}ms — ${sizeKb}KB\n`);

    res.json({
      url: signedUrl,
      cached: false,
      size_kb: sizeKb,
      elapsed_ms: elapsed,
    });

  } catch (error) {
    const elapsed = Date.now() - start;
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`  ❌ Erro (${elapsed}ms): ${message}\n`);

    if (message.includes('Plano não encontrado')) {
      res.status(404).json({ error: 'Não encontrado', message });
    } else {
      res.status(500).json({ error: 'Erro interno', message });
    }
  }
});

// ── Invalidar cache de um plano ─────────────────────────────

app.post('/api/pdf/invalidate', authMiddleware, (req: Request, res: Response) => {
  const { plano_id } = req.body;

  if (!plano_id) {
    res.status(400).json({ error: 'plano_id é obrigatório' });
    return;
  }

  const deleted = invalidateCache(plano_id);
  res.json({ invalidated: deleted, plano_id });
});

// ── Estatísticas do cache ───────────────────────────────────

app.get('/api/cache/stats', authMiddleware, (_req: Request, res: Response) => {
  res.json(getCacheStats());
});

// ── 404 ──────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ── Iniciar servidor ─────────────────────────────────────────

const server = app.listen(config.port, () => {
  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║   Plano Mestre PDF API                        ║
  ║   Rodando na porta ${config.port}                       ║
  ║   Health: http://localhost:${config.port}/health         ║
  ╚═══════════════════════════════════════════════╝
  `);
});

// ── Graceful shutdown ────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`\n${signal} recebido. Encerrando...`);
  server.close();
  await closeBrowser();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
