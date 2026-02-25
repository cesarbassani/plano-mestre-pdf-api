// ============================================================
// Plano Mestre PDF API — Servidor Express
// ============================================================

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { testPlaywright, closeBrowser, generatePdf } from './services/pdf-generator';

const app = express();

// ── Middlewares globais ──────────────────────────────────────

app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// CORS — aceita apenas o domínio do frontend
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

// Health check — público (sem auth)
app.get('/health', async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'plano-mestre-pdf-api',
    timestamp: new Date().toISOString(),
  });
});

// Health check detalhado — testa Playwright
app.get('/health/full', async (_req: Request, res: Response) => {
  const playwrightOk = await testPlaywright();

  res.status(playwrightOk ? 200 : 503).json({
    status: playwrightOk ? 'ok' : 'degraded',
    service: 'plano-mestre-pdf-api',
    playwright: playwrightOk ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
  });
});

// ── Endpoint principal — Geração de PDF ─────────────────────
// (Etapas 6-10 completarão este endpoint)

app.post('/api/pdf/generate', authMiddleware, async (req: Request, res: Response) => {
  const { plano_id } = req.body;

  if (!plano_id) {
    res.status(400).json({
      error: 'Campo obrigatório',
      message: 'plano_id é obrigatório no body',
    });
    return;
  }

  try {
    // TODO Etapa 6: fetchPlanoData(plano_id) → header + dias
    // TODO Etapa 7: renderPlanoHtml(header, dias) → html string
    // TODO Etapa 8: generatePdf(html) → Buffer
    // TODO Etapa 9: uploadPdf(buffer) → signed URL

    // Por enquanto, gerar um PDF de teste para validar o pipeline
    const testHtml = `
      <html>
      <head><style>
        body { font-family: Helvetica, Arial, sans-serif; padding: 40px; }
        h1 { color: #005A9C; }
      </style></head>
      <body>
        <h1>PLANO DE AULA DO ENSINO FUNDAMENTAL</h1>
        <p>PDF de teste gerado com sucesso!</p>
        <p>plano_id recebido: <strong>${plano_id}</strong></p>
        <p>Timestamp: ${new Date().toISOString()}</p>
        <hr>
        <p><em>Este é um PDF de teste. O template real será implementado na Etapa 7.</em></p>
      </body>
      </html>
    `;

    const pdfBuffer = await generatePdf(testHtml);

    // Por enquanto, retornar o PDF diretamente (sem Storage)
    // Na Etapa 9, mudaremos para upload + signed URL
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="plano_${plano_id}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Erro ao gerar PDF:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

// ── 404 fallback ─────────────────────────────────────────────

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
