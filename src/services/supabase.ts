// ============================================================
// Supabase Client — service_role (bypassa RLS)
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

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
// fetchPlanoData — Será implementado na Etapa 6
// ============================================================
// Aqui ficará a query que busca todos os dados de um plano
// e retorna { header: PlanHeader, dias: DiaData[] }
