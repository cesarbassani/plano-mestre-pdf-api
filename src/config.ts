// ============================================================
// Config — Leitura e validação de variáveis de ambiente
// ============================================================

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Variável de ambiente obrigatória não definida: ${name}`);
    process.exit(1);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  apiSecret: requireEnv('API_SECRET'),
  frontendUrl: process.env.FRONTEND_URL || '*',
};
