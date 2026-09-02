/**
 * Login do Smart Warehouse WMS. Password guardada como SHA-256 hex.
 * O tenant é a própria empresa (user_id do utilizador).
 */
import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { assinarToken } from '../../auth/index.js';

const sql = neon(process.env.ARMAZEM_DATABASE_URL);

export async function loginArmazem(email, password) {
  if (!email || !password) throw new Error('Email e password são obrigatórios');

  const user = await sql(
    `SELECT id, email, company_name, role, password_hash
     FROM users
     WHERE lower(email) = lower($1)
     ORDER BY id LIMIT 1`,
    [email]
  );
  const u = user[0];
  if (!u) throw new Error('Credenciais inválidas');

  const hash = createHash('sha256').update(String(password)).digest('hex');
  if (u.password_hash !== hash) throw new Error('Credenciais inválidas');

  return {
    token: assinarToken(u.id, u.id), // fid = user_id (a própria empresa)
    usuario: { id: u.id, email: u.email, nome: u.company_name, tipo_usuario: u.role },
    farmacia: { id: u.id, nome: u.company_name }
  };
}
