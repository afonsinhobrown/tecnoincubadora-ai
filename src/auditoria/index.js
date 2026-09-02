import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.FARMACIA_DATABASE_URL);

export async function initAuditoria() {
  await sql(`
    CREATE TABLE IF NOT EXISTS tecno_auditoria (
      id serial PRIMARY KEY,
      sistema_slug text NOT NULL,
      tenant_id text NOT NULL,
      tenant_nome text,
      usuario_id text,
      usuario_nome text,
      usuario_email text,
      query text NOT NULL,
      modo text,
      plano text,
      licenca_status text,
      ip text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await sql(`CREATE INDEX IF NOT EXISTS idx_auditoria_sistema_tenant ON tecno_auditoria(sistema_slug, tenant_id)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_auditoria_created ON tecno_auditoria(created_at DESC)`);
}

export async function registrarAuditoria({ sistemaSlug, tenantId, tenantNome, usuarioId, usuarioNome, usuarioEmail, query, modo, plano, licencaStatus, ip }) {
  await initAuditoria();
  await sql(`
    INSERT INTO tecno_auditoria (sistema_slug, tenant_id, tenant_nome, usuario_id, usuario_nome, usuario_email, query, modo, plano, licenca_status, ip)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  `, [sistemaSlug, tenantId, tenantNome||'', usuarioId||'', usuarioNome||'', usuarioEmail||'', query||'', modo||'', plano||'', licencaStatus||'', ip||'']);
}

export async function listarAuditoria({ sistemaSlug, tenantId, usuarioId, limite=200 } = {}) {
  await initAuditoria();
  const conds = []; const vals = []; let i=1;
  if (sistemaSlug) { conds.push(`sistema_slug = $${i++}`); vals.push(sistemaSlug); }
  if (tenantId) { conds.push(`tenant_id = $${i++}`); vals.push(tenantId); }
  if (usuarioId) { conds.push(`usuario_id = $${i++}`); vals.push(usuarioId); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  vals.push(limite);
  return sql(`SELECT * FROM tecno_auditoria ${where} ORDER BY created_at DESC LIMIT $${i}`, vals);
}

export async function resetPrompts({ sistemaSlug, tenantId }) {
  await sql(`UPDATE tecno_licencas SET prompts_usados=0, updated_at=now() WHERE sistema_slug=$1 AND tenant_id=$2`, [sistemaSlug, tenantId]);
}
