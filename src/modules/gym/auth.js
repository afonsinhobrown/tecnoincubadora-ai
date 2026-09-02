/**
 * Login do GYMAR/HefelGym. Password em texto simples na BD.
 * Multi-tenant por ginásio (`gym_id`).
 */
import { neon } from '@neondatabase/serverless';
import { assinarToken } from '../../auth/index.js';

const sql = neon(process.env.GYMAR_DATABASE_URL);

export async function loginGym(email, password) {
  if (!email || !password) throw new Error('Email e password são obrigatórios');

  const user = await sql(
    `SELECT id, email, name, role, gym_id, password
     FROM system_users
     WHERE lower(email) = lower($1) AND status = 'active'
     ORDER BY id LIMIT 1`,
    [email]
  );
  const u = user[0];
  if (!u || !u.password) throw new Error('Credenciais inválidas');

  if (u.password !== password) throw new Error('Credenciais inválidas');

  const gym = await sql(`SELECT id, name FROM gyms WHERE id = $1`, [u.gym_id]);
  const g = gym[0] || null;

  return {
    token: assinarToken(u.id, u.gym_id),
    usuario: { id: u.id, email: u.email, nome: u.name, tipo_usuario: u.role },
    farmacia: g ? { id: g.id, nome: g.name } : { id: u.gym_id, nome: 'Ginásio' }
  };
}
