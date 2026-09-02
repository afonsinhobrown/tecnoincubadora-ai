/**
 * Login do Xonguile com as credenciais do sistema (password em texto
 * simples na BD). Devolve token + salão do utilizador.
 */
import { neon } from '@neondatabase/serverless';
import { assinarToken } from '../../auth/index.js';

const sql = neon(process.env.XONGUILE_DATABASE_URL);

export async function loginXonguile(email, password) {
  if (!email || !password) throw new Error('Email e password são obrigatórios');

  const user = await sql(
    `SELECT u.id, u.name, u.email, u.role, u."SalonId", s.name AS salon_nome, s.slug
     FROM "Users" u
     LEFT JOIN "Salons" s ON s.id = u."SalonId"
     WHERE lower(u.email) = lower($1) AND u."SalonId" IS NOT NULL
     ORDER BY u.id LIMIT 1`,
    [email]
  );
  const u = user[0];
  if (!u) throw new Error('Credenciais inválidas');

  const row = await sql(`SELECT password FROM "Users" WHERE id = $1`, [u.id]);
  if (!row[0] || row[0].password !== password) throw new Error('Credenciais inválidas');

  return {
    token: assinarToken(u.id, u.SalonId),
    usuario: { id: u.id, email: u.email, nome: u.name, tipo_usuario: u.role },
    farmacia: { id: u.SalonId, nome: u.salon_nome }
  };
}
