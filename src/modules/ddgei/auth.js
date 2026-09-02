/**
 * Login do DDGEI. Password em dois formatos na BD:
 *  - pbkdf2 Werkzeug: `pbkdf2:sha256:600000$salt(b64)$hash(hex)`
 *  - pbkdf2 Django: `pbkdf2_sha256$iterations$salt$hash(base64)`
 *  - MD5 hex (32 chars)
 */
import { pbkdf2Sync, createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { assinarToken } from '../../auth/index.js';

const sql = neon(process.env.DDGEI_DATABASE_URL);

function verificarPw(password, armazenado) {
  if (!armazenado) return false;
  const hash = String(armazenado);

  if (hash.startsWith('pbkdf2:')) {
    const partes = hash.split('$');
    if (partes.length !== 3) return false;
    const [algoritmo, saltB64, hashHex] = partes;
    const [, digest, iteracoes] = algoritmo.split(':');
    if (digest !== 'sha256' || !Number.isSafeInteger(Number(iteracoes))) return false;
    const salt = Buffer.from(saltB64, 'base64');
    const derivado = pbkdf2Sync(password, salt, Number(iteracoes), 32, 'sha256');
    return derivado.toString('hex') === hashHex;
  }

  if (hash.startsWith('pbkdf2_sha256$')) {
    const partes = hash.split('$');
    if (partes.length !== 4) return false;
    const [, iteracoes, salt, hashB64] = partes;
    const tamanhoHash = Buffer.from(hashB64, 'base64').length;
    if (!Number.isSafeInteger(Number(iteracoes)) || !salt || !tamanhoHash) return false;
    const derivado = pbkdf2Sync(password, salt, Number(iteracoes), tamanhoHash, 'sha256');
    return derivado.toString('base64') === hashB64;
  }

  // MD5 hex
  return createHash('md5').update(String(password)).digest('hex') === hash;
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
