/**
 * Login do DDGEI. Password em dois formatos na BD:
 *  - pbkdf2 Werkzeug: `pbkdf2:sha256:600000$salt(b64)$hash(hex)`
 *  - MD5 hex (32 chars)
 */
import { pbkdf2Sync, createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { assinarToken } from '../../auth/index.js';

const sql = neon(process.env.DDGEI_DATABASE_URL);

function verificarPw(password, armazenado) {
  if (!armazenado) return false;
  if (String(armazenado).startsWith('pbkdf2:')) {
    const partes = String(armazenado).split('$');
    if (partes.length !== 3) return false;
    const [, saltB64, hashHex] = partes;
    const salt = Buffer.from(saltB64, 'base64');
    const derivado = pbkdf2Sync(password, salt, 600000, 32, 'sha256');
    return derivado.toString('hex') === hashHex;
  }
  // MD5 hex
  return createHash('md5').update(String(password)).digest('hex') === armazenado;
}

export async function loginDdgei(username, password) {
  if (!username || !password) throw new Error('Utilizador e password são obrigatórios');

  const user = await sql(
    `SELECT id, username, nome_completo, perfil, password, setor_id
     FROM users WHERE lower(username) = lower($1) ORDER BY id LIMIT 1`,
    [username]
  );
  const u = user[0];
  if (!u || !verificarPw(password, u.password)) throw new Error('Credenciais inválidas');

  const setor = u.setor_id
    ? (await sql(`SELECT id, nome FROM setores WHERE id = $1`, [u.setor_id]))[0] || null
    : null;

  return {
    token: assinarToken(u.id, u.id),
    usuario: { id: u.id, email: u.username, nome: u.nome_completo || u.username, tipo_usuario: u.perfil },
    farmacia: setor ? { id: setor.id, nome: setor.nome } : { id: u.id, nome: 'DDGEI' }
  };
}
