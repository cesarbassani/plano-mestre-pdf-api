// ============================================================
// Template HTML — Plano de Aula
// ============================================================
// Gera uma string HTML completa que o Playwright converte em PDF.
// O CSS @page + break-inside resolve TODOS os problemas de paginação.
// ============================================================

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PlanHeader, DiaData, HabilidadeData } from '../types';

// ── Helper: formata data com segurança ──

function formatDate(dateStr: string, fmt: string): string {
  try {
    return format(new Date(dateStr + 'T12:00:00'), fmt, { locale: ptBR });
  } catch {
    return dateStr;
  }
}

// ── Helper: escape HTML ──

function esc(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Helper: agrupar habilidades por componente ──

interface GroupedObj {
  componente: string;
  objetos: string[];
  habilidades: HabilidadeData[];
}

function groupByComponente(habilidades: HabilidadeData[]): GroupedObj[] {
  const map = new Map<string, GroupedObj>();

  for (const hab of habilidades) {
    const comp = hab.objeto?.componente?.name || 'Geral';
    if (!map.has(comp)) {
      map.set(comp, { componente: comp, objetos: [], habilidades: [] });
    }
    const group = map.get(comp)!;
    group.habilidades.push(hab);

    const objName = hab.objeto?.name;
    if (objName && !group.objetos.includes(objName)) {
      group.objetos.push(objName);
    }
  }

  return Array.from(map.values());
}

// ============================================================
// CSS do PDF
// ============================================================

const CSS = `
  /* ── Reset + @page ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4;
    margin: 0;
  }

  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 9pt;
    line-height: 1.5;
    color: #333333;
    background: #fff;
  }

  /* ── Design System ── */
  :root {
    --azul: #005A9C;
    --azul-claro: #4D94CC;
    --azul-bg: #EAF3FA;
    --texto-pri: #333333;
    --texto-sec: #666666;
    --texto-label: #888888;
    --cinza-borda: #DCE1E8;
    --cinza-claro: #F0F2F5;
  }

  /* ── Header Institucional ── */
  .inst-header {
    text-align: center;
    margin-bottom: 8pt;
    break-inside: avoid;
  }
  .inst-header img.logo {
    max-height: 50pt;
    max-width: 140pt;
    margin-bottom: 4pt;
  }
  .inst-header .inst-line {
    font-size: 8pt;
    color: var(--texto-sec);
    line-height: 1.4;
  }

  /* ── Título principal ── */
  .main-title {
    text-align: center;
    font-size: 13pt;
    font-weight: bold;
    color: var(--texto-pri);
    padding: 10pt 0 6pt;
    break-after: avoid;
  }

  .divider {
    border: none;
    border-top: 0.5pt solid var(--cinza-borda);
    margin: 4pt 0 8pt;
  }

  /* ── Metadados ── */
  .meta-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8pt;
    break-inside: avoid;
  }
  .meta-table td {
    padding: 3pt 4pt;
    vertical-align: top;
    font-size: 9pt;
  }
  .meta-label {
    font-weight: bold;
    color: var(--texto-pri);
    white-space: nowrap;
    width: 1%;
  }
  .meta-value {
    color: var(--texto-sec);
  }

  /* ── Dia ── */
  .day-block {
    margin-top: 6pt;
  }
  .day-header {
    text-align: center;
    font-size: 10pt;
    font-weight: bold;
    color: var(--texto-pri);
    padding: 8pt 0 4pt;
    break-after: avoid;
  }
  .day-divider {
    border: none;
    border-top: 0.5pt solid var(--cinza-borda);
    margin: 0 0 6pt;
  }

  /* ── Seção (barra azul + conteúdo com borda) ── */
  .section {
    margin-bottom: 6pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section-bar {
    background-color: var(--azul-bg);
    padding: 4pt 8pt;
    font-size: 9pt;
    font-weight: bold;
    color: var(--texto-pri);
    text-transform: uppercase;
    break-after: avoid;
  }
  .section-body {
    border: 0.5pt solid var(--cinza-borda);
    border-top: none;
    padding: 8pt 10pt;
    font-size: 8.5pt;
    color: var(--texto-sec);
    line-height: 1.6;
  }

  /* ── Metodologia: permitir quebra interna ── */
  .section.metodologia {
    break-inside: auto;
    page-break-inside: auto;
  }
  .section.metodologia .section-body {
    break-inside: auto;
    page-break-inside: auto;
  }
  .section.metodologia .section-body p,
  .section.metodologia .section-body li {
    orphans: 3;
    widows: 3;
  }
  .section.metodologia .section-body img {
    break-inside: avoid;
    page-break-inside: avoid;
    max-width: 100%;
    height: auto;
  }

  /* ── Objetos de Conhecimento ── */
  .objeto-item {
    margin-bottom: 3pt;
  }
  .objeto-comp {
    font-weight: bold;
    color: var(--texto-pri);
    text-transform: uppercase;
  }

  /* ── Habilidades ── */
  .hab-item {
    margin-bottom: 5pt;
    display: flex;
    gap: 4pt;
    align-items: flex-start;
  }
  .hab-bullet {
    color: var(--texto-sec);
    flex-shrink: 0;
    margin-top: 1pt;
  }
  .hab-code {
    font-weight: bold;
    color: var(--azul);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .hab-desc {
    color: var(--texto-sec);
  }

  /* ── Observação (itálico) ── */
  .obs-text {
    font-style: italic;
  }

  /* ── Metodologia HTML rico ── */
  .rich-html p { margin: 0 0 4pt; }
  .rich-html ul, .rich-html ol { margin: 0 0 4pt; padding-left: 18pt; }
  .rich-html li { margin-bottom: 2pt; }
  .rich-html img { max-width: 100%; height: auto; margin: 4pt 0; }
  .rich-html table { border-collapse: collapse; width: 100%; margin: 4pt 0; }
  .rich-html td, .rich-html th { border: 0.5pt solid #ccc; padding: 3pt 5pt; font-size: 8pt; }
`;

// ============================================================
// Render principal
// ============================================================

export function renderPlanoHtml(header: PlanHeader, dias: DiaData[]): string {
  const parts: string[] = [];

  parts.push(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>${CSS}</style>
</head>
<body>
`);

  // ── Header institucional ──
  if (header.instituicao) {
    const inst = header.instituicao;
    parts.push('<div class="inst-header">');
    if (inst.logoUrl) {
      parts.push(`<img class="logo" src="${esc(inst.logoUrl)}" alt="Logo" />`);
    }
    if (inst.prefeitura) {
      parts.push(`<div class="inst-line">${esc(inst.prefeitura)}</div>`);
    }
    if (inst.estado) {
      parts.push(`<div class="inst-line">${esc(inst.estado)}</div>`);
    }
    if (inst.secretaria) {
      parts.push(`<div class="inst-line">${esc(inst.secretaria)}</div>`);
    }
    parts.push('</div>');
  }

  // ── Título ──
  parts.push('<div class="main-title">PLANO DE AULA DO ENSINO FUNDAMENTAL</div>');
  parts.push('<hr class="divider">');

  // ── Metadados ──
  const periodoText = (() => {
    try {
      const inicio = formatDate(header.periodoInicio, 'dd');
      const fim = formatDate(header.periodoFim, "dd 'de' MMMM");
      return `${inicio} a ${fim}`;
    } catch {
      return `${header.periodoInicio} a ${header.periodoFim}`;
    }
  })();

  const anoEscolar = formatDate(header.periodoInicio, 'yyyy');

  const turmasFormatted = header.turmas
    .map(t => header.anoSerie ? `${header.anoSerie} ${t}` : t)
    .join(', ');

  parts.push(`
  <table class="meta-table">
    <tr>
      <td class="meta-label">Professor(a):</td>
      <td class="meta-value" colspan="3">${esc(header.professor)}</td>
    </tr>
    <tr>
      <td class="meta-label">Componente curricular:</td>
      <td class="meta-value" colspan="3">${esc(header.componentes.join(' / '))}</td>
    </tr>
    <tr>
      <td class="meta-label">Período de Execução:</td>
      <td class="meta-value">${esc(periodoText)}</td>
      <td class="meta-label">Ano escolar:</td>
      <td class="meta-value">${esc(anoEscolar)}</td>
    </tr>
    <tr>
      <td class="meta-label">Turma(s):</td>
      <td class="meta-value">${esc(turmasFormatted)}</td>
      <td class="meta-label">Turno(s):</td>
      <td class="meta-value">${esc(header.turno)}</td>
    </tr>
    <tr>
      <td class="meta-label">Escola:</td>
      <td class="meta-value" colspan="3">${esc(header.escola)}</td>
    </tr>
  </table>
  `);

  // ── Dias ──
  for (const dia of dias) {
    parts.push('<div class="day-block">');

    // Day header
    if (!dia.ocultar_data_pdf) {
      const dayDate = formatDate(dia.data_aula, "dd/MM/yyyy': 'EEEE");
      const tipoLabel = dia.tipo === 'Presencial' ? 'REGULAR' : dia.tipo;
      parts.push('<hr class="day-divider">');
      parts.push(`<div class="day-header">${esc(dayDate)} – ${esc(tipoLabel)}</div>`);
    }

    // Agrupar habilidades por componente
    const groups = groupByComponente(dia.habilidades);

    // ── Objetos de Conhecimento ──
    if (groups.length > 0 && groups.some(g => g.objetos.length > 0)) {
      parts.push('<div class="section">');
      parts.push('<div class="section-bar">Objeto(s) de Conhecimento</div>');
      parts.push('<div class="section-body">');
      for (const group of groups) {
        for (const objName of group.objetos) {
          parts.push('<div class="objeto-item">');
          if (group.componente && group.componente !== 'Geral') {
            parts.push(`<span class="objeto-comp">${esc(group.componente)}:</span> `);
          }
          parts.push(`${esc(objName)}`);
          parts.push('</div>');
        }
      }
      parts.push('</div></div>');
    }

    // ── Habilidades ──
    if (dia.habilidades.length > 0) {
      parts.push('<div class="section">');
      parts.push('<div class="section-bar">Habilidade(s)</div>');
      parts.push('<div class="section-body">');
      for (const hab of dia.habilidades) {
        parts.push('<div class="hab-item">');
        parts.push('<span class="hab-bullet">•</span>');
        parts.push(`<span class="hab-code">(${esc(hab.code)})</span>`);
        parts.push(`<span class="hab-desc">${esc(hab.description)}</span>`);
        parts.push('</div>');
      }
      parts.push('</div></div>');
    }

    // ── Procedimentos Metodológicos (HTML rico) ──
    if (dia.metodologia_html) {
      parts.push('<div class="section metodologia">');
      parts.push('<div class="section-bar">Procedimentos Metodológicos</div>');
      parts.push(`<div class="section-body rich-html">${dia.metodologia_html}</div>`);
      parts.push('</div>');
    }

    // ── Recursos Didáticos ──
    const allRecursos = [
      ...dia.recursos.map(r => r.name),
      ...(dia.outros_recursos
        ? dia.outros_recursos.split(/[\n|]{1,3}/).map(s => s.trim()).filter(Boolean)
        : []),
    ];
    if (allRecursos.length > 0) {
      parts.push('<div class="section">');
      parts.push('<div class="section-bar">Recursos Didáticos</div>');
      parts.push(`<div class="section-body">${esc(allRecursos.join(', '))}.</div>`);
      parts.push('</div>');
    }

    // ── Avaliação ──
    if (dia.avaliacao) {
      parts.push('<div class="section">');
      parts.push('<div class="section-bar">Avaliação</div>');
      parts.push(`<div class="section-body">${esc(dia.avaliacao)}</div>`);
      parts.push('</div>');
    }

    // ── Observação ──
    if (dia.observacoes) {
      parts.push('<div class="section">');
      parts.push('<div class="section-bar">Observação</div>');
      parts.push(`<div class="section-body obs-text">${esc(dia.observacoes)}</div>`);
      parts.push('</div>');
    }

    parts.push('</div>'); // .day-block
  }

  parts.push('</body></html>');
  return parts.join('\n');
}
