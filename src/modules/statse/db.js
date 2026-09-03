/**
 * Conexão SQL do StatsE (preguiçosa). Só inicializa o cliente Neon quando
 * é realmente usado, para que uma variável STATSE_DATABASE_URL ausente não
 * derrube o arranque da app inteira — o endpoint só falha se for chamado.
 */
import { neon } from '@neondatabase/serverless';

let client = null;

export function sqlStatse() {
  if (!process.env.STATSE_DATABASE_URL) {
    throw new Error('STATSE_DATABASE_URL não está configurada.');
  }
  if (!client) client = neon(process.env.STATSE_DATABASE_URL);
  return client;
}
