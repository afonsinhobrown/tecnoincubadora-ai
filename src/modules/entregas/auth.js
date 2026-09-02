/**
 * Login do EntregasMOZ: email + password (bcrypt). O tenant depende do
 * papel: admin vê tudo; provider/loja vê as suas encomendas/produtos.
 */
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { assinarToken } from '../../auth/index.js';

const sql = neon(process.env.ENTREGAS_DATABASE_URL);

export async function loginEntregas(email, password) {
  if (!email || !password) throw new Error('Email e password são obrigatórios');

  const user = await sql(
    `SELECT id, name, email, password, "userType", "isActive"
     FROM "User"
     WHERE lower(email) = lower($1) AND "isActive" = true
     ORDER BY id LIMIT 1`,
    [email]
  );
  const u = user[0];
  if (!u || !bcrypt.compareSync(password, u.password)) throw new Error('Credenciais inválidas');

  let providerId = null;
  if (u.userType === 'PROVIDER') {
    const p = await sql(`SELECT id FROM "Provider" WHERE "userId" = $1 LIMIT 1`, [u.id]);
    providerId = p[0]?.id || null;
  }

  // tenantId: para provider é o próprio provider; caso contrário o user id
  const tenantId = providerId || u.id;

  return {
    token: assinarToken(u.id, tenantId),
    usuario: { id: u.id, email: u.email, nome: u.name, tipo_usuario: u.userType },
    farmacia: { id: tenantId, nome: u.name },
    providerId,
    userType: u.userType
  };
}
