/**
 * ═══════════════════════════════════════════════════════════════════
 *  BROKERHUB — registo de ferramentas (todas APENAS LEITURA).
 *  Scoping multi-tenant por `tenant_id` (do token).
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.BROKERHUB_DATABASE_URL);

function tenantDe(params) {
  if (!params?.tenantId) throw new Error('Sessão sem tenant: inicie sessão.');
  return params.tenantId;
}

async function carteira(periodo, tenantId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum(valor_estimado),0)::numeric(12,2) AS total,
           coalesce(avg(valor_estimado),0)::numeric(12,2) AS ticket_medio
    FROM deals
    WHERE tenant_id = $1 AND deleted = false
  `, [tenantId]);
  const porEstado = await sql(`
    SELECT coalesce(estado,'—') AS estado, count(*)::int AS total,
           coalesce(sum(valor_estimado),0)::numeric(12,2) AS valor
    FROM deals
    WHERE tenant_id = $1 AND deleted = false
    GROUP BY estado ORDER BY total DESC
  `, [tenantId]);
  return {
    totais,
    por_forma_pagamento: porEstado.map(r => ({ forma_pagamento: r.estado, pedidos: r.total, total: r.valor }))
  };
}

async function clientes(tenantId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS clientes, 0::int AS novos_30d
    FROM clientes
    WHERE tenant_id = $1 AND deleted = false
  `, [tenantId]);
  const lista = await sql(`
    SELECT id, nome, coalesce(apelido,'') AS apelido, telefone, email,
           coalesce(tipo,'—') AS tipo
    FROM clientes
    WHERE tenant_id = $1 AND deleted = false
    ORDER BY nome ASC
    LIMIT 100
  `, [tenantId]);
  return { totais, lista };
}

async function topClientes(tenantId) {
  return sql(`
    SELECT c.nome AS nome,
           count(d.id)::int AS quantidade_vendida,
           coalesce(sum(d.valor_estimado),0)::numeric(12,2) AS receita
    FROM deals d
    JOIN clientes c ON c.id = d.cliente_id
    WHERE d.tenant_id = $1 AND d.deleted = false
    GROUP BY c.nome
    ORDER BY receita DESC
    LIMIT 10
  `, [tenantId]);
}

async function corretores(tenantId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS corretores,
           count(*) FILTER (WHERE ativo = true)::int AS ativos
    FROM corretores
    WHERE tenant_id = $1 AND deleted = false
  `, [tenantId]);
  return totais;
}

async function leads(tenantId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS leads,
           count(*) FILTER (WHERE estado = 'ganho')::int AS ganhos
    FROM leads
    WHERE tenant_id = $1 AND deleted = false
  `, [tenantId]);
  return totais;
}

export const FERRAMENTAS_BROKERHUB = {
  vendas: (p = {}) => carteira(p.periodo ?? 'total', tenantDe(p)),
  clientes: (p = {}) => clientes(tenantDe(p)),
  top_produtos: (p = {}) => topClientes(tenantDe(p)),
  corretores: (p = {}) => corretores(tenantDe(p)),
  leads: (p = {}) => leads(tenantDe(p))
};

export async function executarFerramentaBrokerhub(nome, params = {}) {
  const ferramenta = FERRAMENTAS_BROKERHUB[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}
