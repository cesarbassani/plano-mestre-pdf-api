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
  const { plano_id } = req.body;
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

    // 2. Renderizar template HTML
    console.log('  🎨 Renderizando HTML...');
    const html = renderPlanoHtml(header, dias);

    // 3. Gerar PDF com Playwright
    console.log('  📄 Gerando PDF...');
    const pdfBuffer = await generatePdf(html);

    // 4. Upload para Supabase Storage
    console.log('  📦 Fazendo upload...');
    const signedUrl = await uploadPdf(pdfBuffer, plano_id);

    const elapsed = Date.now() - start;
    console.log(`  ✅ Concluído em ${elapsed}ms — ${(pdfBuffer.length / 1024).toFixed(1)}KB\n`);

    res.json({
      url: signedUrl,
      size_kb: Math.round(pdfBuffer.length / 1024),
      elapsed_ms: elapsed,
    });

  } catch (error) {
    const elapsed = Date.now() - start;
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`  ❌ Erro (${elapsed}ms): ${message}\n`);

    // Diferenciar erros
    if (message.includes('Plano não encontrado')) {
      res.status(404).json({ error: 'Não encontrado', message });
    } else {
      res.status(500).json({ error: 'Erro interno', message });
    }
  }
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
