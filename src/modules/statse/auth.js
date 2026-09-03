/**
 * ═══════════════════════════════════════════════════════════════════
 *  StatsE — login. As credenciais vivem na tabela `usuarios` da BD
 *  `analise_db` com password hashes nos formatos Werkzeug/Flask:
 *   - scrypt:  `scrypt:N:r:p$salt$hash(hex)`   (ex. admin)
 *   - pbkdf2:  `pbkdf2:sha256:iter$salt$hash(hex)` (operadores)
 *   - md5 (hex, fallback)
 * ═══════════════════════════════════════════════════════════════════
 */
import { scryptSync, pbkdf2Sync, createHash, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { assinarToken } from '../../auth/index.js';

const sql = neon(process.env.STATSE_DATABASE_URL);

function compararHex(a, b) {
  const ha = Buffer.from(a, 'hex');
  const hb = Buffer.from(b, 'hex');
  if (ha.length !== hb.length) return false;
  return timingSafeEqual(ha, hb);
}

function verificarPw(password, armazenado) {
  if (!armazenado) return false;
  const hash = String(armazenado);

  if (hash.startsWith('scrypt:')) {
    // scrypt:N:r:p$salt$hash
    const pref = hash.split('$')[0];           // "scrypt:N:r:p"
    const [, salt, hashval] = hash.split('$');
    const [, nStr, rStr, pStr] = pref.split(':');
    const n = Number(nStr), r = Number(rStr), p = Number(pStr);
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p)) return false;
    try {
      const maxmem = 132 * n * r * p;
      const derivado = scryptSync(password, Buffer.from(salt, 'utf8'), 64, { N: n, r, p, maxmem });
      return compararHex(derivado.toString('hex'), hashval);
    } catch {
      return false;
    }
  }

  if (hash.startsWith('pbkdf2:')) {
    const [, algIter, salt, hashval] = hash.split('$');
    const [, alg, iterStr] = algIter.split(':');
    const iteracoes = Number(iterStr);
    if (!Number.isSafeInteger(iteracoes) || !salt || !hashval) return false;
    try {
      const derivado = pbkdf2Sync(password, Buffer.from(salt, 'utf8'), iteracoes, 32, alg || 'sha256');
      return compararHex(derivado.toString('hex'), hashval);
    } catch {
      return false;
    }
  }

  // md5 hex
  const md5 = createHash('md5').update(String(password)).digest('hex');
  return compararHex(md5, hash);
}

export async function loginStatse(username, password) {
  if (!username || !password) throw new Error('Utilizador e password são obrigatórios');

  const user = await sql(
    `SELECT id, username, password_hash, role, provincia_vinculada
     FROM usuarios WHERE lower(username) = lower($1) ORDER BY id LIMIT 1`,
    [username]
  );
  const u = user[0];
  if (!u || !verificarPw(password, u.password_hash)) throw new Error('Credenciais inválidas');

  const provincia = u.provincia_vinculada || null;

  return {
    token: assinarToken(u.id, u.id),
    usuario: { id: u.id, email: u.username, nome: u.username, tipo_usuario: u.role },
    farmacia: provincia
      ? { id: u.id, nome: provincia }
      : { id: u.id, nome: 'StatsE' }
  };
}
