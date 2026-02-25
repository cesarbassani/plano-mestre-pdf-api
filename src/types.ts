// ============================================================
// Types — Interfaces do Plano Mestre
// ============================================================
// Estas interfaces espelham as que o frontend usa no generatePdf.ts

export interface HabilidadeData {
  code: string;
  description: string;
  objeto?: {
    name: string;
    componente?: { name: string } | null;
  } | null;
}

export interface RecursoData {
  name: string;
}

export interface DiaData {
  data_aula: string;
  tipo: string;
  metodologia_html: string | null;
  avaliacao: string | null;
  observacoes: string | null;
  outros_recursos: string | null;
  habilidades: HabilidadeData[];
  recursos: RecursoData[];
}

export interface PlanHeader {
  escola: string;
  professor: string;
  componentes: string[];
  periodoInicio: string;
  periodoFim: string;
  anoSerie: string;
  turmas: string[];
  turno: string;
}
