import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.FARMACIA_DATABASE_URL);

export async function initCache() {
  await sql(`
    CREATE TABLE IF NOT EXISTS tecno_cache (
      id serial PRIMARY KEY,
      sistema_slug text NOT NULL,
      tenant_id text NOT NULL,
      query_norm text NOT NULL,
      resposta jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(sistema_slug, tenant_id, query_norm)
    )
  `);
  await sql(`CREATE INDEX IF NOT EXISTS idx_cache_lookup ON tecno_cache(sistema_slug, tenant_id, query_norm)`);
}

function normalizar(q) {
  return String(q||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}

export async function getCache({ sistemaSlug, tenantId, query }) {
  await initCache();
  const norm = normalizar(query);
  const r = await sql(`SELECT resposta FROM tecno_cache WHERE sistema_slug=$1 AND tenant_id=$2 AND query_norm=$3`, [sistemaSlug, tenantId, norm]);
  return r[0]?.resposta || null;
}

export async function setCache({ sistemaSlug, tenantId, query, resposta }) {
  await initCache();
  const norm = normalizar(query);
  await sql(`
    INSERT INTO tecno_cache (sistema_slug, tenant_id, query_norm, resposta)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (sistema_slug, tenant_id, query_norm) DO UPDATE SET resposta=$4, created_at=now()
  `, [sistemaSlug, tenantId, norm, JSON.stringify(resposta)]);
}
