// ============================================================
// Types — Interfaces do Plano Mestre
// ============================================================

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
  ocultar_data_pdf?: boolean;
  habilidades: HabilidadeData[];
  recursos: RecursoData[];
}

export interface InstituicaoData {
  logoUrl?: string | null;
  prefeitura?: string | null;
  estado?: string | null;
  secretaria?: string | null;
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
  instituicao?: InstituicaoData | null;
}

export interface PlanoResult {
  header: PlanHeader;
  dias: DiaData[];
}
