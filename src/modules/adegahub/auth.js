/**
 * Login do ADEGAHUB: email + password (bcrypt). Multi-tenant por tenant_id.
 */
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { assinarToken } from '../../auth/index.js';

const sql = neon(process.env.ADEGAHUB_DATABASE_URL);

export async function loginAdegahub(email, password) {
  if (!email || !password) throw new Error('Email e password são obrigatórios');

  const user = await sql(
    `SELECT id, email, full_name, role, tenant_id, store_id, password_hash, is_active
     FROM users
     WHERE lower(email) = lower($1) AND is_active = true
     ORDER BY created_at LIMIT 1`,
    [email]
  );
  const u = user[0];
  if (!u || !bcrypt.compareSync(password, u.password_hash)) throw new Error('Credenciais inválidas');

  const tenant = await sql(`SELECT id, name, subdomain FROM tenants WHERE id = $1`, [u.tenant_id]);
  const t = tenant[0] || null;

  return {
    token: assinarToken(u.id, u.tenant_id),
    usuario: { id: u.id, email: u.email, nome: u.full_name, tipo_usuario: u.role },
    farmacia: t ? { id: t.id, nome: t.name || t.subdomain } : { id: u.tenant_id, nome: 'AdegaHub' }
  };
}
