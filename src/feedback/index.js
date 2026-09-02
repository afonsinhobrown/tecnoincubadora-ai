import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.FARMACIA_DATABASE_URL);

export async function initFeedback() {
  await sql(`
    CREATE TABLE IF NOT EXISTS tecno_feedback (
      id serial PRIMARY KEY,
      sistema_slug text NOT NULL,
      tenant_id text,
      usuario_id text,
      usuario_nome text,
      query text NOT NULL,
      bloco_titulo text,
      bloco_intencao text,
      gostou boolean NOT NULL,
      comentario text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function salvarFeedback({ sistemaSlug, tenantId, usuarioId, usuarioNome, query, blocoTitulo, blocoIntencao, gostou, comentario }) {
  await initFeedback();
  const r = await sql(`
    INSERT INTO tecno_feedback (sistema_slug, tenant_id, usuario_id, usuario_nome, query, bloco_titulo, bloco_intencao, gostou, comentario)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [sistemaSlug, tenantId||'', usuarioId||'', usuarioNome||'', query||'', blocoTitulo||'', blocoIntencao||'', !!gostou, comentario||'']);
  return r[0];
}

export async function listarFeedback({ sistemaSlug, limite=200 } = {}) {
  await initFeedback();
  if (sistemaSlug) return sql(`SELECT * FROM tecno_feedback WHERE sistema_slug=$1 ORDER BY created_at DESC LIMIT $2`, [sistemaSlug, limite]);
  return sql(`SELECT * FROM tecno_feedback ORDER BY created_at DESC LIMIT $1`, [limite]);
}
