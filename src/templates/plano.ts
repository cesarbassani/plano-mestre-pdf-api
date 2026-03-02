// ============================================================
// Template HTML — Plano de Aula
// ============================================================
// Reproduz FIELMENTE o layout do PDF atual (jsPDF).
// CSS @page + break-inside resolve problemas de paginação.
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

// ── Helper: agrupar por componente na ordem de primeira aparição ──
//
// Recebe habilidades já ordenadas por position.
// Agrupa por componente (ordem da 1ª aparição no array),
// dentro de cada componente agrupa por objeto (ordem da 1ª aparição),
// dentro de cada objeto mantém habilidades na ordem de position.
//
// Exemplo: position 0=Mat/Álgebra, 1=Ciências/Vida, 2=Mat/Geometria
// Resultado:
//   Matemática (1º componente a aparecer)
//     └─ Álgebra → EF01MA01
//     └─ Geometria → EF01MA05
//   Ciências (2º componente a aparecer)
//     └─ Vida → EF01CI01

interface ObjetoGroup {
  name: string;
  habilidades: HabilidadeData[];
}

interface ComponenteGroup {
  componente: string;
  objetos: ObjetoGroup[];
}

function groupByFirstAppearance(habilidades: HabilidadeData[]): ComponenteGroup[] {
  const compMap = new Map<string, ComponenteGroup>();
  const compOrder: string[] = [];

  for (const hab of habilidades) {
    const compName = hab.objeto?.componente?.name || 'Geral';
    const objName = hab.objeto?.name || '';

    // Componente: criar grupo se não existe (preserva ordem de 1ª aparição)
    if (!compMap.has(compName)) {
      compMap.set(compName, { componente: compName, objetos: [] });
      compOrder.push(compName);
    }
    const compGroup = compMap.get(compName)!;

    // Objeto: criar sub-grupo se não existe dentro do componente
    let objGroup = compGroup.objetos.find(o => o.name === objName);
    if (!objGroup) {
      objGroup = { name: objName, habilidades: [] };
      compGroup.objetos.push(objGroup);
    }

    // Habilidade: adicionar na ordem de position (já vem ordenada)
    objGroup.habilidades.push(hab);
  }

  // Retornar na ordem de primeira aparição
  return compOrder.map(name => compMap.get(name)!);
}

// ============================================================
// CSS — Replica fielmente o layout do PDF jsPDF atual
// ============================================================

