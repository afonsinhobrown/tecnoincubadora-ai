/**
 * ═══════════════════════════════════════════════════════════════════
 *  StatsE — decifra dos valores de votação (Fernet + PBKDF2).
 *  A BD `analise_db` guarda os números de votação cifrados com Fernet;
 *  a chave é derivada de uma password via PBKDF2-HMAC-SHA256
 *  (salt estático, 100000 iterações). Implementação com crypto nativo.
 * ═══════════════════════════════════════════════════════════════════
 */
import { pbkdf2Sync, createHmac, createDecipheriv } from 'node:crypto';

const SALT = Buffer.from('sal_estatico_para_eleicoes');
const ITERACOES = 100000;

// Password que gera a chave Fernet (fonte de verdade no app original).
const PASSWORDS = [
  process.env.STATSE_KEY_PASSWORD || 'pandorinhabox5229'
];

function chaveFernet(password) {
  const deriv = pbkdf2Sync(password, SALT, ITERACOES, 32, 'sha256');
  return Buffer.from(deriv.toString('base64'), 'base64');
}

const CHAVES = PASSWORDS
  .filter(Boolean)
  .map(pw => ({ pw, key: chaveFernet(pw) }));

function b64url(s) {
  return Buffer.from(s, 'base64url');
}

/**
 * Decifra um token Fernet para string. Devolve null se não for válido.
 */
export function decifrar(token) {
  if (!token) return null;
  const val = String(token).trim();
  if (!val || !val.startsWith('gAAAAA')) return null;

  const data = b64url(val);
  if (data.length < 9 + 16 + 16 + 32) return null;

  const payload = data.subarray(0, data.length - 32);
  const receivedHmac = data.subarray(data.length - 32);
  const iv = payload.subarray(9, 25);
  const ciphertext = payload.subarray(25);

  for (const { key } of CHAVES) {
    const encKey = key.subarray(16, 32);
    const sigKey = key.subarray(0, 16);
    const hmac = createHmac('sha256', sigKey).update(payload).digest();
    if (!hmac.equals(receivedHmac)) continue;
    try {
      const decipher = createDecipheriv('aes-128-cbc', encKey, iv);
      const out = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      const texto = out.toString('utf8');
      // valores legítimos podem ter separador no início quando são somas
      return texto.trim();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Converte o valor decifrado para número inteiro (0 se inválido/vazio).
 */
export function decifrarInt(token) {
  const v = decifrar(token);
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/\D/g, ''));
  return Number.isFinite(n) ? n : 0;
}
