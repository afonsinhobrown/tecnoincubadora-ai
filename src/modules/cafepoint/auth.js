/**
 * Login do CAFÉPOINT com as credenciais do sistema (password bcrypt).
 * Autenticação por `username`; devolve token + restaurante do utilizador.
 */
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { assinarToken } from '../../auth/index.js';

const sql = neon(process.env.CAFEPOINT_DATABASE_URL);

export async function loginCafepoint(usuario, password) {
  if (!usuario || !password) throw new Error('Utilizador e password são obrigatórios');

  const user = await sql(
    `SELECT u.id, u.username, u.name, u.role, u."restaurantId", r.name AS rest_nome, r.slug
     FROM "User" u
     LEFT JOIN "Restaurant" r ON r.id = u."restaurantId"
     WHERE lower(u.username) = lower($1) AND u."restaurantId" IS NOT NULL
     ORDER BY u.id LIMIT 1`,
    [usuario]
  );
  const u = user[0];
  if (!u) throw new Error('Credenciais inválidas');

  const row = await sql(`SELECT password FROM "User" WHERE id = $1`, [u.id]);
  if (!row[0] || !bcrypt.compareSync(password, row[0].password)) {
    throw new Error('Credenciais inválidas');
  }

  return {
    token: assinarToken(u.id, u.restaurantId),
    usuario: { id: u.id, email: u.username, nome: u.name, tipo_usuario: u.role },
    farmacia: { id: u.restaurantId, nome: u.rest_nome }
  };
}
