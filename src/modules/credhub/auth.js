/**
 * Login do CredHubMZ: nome do tenant + password (texto simples).
 * O tenant dá acesso ao schema próprio onde vivem os seus dados.
 */
import { neon } from '@neondatabase/serverless';
import { assinarToken } from '../../auth/index.js';

const sql = neon(process.env.CREDHUB_DATABASE_URL);

export async function loginCredhub(tenant, password) {
  if (!tenant || !password) throw new Error('Tenant e password são obrigatórios');

  const t = await sql(
    `SELECT id, name, schema_name, status, license_tier, password
     FROM tenants
     WHERE lower(name) = lower($1) AND status = 'active'
     ORDER BY id LIMIT 1`,
    [tenant]
  );
  const row = t[0];
  if (!row || row.password !== password) throw new Error('Credenciais inválidas');

  return {
    token: assinarToken(row.id, row.id),
    usuario: { id: row.id, email: row.name, nome: row.name, tipo_usuario: 'tenant' },
    farmacia: { id: row.id, nome: row.name },
    tenant: { schema: row.schema_name, license_tier: row.license_tier }
  };
}
