// ============================================================
// PDF Generator — Playwright Chromium
// ============================================================

import { chromium, Browser } from 'playwright-core';

let browser: Browser | null = null;

/**
 * Retorna uma instância reutilizável do browser.
 * Cria uma nova se não existir ou se a anterior foi fechada.
 */
async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    console.log('🚀 Iniciando Chromium...');
    browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    console.log('✅ Chromium iniciado');
  }
  return browser;
}

/**
 * Gera um PDF a partir de HTML usando Playwright.
 * Retorna o Buffer do PDF.
 */
export async function generatePdf(html: string): Promise<Buffer> {
  const start = Date.now();
  const b = await getBrowser();
  const context = await b.newContext();
  const page = await context.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
    await page.emulateMedia({ media: 'print' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '16mm',
        right: '15mm',
        bottom: '16mm',
        left: '15mm',
      },
    });

    const elapsed = Date.now() - start;
    console.log(`📄 PDF gerado: ${(pdf.length / 1024).toFixed(1)}KB em ${elapsed}ms`);

    return Buffer.from(pdf);
  } finally {
    await context.close();
  }
}

/**
 * Testa se o Playwright/Chromium está funcionando.
 * Retorna true se conseguir gerar um PDF de teste.
 */
export async function testPlaywright(): Promise<boolean> {
  try {
    const testHtml = '<html><body><h1>Playwright OK</h1></body></html>';
    const pdf = await generatePdf(testHtml);
    return pdf.length > 0;
  } catch (error) {
    console.error('❌ Playwright test falhou:', error);
    return false;
  }
}

/**
 * Fecha o browser (para graceful shutdown).
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('🛑 Chromium fechado');
  }
}