const CSS = `
  /* ── Reset + @page ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4;
    margin: 16mm 15mm 16mm 15mm;
  }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    color: #333;
    background: #fff;
  }

  /* ── Header Institucional (centralizado) ── */
  .inst-header {
    text-align: center;
    margin-bottom: 6pt;
    break-inside: avoid;
  }
  .inst-header img.logo {
    max-height: 56pt;
    max-width: 56pt;
    margin-bottom: 6pt;
    display: block;
    margin-left: auto;
    margin-right: auto;
  }
  .inst-header .inst-line {
    font-size: 8.5pt;
    font-weight: bold;
    color: #333;
    line-height: 1.5;
    text-transform: uppercase;
  }

  /* ── Título principal ── */
  .main-title {
    text-align: center;
    font-size: 12pt;
    font-weight: bold;
    color: #333;
    padding: 14pt 0 8pt;
    break-after: avoid;
  }

  /* ── Linha divisória fina ── */
  .divider {
    border: none;
    border-top: 1pt solid #ccc;
    margin: 0 0 10pt;
  }

  /* ── Metadados ── */
  .meta-block {
    margin-bottom: 10pt;
    break-inside: avoid;
  }
  .meta-row {
    padding: 2pt 0;
    font-size: 10pt;
    line-height: 1.5;
  }
  .meta-row-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .meta-label {
    font-weight: bold;
    color: #333;
    margin-right: 4pt;
  }
  .meta-value {
    color: #444;
  }

  /* ── Day header (centralizado, bold) ── */
  .day-block {
    margin-top: 8pt;
  }
  .day-header {
    text-align: center;
    font-size: 10.5pt;
    font-weight: bold;
    color: #333;
    padding: 12pt 0 8pt;
    break-after: avoid;
  }

  /* ══════════════════════════════════════════════
     Seções — borda esquerda grossa + fundo cinza
     no header, borda fina ao redor do corpo
     ══════════════════════════════════════════════ */

  .section {
    margin-bottom: 8pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .section-bar {
    background-color: #F0F2F5;
    border-left: 3pt solid #9CA3AF;
    padding: 5pt 10pt;
    font-size: 10pt;
    font-weight: bold;
    color: #333;
    text-transform: uppercase;
    break-after: avoid;
  }

  .section-body {
    border: 0.5pt solid #DCE1E8;
    border-top: none;
    border-left: 3pt solid #E5E7EB;
    padding: 8pt 12pt;
    font-size: 10pt;
    color: #444;
    line-height: 1.55;
  }

  /* ── Metodologia: permitir quebra interna (conteúdo longo) ── */
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
    margin-bottom: 2pt;
    line-height: 1.5;
  }
  
  .section.objetos {
    break-inside: auto;
    page-break-inside: auto;
  }

  /* ── Habilidades ── */
  .hab-item {
    margin-bottom: 4pt;
    line-height: 1.5;
    text-align: justify;
  }
  .hab-code {
    font-weight: bold;
    color: #005A9C;
    white-space: nowrap;
  }
  .hab-desc {
    color: #444;
  }

  .section.habilidades {
    break-inside: auto;
    page-break-inside: auto;
  }

  /* ── Observação ── */
  .obs-text {
    font-style: normal;
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

  // ── Header institucional (logo + 3 linhas) ──
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

  // ── Metadados (ordem: Escola, Professor, Componente, Período+Ano, Turma+Turno) ──
  const periodoText = (() => {
    try {
      if (header.periodoInicio === header.periodoFim) {
        return formatDate(header.periodoInicio, 'dd/MM/yyyy');
      }
      const inicio = formatDate(header.periodoInicio, 'dd/MM');
      const fim = formatDate(header.periodoFim, 'dd/MM/yyyy');
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
  <div class="meta-block">
    <div class="meta-row">
      <span class="meta-label">Escola:</span>
      <span class="meta-value">${esc(header.escola)}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Professor(a):</span>
      <span class="meta-value">${esc(header.professor)}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Componente curricular:</span>
      <span class="meta-value">${esc(header.componentes.join(' / '))}</span>
    </div>
    <div class="meta-row meta-row-split">
      <span>
        <span class="meta-label">Período de Execução:</span>
        <span class="meta-value">${esc(periodoText)}</span>
      </span>
      <span>
        <span class="meta-label">Ano escolar:</span>
        <span class="meta-value">${esc(anoEscolar)}</span>
      </span>
    </div>
    <div class="meta-row meta-row-split">
      <span>
        <span class="meta-label">Turma(s):</span>
        <span class="meta-value">${esc(turmasFormatted)}</span>
      </span>
      <span>
        <span class="meta-label">Turno(s):</span>
        <span class="meta-value">${esc(header.turno)}</span>
      </span>
    </div>
  </div>
  `);

  parts.push('<hr class="divider">');

  // ── Dias ──
  for (const dia of dias) {
    parts.push('<div class="day-block">');

    // Day header: "27/02/2026: sexta-feira – REGULAR"
    /* TROCAR POR: */
    if (!dia.ocultar_data_pdf) {
      const dayFormatted = formatDate(dia.data_aula, "dd/MM/yyyy': 'EEEE");
      if (dia.tipo === 'Presencial') {
        parts.push(`<div class="day-header">${esc(dayFormatted)}</div>`);
      } else {
        parts.push(`<div class="day-header">${esc(dayFormatted)} – ${esc(dia.tipo.toUpperCase())}</div>`);
      }
    }

    // Agrupar por componente na ordem de primeira aparição (via position)
    const groups = groupByFirstAppearance(dia.habilidades);

    // ── Objetos de Conhecimento ──
    const hasObjetos = groups.some(g => g.objetos.some(o => o.name));
    if (hasObjetos) {
      parts.push('<div class="section objetos">');
      parts.push('<div class="section-bar">Objeto(s) de Conhecimento</div>');
      parts.push('<div class="section-body">');
      for (const group of groups) {
        for (const obj of group.objetos) {
          if (!obj.name) continue;
          if (group.componente && group.componente !== 'Geral') {
            parts.push(`<div class="objeto-item"><b>${esc(group.componente.toUpperCase())}:</b> ${esc(obj.name)}</div>`);
          } else {
            parts.push(`<div class="objeto-item">${esc(obj.name)}</div>`);
          }
        }
      }
      parts.push('</div></div>');
    }

    // ── Habilidades (agrupadas por componente, na ordem de position) ──
    if (dia.habilidades.length > 0) {
      parts.push('<div class="section habilidades">');
      parts.push('<div class="section-bar">Habilidade(s)</div>');
      parts.push('<div class="section-body">');
      for (const group of groups) {
        for (const obj of group.objetos) {
          for (const hab of obj.habilidades) {
            parts.push('<div class="hab-item">');
            parts.push(`<span class="hab-code">(${esc(hab.code)})</span> `);
            parts.push(`<span class="hab-desc">${esc(hab.description)}</span>`);
            parts.push('</div>');
          }
        }
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