/**
 * ═══════════════════════════════════════════════════════════════════
 *  AUTENTICAÇÃO — acesso à IA da farmácia por credencial.
 *  - Verifica password no formato Django (pbkdf2_sha256) sem dependências.
 *  - Emite/valida token assinado (HMAC) para sessão sem estado.
 *  - Resolve a farmácia do utilizador (farmacias_farmacia.usuario_id).
 * ═══════════════════════════════════════════════════════════════════
 */
import { pbkdf2Sync, createHmac, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.FARMACIA_DATABASE_URL);

const SEGREDO = process.env.AUTH_SECRET;
const TOKEN_HORAS = Number(process.env.AUTH_TOKEN_HORAS || 12);

function normalizarBase64(b64) {
  return Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// hash Django: pbkdf2_sha256$iterations$salt$hash
export function verificarPasswordDjango(password, hashArmazenado) {
  if (!password || !hashArmazenado) return false;
  const partes = String(hashArmazenado).split('$');
  if (partes.length !== 4 || partes[0] !== 'pbkdf2_sha256') return false;
  const [, iteracoes, saltB64, hashB64] = partes;
  const salt = normalizarBase64(saltB64);
  const hashEsperado = normalizarBase64(hashB64);
  const derivado = pbkdf2Sync(password, salt, Number(iteracoes), hashEsperado.length, 'sha256');
  return derivado.length === hashEsperado.length && timingSafeEqual(derivado, hashEsperado);
}

// ── Token assinado (sem estado) ─────────────────────────────────────
export function assinarToken(usuarioId, farmaciaId) {
  const payload = Buffer.from(JSON.stringify({
    uid: usuarioId, fid: farmaciaId, exp: Date.now() + TOKEN_HORAS * 3600e3
  })).toString('base64url');
  const assinatura = createHmac('sha256', SEGREDO).update(payload).digest('base64url');
  return `${payload}.${assinatura}`;
}

export function validarToken(token) {
  if (!token) return null;
  const [payload, assinatura] = String(token).split('.');
  if (!payload || !assinatura) return null;
  const esperado = createHmac('sha256', SEGREDO).update(payload).digest('base64url');
  const a = Buffer.from(assinatura); const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const dados = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (Date.now() > dados.exp) return null;
    return { usuarioId: dados.uid, farmaciaId: dados.fid };
  } catch { return null; }
}

/**
 * Login: email/telefone + password. Devolve utilizador + farmácia ou lança erro.
 */
export async function login(emailOuTelefone, password) {
  const credencial = String(emailOuTelefone || '').trim().toLowerCase();
  if (!credencial || !password) throw new Error('Email/telefone e password são obrigatórios');

  const utilizador = await sql(
    `SELECT id, email, telefone, password, tipo_usuario, is_active, first_name, last_name
     FROM accounts_user
     WHERE lower(email) = $1 OR telefone = $2`,
    [credencial, credencial]
  );

  if (utilizador.length === 0 || !verificarPasswordDjango(password, utilizador[0].password)) {
    throw new Error('Credenciais inválidas');
  }
  const u = utilizador[0];
  if (!u.is_active) throw new Error('Utilizador inativo');

  // farmácia do utilizador (multi-tenant): dono = farmacias_farmacia.usuario_id
  const farmacia = await sql(
    `SELECT id, nome, nome_fantasia FROM farmacias_farmacia WHERE usuario_id = $1 AND is_ativa = true`,
    [u.id]
  );
  const f = farmacia[0] || null;

  return {
    token: assinarToken(u.id, f ? f.id : null),
    usuario: { id: u.id, email: u.email, tipo_usuario: u.tipo_usuario, nome: `${u.first_name} ${u.last_name}`.trim() },
    farmacia: f ? { id: f.id, nome: f.nome, nome_fantasia: f.nome_fantasia } : null
  };
}

/** Extrai o contexto autenticado de um pedido HTTP; null se não autorizado. */
export function contextoDoPedido(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  return validarToken(token);
}
