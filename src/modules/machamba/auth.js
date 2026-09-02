/**
 * Login do MachambaPro: email + password (texto simples). Tenant = companyId.
 */
import { neon } from '@neondatabase/serverless';
import { assinarToken } from '../../auth/index.js';

const sql = neon(process.env.MACHAMBA_DATABASE_URL);

export async function loginMachamba(email, password) {
  if (!email || !password) throw new Error('Email e password são obrigatórios');

  const user = await sql(
    `SELECT id, email, username, role, "companyId", password
     FROM "User"
     WHERE lower(email) = lower($1)
     ORDER BY id LIMIT 1`,
    [email]
  );
  const u = user[0];
  if (!u || u.password !== password) throw new Error('Credenciais inválidas');

  const company = await sql(`SELECT id, name FROM "Company" WHERE id = $1`, [u.companyId]);
  const c = company[0] || null;

  return {
    token: assinarToken(u.id, u.companyId),
    usuario: { id: u.id, email: u.email, nome: u.username, tipo_usuario: u.role },
    farmacia: c ? { id: c.id, nome: c.name } : { id: u.companyId, nome: 'MachambaPro' }
  };
}
