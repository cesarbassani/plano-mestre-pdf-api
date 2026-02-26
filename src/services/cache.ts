// ============================================================
// Cache — Cache em memória para URLs assinadas de PDFs
// ============================================================
// Estratégia: hash dos dados do plano como chave.
// Se os dados não mudaram, retorna a URL cacheada.
// Se mudaram (hash diferente), invalida e regenera.
// TTL padrão: 50 minutos (signed URL dura 60 min).
// ============================================================

import * as crypto from 'crypto';

interface CacheEntry {
  url: string;
  hash: string;
  createdAt: number;
  sizeKb: number;
}

const cache = new Map<string, CacheEntry>();

// 50 min (menor que 60 min da signed URL)
const DEFAULT_TTL_MS = 50 * 60 * 1000;

// Limite de entradas para evitar memory leak
const MAX_ENTRIES = 500;

/**
 * Gera hash SHA-256 de uma string (dados serializados do plano).
 */
export function computeHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/**
 * Busca URL cacheada para um plano.
 * Retorna a URL se cache válido (mesmo hash + TTL não expirado).
 * Retorna null se cache inexistente, expirado ou dados mudaram.
 */
export function getCachedUrl(planoId: string, currentHash: string): string | null {
  const entry = cache.get(planoId);

  if (!entry) return null;

  // Hash diferente → dados do plano mudaram
  if (entry.hash !== currentHash) {
    cache.delete(planoId);
    return null;
  }

  // TTL expirado
  const age = Date.now() - entry.createdAt;
  if (age > DEFAULT_TTL_MS) {
    cache.delete(planoId);
    return null;
  }

  return entry.url;
}

/**
 * Armazena URL no cache.
 */
export function setCachedUrl(
  planoId: string,
  url: string,
  hash: string,
  sizeKb: number
): void {
  // Evicção se atingir limite (remove o mais antigo)
  if (cache.size >= MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    if (oldestKey) cache.delete(oldestKey);
  }

  cache.set(planoId, {
    url,
    hash,
    createdAt: Date.now(),
    sizeKb,
  });
}

/**
 * Invalida cache de um plano específico.
 */
export function invalidateCache(planoId: string): boolean {
  return cache.delete(planoId);
}

/**
 * Retorna estatísticas do cache.
 */
export function getCacheStats(): {
  entries: number;
  maxEntries: number;
  ttlMinutes: number;
} {
  // Limpar expirados antes de retornar stats
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.createdAt > DEFAULT_TTL_MS) {
      cache.delete(key);
    }
  }

  return {
    entries: cache.size,
    maxEntries: MAX_ENTRIES,
    ttlMinutes: DEFAULT_TTL_MS / 60000,
  };
}
