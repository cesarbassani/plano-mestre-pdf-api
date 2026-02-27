// ============================================================
// Supabase Client + Query de dados do plano
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import {
  PlanoResult,
  PlanHeader,
  DiaData,
  HabilidadeData,
  RecursoData,
  InstituicaoData,
} from '../types';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}

// ============================================================
// fetchPlanoData — Busca todos os dados de um plano
// ============================================================

export async function fetchPlanoData(planoId: string, diaIds?: string[]): Promise<PlanoResult> {
  const supabase = getSupabaseClient();

  // ── 1. Planejamento principal + escola + componentes + turmas ──

  const { data: planInfo, error: planError } = await supabase
    .from('planejamentos')
    .select(`
      *,
      escola:escolas(name),
      componentes:planejamentos_componentes(
        componente:componentes_curriculares(name)
      ),
      turmas_rel:planejamentos_turmas(
        turma:turmas(name)
      )
    `)
    .eq('id', planoId)
    .single();

  if (planError || !planInfo) {
    throw new Error(`Plano não encontrado: ${planError?.message || 'ID inválido'}`);
  }

  // ── 2. Perfil do professor ──

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', planInfo.user_id)
    .single();

  // ── 3. Instituição ──

  const { data: instituicao } = await supabase
    .from('instituicao_config')
    .select('logo_url, prefeitura, estado, secretaria')
    .eq('user_id', planInfo.user_id)
    .single();

  // ── 4. Dias do planejamento (filtrar por dia_ids se fornecido) ──

  let diasQuery = supabase
    .from('dias_planejamento')
    .select('*')
    .eq('planejamento_id', planoId);

  if (diaIds && diaIds.length > 0) {
    diasQuery = diasQuery.in('id', diaIds);
  }

  const { data: dias, error: diasError } = await diasQuery
    .order('data_aula', { ascending: true });

  if (diasError) {
    throw new Error(`Erro ao buscar dias: ${diasError.message}`);
  }

  // ── 5. Para cada dia, buscar habilidades e recursos ──

  const diasData: DiaData[] = await Promise.all(
    (dias || []).map(async (dia: any) => {
      // Habilidades com joins
      const { data: habsRaw } = await supabase
        .from('dias_habilidades')
        .select(`
          habilidade:habilidades(
            id, code, description,
            objeto:objetos_conhecimento(
              id, name,
              componente:componentes_curriculares(name)
            )
          )
        `)
        .eq('dia_id', dia.id);

      // Recursos
      const { data: recsRaw } = await supabase
        .from('dias_recursos')
        .select('recurso:recursos_catalogo(id, name)')
        .eq('dia_id', dia.id);

      // Mapear habilidades
      const habilidades: HabilidadeData[] = (habsRaw || [])
        .map((row: any) => row.habilidade)
        .filter(Boolean)
        .map((h: any) => ({
          code: h.code || '',
          description: h.description || '',
          objeto: h.objeto
            ? {
                name: h.objeto.name || '',
                componente: h.objeto.componente || null,
              }
            : null,
        }));

      // Mapear recursos
      const recursos: RecursoData[] = (recsRaw || [])
        .map((row: any) => row.recurso)
        .filter(Boolean)
        .map((r: any) => ({ name: r.name || '' }));

      return {
        data_aula: dia.data_aula,
        tipo: dia.tipo || 'Presencial',
        metodologia_html: dia.metodologia_html || null,
        avaliacao: dia.avaliacao || null,
        observacoes: dia.observacoes || null,
        outros_recursos: dia.outros_recursos || null,
        ocultar_data_pdf: dia.ocultar_data_pdf || false,
        habilidades,
        recursos,
      };
    })
  );

  // ── 6. Montar PlanHeader ──

  const instituicaoData: InstituicaoData | null = instituicao
    ? {
        logoUrl: instituicao.logo_url || null,
        prefeitura: instituicao.prefeitura || null,
        estado: instituicao.estado || null,
        secretaria: instituicao.secretaria || null,
      }
    : null;

  const header: PlanHeader = {
    escola: planInfo.escola?.name || '',
    professor: profile?.full_name || '',
    componentes: (planInfo.componentes || [])
      .map((c: any) => c.componente?.name)
      .filter(Boolean),
    periodoInicio: planInfo.periodo_inicio || '',
    periodoFim: planInfo.periodo_fim || '',
    anoSerie: planInfo.ano_serie || '',
    turmas: (planInfo.turmas_rel || [])
      .map((t: any) => t.turma?.name)
      .filter(Boolean),
    turno: planInfo.turno || '',
    instituicao: instituicaoData,
  };

  return { header, dias: diasData };
}
