/**
 * Login do SmartschoolMZ: email + senha (bcrypt). Tenant = escolaId.
 */
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { assinarToken } from '../../auth/index.js';

const sql = neon(process.env.SMARTSCHOOL_DATABASE_URL);

export async function loginSmartschool(email, password) {
  if (!email || !password) throw new Error('Email e password são obrigatórios');

  const user = await sql(
    `SELECT id, nome, apelido, email, senha, tipo, ativo, "escolaId"
     FROM "Usuario"
     WHERE lower(email) = lower($1) AND ativo = true
     ORDER BY id LIMIT 1`,
    [email]
  );
  const u = user[0];
  if (!u || !bcrypt.compareSync(password, u.senha)) throw new Error('Credenciais inválidas');
  if (!u.escolaId) throw new Error('Utilizador sem escola associada.');

  const escola = await sql(`SELECT id, nome FROM "Escola" WHERE id = $1`, [u.escolaId]);
  const e = escola[0] || null;

  return {
    token: assinarToken(u.id, u.escolaId),
    usuario: { id: u.id, email: u.email, nome: `${u.nome} ${u.apelido}`.trim(), tipo_usuario: u.tipo },
    farmacia: e ? { id: e.id, nome: e.nome } : { id: u.escolaId, nome: 'Escola' }
  };
}
