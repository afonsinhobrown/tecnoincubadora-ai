/**
 * Login do BrokerHubMZ: email + password (bcrypt). Tenant = tenant_id.
 */
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { assinarToken } from '../../auth/index.js';

const sql = neon(process.env.BROKERHUB_DATABASE_URL);

export async function loginBrokerhub(email, password) {
  if (!email || !password) throw new Error('Email e password são obrigatórios');

  const user = await sql(
    `SELECT id, username, email, tenant_id, tipo, password_hash
     FROM utilizadores
     WHERE lower(email) = lower($1) AND estado = 'ATIVO'
     ORDER BY created_at LIMIT 1`,
    [email]
  );
  const u = user[0];
  if (!u || !bcrypt.compareSync(password, u.password_hash)) throw new Error('Credenciais inválidas');

  const tenant = await sql(
    `SELECT id, codigo, nome_comercial FROM tenants WHERE id = $1`,
    [u.tenant_id]
  );
  const t = tenant[0] || null;

  return {
    token: assinarToken(u.id, u.tenant_id),
    usuario: { id: u.id, email: u.email, nome: u.username, tipo_usuario: u.tipo },
    farmacia: t ? { id: t.id, nome: t.nome_comercial || t.codigo } : { id: u.tenant_id, nome: 'BrokerHub' }
  };
}
