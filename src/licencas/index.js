/**
 * Sistema de licenças TECNOINCUBADORA AI
 * - Trial 10 dias por tenant (sistema_slug + tenant_id)
 * - Planos: basico (50 prompts/mês, 1 user, 0 downloads), standard (80, 3 users, 10 downloads), pro (ilimitado)
 * - Unlimited: tenant/user contendo nachingweya/encubadora/tecnoincubadora + todo o DDGEI (Licença Temporária)
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.FARMACIA_DATABASE_URL);

const PLANOS = {
  basico:   { prompts: 50, usuarios: 1, downloads: 0, preco: 1000 },
  standard: { prompts: 80, usuarios: 3, downloads: 10, preco: 1700 },
  pro:      { prompts: Infinity, usuarios: Infinity, downloads: Infinity, preco: 2500 },
};

const UNLIMITED_KEYWORDS = ['nachingweya','encubadora','tecnoincubadora','tecnoincubad','incubadora'];

function isUnlimited({ sistemaSlug, tenantNome, userNome, isSuperAdmin }) {
  if (isSuperAdmin) return { unlimited: true, motivo: 'Superadmin — acesso ilimitado' };
  if (sistemaSlug === 'ddgei') return { unlimited: true, motivo: 'Licença Temporária gerida pelo desenvolvedor' };
  const hay = `${tenantNome||''} ${userNome||''}`.toLowerCase();
  if (UNLIMITED_KEYWORDS.some(k => hay.includes(k))) return { unlimited: true, motivo: 'Acesso ilimitado (tenant/user especial)' };
  return { unlimited: false };
}

async function init() {
  await sql(`
    CREATE TABLE IF NOT EXISTS tecno_licencas (
      id serial PRIMARY KEY,
      sistema_slug text NOT NULL,
      tenant_id text NOT NULL,
      tenant_nome text,
      plano text NOT NULL DEFAULT 'basico',
      trial_inicio timestamptz NOT NULL DEFAULT now(),
      trial_fim timestamptz NOT NULL,
      mes_ref text NOT NULL,
      prompts_usados int NOT NULL DEFAULT 0,
      downloads_usados int NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'trial',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(sistema_slug, tenant_id)
    )
  `);
}

function mesRef(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }

async function fetchTenantNome(sistemaSlug, tenantId) {
  try {
    if (sistemaSlug === 'gestorfarma') {
      const s = neon(process.env.FARMACIA_DATABASE_URL);
      const r = await s(`SELECT nome FROM farmacias_farmacia WHERE id=$1`, [tenantId]); return r[0]?.nome || '';
    }
    if (sistemaSlug === 'xonguile') {
      const s = neon(process.env.XONGUILE_DATABASE_URL);
      const r = await s(`SELECT name FROM "Salons" WHERE id=$1`, [Number(tenantId)]); return r[0]?.name || '';
    }
    if (sistemaSlug === 'cafepoint') {
      const s = neon(process.env.CAFEPOINT_DATABASE_URL);
      const r = await s(`SELECT name FROM "Restaurant" WHERE id=$1`, [Number(tenantId)]); return r[0]?.name || '';
    }
    if (sistemaSlug === 'wms') {
      const s = neon(process.env.ARMAZEM_DATABASE_URL);
      const r = await s(`SELECT company_name FROM users WHERE id=$1`, [Number(tenantId)]); return r[0]?.company_name || '';
    }
    if (sistemaSlug === 'hefelgym' || sistemaSlug === 'gymar') {
      const s = neon(process.env.GYMAR_DATABASE_URL);
      const r = await s(`SELECT name FROM gyms WHERE id=$1`, [tenantId]); return r[0]?.name || '';
    }
    if (sistemaSlug === 'credhub') {
      const s = neon(process.env.CREDHUB_DATABASE_URL);
      const r = await s(`SELECT name FROM tenants WHERE id=$1`, [tenantId]); return r[0]?.name || '';
    }
    if (sistemaSlug === 'adegahub') {
      const s = neon(process.env.ADEGAHUB_DATABASE_URL);
      const r = await s(`SELECT name FROM tenants WHERE id=$1`, [tenantId]); return r[0]?.name || '';
    }
    if (sistemaSlug === 'machambapro') {
      const s = neon(process.env.MACHAMBA_DATABASE_URL);
      const r = await s(`SELECT name FROM "Company" WHERE id=$1`, [tenantId]); return r[0]?.name || '';
    }
    if (sistemaSlug === 'smartschool') {
      const s = neon(process.env.SMARTSCHOOL_DATABASE_URL);
      const r = await s(`SELECT nome FROM "Escola" WHERE id=$1`, [tenantId]); return r[0]?.nome || '';
    }
    if (sistemaSlug === 'brokerhub') {
      const s = neon(process.env.BROKERHUB_DATABASE_URL);
      const r = await s(`SELECT nome_comercial FROM tenants WHERE id=$1`, [tenantId]); return r[0]?.nome_comercial || '';
    }
    if (sistemaSlug === 'entregasmoz') {
      const s = neon(process.env.ENTREGAS_DATABASE_URL);
      const r = await s(`SELECT name FROM "User" WHERE id=$1`, [tenantId]); return r[0]?.name || '';
    }
  } catch {}
  return '';
}

async function getOrCreateLicenca({ sistemaSlug, tenantId, tenantNome, userNome, isSuperAdmin }) {
  await init();
  if (isSuperAdmin) return { unlimited: true, motivo: 'Superadmin — acesso ilimitado', plano: 'pro', trial: false };
  // tenta obter nome existente se não fornecido
  if (!tenantNome) {
    const r = await sql(`SELECT tenant_nome FROM tecno_licencas WHERE sistema_slug=$1 AND tenant_id=$2`, [sistemaSlug, tenantId]);
    if (r[0]?.tenant_nome) tenantNome = r[0].tenant_nome;
  }
  if (!tenantNome) tenantNome = await fetchTenantNome(sistemaSlug, tenantId);
  const unlimited = isUnlimited({ sistemaSlug, tenantNome, userNome, isSuperAdmin });
  if (unlimited.unlimited) {
    return { unlimited: true, motivo: unlimited.motivo, plano: 'pro', trial: false };
  }
  const mes = mesRef();
  let rows = await sql(`SELECT * FROM tecno_licencas WHERE sistema_slug=$1 AND tenant_id=$2`, [sistemaSlug, tenantId]);
  let lic = rows[0];
  if (!lic) {
    const trialFim = new Date(Date.now() + 10*24*60*60*1000);
    rows = await sql(`
      INSERT INTO tecno_licencas (sistema_slug, tenant_id, tenant_nome, plano, trial_inicio, trial_fim, mes_ref, prompts_usados, downloads_usados, status)
      VALUES ($1,$2,$3,'basico', now(), $4, $5, 0, 0, 'trial')
      RETURNING *
    `, [sistemaSlug, tenantId, tenantNome||'', trialFim, mes]);
    lic = rows[0];
  }
  // reset mensal
  if (lic.mes_ref !== mes) {
    rows = await sql(`UPDATE tecno_licencas SET mes_ref=$3, prompts_usados=0, downloads_usados=0, updated_at=now() WHERE sistema_slug=$1 AND tenant_id=$2 RETURNING *`, [sistemaSlug, tenantId, mes]);
    lic = rows[0];
  }
  const agora = new Date();
  const emTrial = lic.status === 'trial' && agora <= new Date(lic.trial_fim);
  if (emTrial) {
    return { unlimited: false, trial: true, trialFim: lic.trial_fim, plano: lic.plano, lic };
  }
  // trial expirado -> passa a ativo conforme plano
  if (lic.status === 'trial' && agora > new Date(lic.trial_fim)) {
    rows = await sql(`UPDATE tecno_licencas SET status='active', updated_at=now() WHERE sistema_slug=$1 AND tenant_id=$2 RETURNING *`, [sistemaSlug, tenantId]);
    lic = rows[0];
  }
  return { unlimited: false, trial: false, plano: lic.plano, lic };
}

async function verificarAcesso({ sistemaSlug, tenantId, tenantNome, userNome, isSuperAdmin }) {
  const info = await getOrCreateLicenca({ sistemaSlug, tenantId, tenantNome, userNome, isSuperAdmin });
  if (info.lic && info.lic.status === 'blocked') {
    return { permitido: false, motivo: 'Licença bloqueada. Contacte o administrador.', ...info };
  }
  if (info.unlimited) return { permitido: true, ...info };
  const plano = PLANOS[info.plano] || PLANOS.basico;
  const lic = info.lic;
  if (lic.prompts_usados >= plano.prompts) {
    return { permitido: false, motivo: `Limite de ${plano.prompts} prompts/mês do plano ${info.plano} atingido. Faça upgrade.`, ...info };
  }
  return { permitido: true, ...info };
}

async function registrarUsoPrompt({ sistemaSlug, tenantId }) {
  const mes = mesRef();
  await sql(`UPDATE tecno_licencas SET prompts_usados = prompts_usados + 1, updated_at=now() WHERE sistema_slug=$1 AND tenant_id=$2 AND mes_ref=$3`, [sistemaSlug, tenantId, mes]);
}

async function registrarDownload({ sistemaSlug, tenantId }) {
  const mes = mesRef();
  await sql(`UPDATE tecno_licencas SET downloads_usados = downloads_usados + 1, updated_at=now() WHERE sistema_slug=$1 AND tenant_id=$2 AND mes_ref=$3`, [sistemaSlug, tenantId, mes]);
}

async function listarLicencas() {
  await init();
  return sql(`SELECT * FROM tecno_licencas ORDER BY updated_at DESC LIMIT 500`);
}
async function atualizarLicenca({ sistemaSlug, tenantId, plano, status, trialFim }) {
  await init();
  const sets = []; const vals = []; let i = 1;
  if (plano) { sets.push(`plano = $${i++}`); vals.push(plano); }
  if (status) { sets.push(`status = $${i++}`); vals.push(status); }
  if (trialFim) { sets.push(`trial_fim = $${i++}`); vals.push(new Date(trialFim)); }
  if (!sets.length) throw new Error('Nada para atualizar');
  sets.push(`updated_at = now()`);
  vals.push(sistemaSlug, tenantId);
  const q = `UPDATE tecno_licencas SET ${sets.join(', ')} WHERE sistema_slug = $${i++} AND tenant_id = $${i++} RETURNING *`;
  // vals already has plano/status/trialFim, need to add slug/tenantId at end
  // recompute correctly
  const vals2 = []; let j = 1; const sets2 = [];
  if (plano) { sets2.push(`plano = $${j++}`); vals2.push(plano); }
  if (status) { sets2.push(`status = $${j++}`); vals2.push(status); }
  if (trialFim) { sets2.push(`trial_fim = $${j++}`); vals2.push(new Date(trialFim)); }
  sets2.push(`updated_at = now()`);
  vals2.push(sistemaSlug, tenantId);
  const q2 = `UPDATE tecno_licencas SET ${sets2.join(', ')} WHERE sistema_slug = $${j++} AND tenant_id = $${j++} RETURNING *`;
  const r = await sql(q2, vals2);
  if (!r[0]) throw new Error('Licença não encontrada');
  return r[0];
}
async function renovarLicenca({ sistemaSlug, tenantId, dias = 10 }) {
  await init();
  const r = await sql(`SELECT * FROM tecno_licencas WHERE sistema_slug=$1 AND tenant_id=$2`, [sistemaSlug, tenantId]);
  if (!r[0]) throw new Error('Licença não encontrada');
  const novoFim = new Date(Date.now() + dias*24*60*60*1000);
  const upd = await sql(`UPDATE tecno_licencas SET trial_fim=$1, status='trial', updated_at=now() WHERE sistema_slug=$2 AND tenant_id=$3 RETURNING *`, [novoFim, sistemaSlug, tenantId]);
  return upd[0];
}
async function bloquearLicenca({ sistemaSlug, tenantId, bloquear = true }) {
  await init();
  const status = bloquear ? 'blocked' : 'active';
  const r = await sql(`UPDATE tecno_licencas SET status=$1, updated_at=now() WHERE sistema_slug=$2 AND tenant_id=$3 RETURNING *`, [status, sistemaSlug, tenantId]);
  if (!r[0]) throw new Error('Licença não encontrada');
  return r[0];
}

export { PLANOS, isUnlimited, getOrCreateLicenca, verificarAcesso, registrarUsoPrompt, registrarDownload, listarLicencas, atualizarLicenca, renovarLicenca, bloquearLicenca, init };
