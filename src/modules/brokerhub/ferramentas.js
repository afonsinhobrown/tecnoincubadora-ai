/**
 * ═══════════════════════════════════════════════════════════════════
 *  BROKERHUB — registo de ferramentas (todas APENAS LEITURA).
 *  Scoping multi-tenant por `tenant_id` (do token).
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';
import { extrairCriterio } from '../../criterios/index.js';

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

async function apolices(tenantId) {
  return sql(`
    SELECT numero AS apolice, cliente_nome AS cliente, seguradora, estado, premio AS valor
    FROM apolices
    WHERE tenant_id = $1 AND deleted = false
    ORDER BY created_at DESC LIMIT 50
  `, [tenantId]);
}

async function sinistros(tenantId) {
  return sql(`
    SELECT numero AS sinistro, cliente_nome AS cliente, estado, valor_estimado AS valor
    FROM sinistros
    WHERE tenant_id = $1 AND deleted = false
    ORDER BY created_at DESC LIMIT 50
  `, [tenantId]);
}

async function comissoes(tenantId) {
  return sql(`
    SELECT corretor_nome AS corretor, estado, count(*)::int AS deals,
           coalesce(sum(valor_comissao),0)::numeric(12,2) AS total
    FROM comissoes
    WHERE tenant_id = $1
    GROUP BY corretor_nome, estado ORDER BY total DESC LIMIT 50
  `, [tenantId]);
}

async function pipeline(tenantId) {
  return sql(`
    SELECT ps.nome AS etapa, count(d.id)::int AS deals,
           coalesce(sum(d.valor_estimado),0)::numeric(12,2) AS valor
    FROM pipeline_stages ps
    LEFT JOIN deals d ON d.pipeline_stage_id = ps.id AND d.tenant_id = ps.tenant_id AND d.deleted = false
    WHERE ps.tenant_id = $1
    GROUP BY ps.nome, ps.ordem ORDER BY ps.ordem
  `, [tenantId]);
}

export const FERRAMENTAS_BROKERHUB = {
  vendas: (p = {}) => carteira(p.periodo ?? 'total', tenantDe(p)),
  clientes: (p = {}) => clientes(tenantDe(p)),
  top_produtos: (p = {}) => topClientes(tenantDe(p)),
  corretores: (p = {}) => corretores(tenantDe(p)),
  leads: (p = {}) => leads(tenantDe(p)),
  apolices: (p = {}) => apolices(tenantDe(p)),
  sinistros: (p = {}) => sinistros(tenantDe(p)),
  comissoes: (p = {}) => comissoes(tenantDe(p)),
  pipeline: (p = {}) => pipeline(tenantDe(p)),
  relatorio_insight: (p = {}) => relatorioInsight(tenantDe(p))
};

// Relatório próprio (via BD): resumo da carteira + comissões + top corretores
async function relatorioInsight(tenantId) {
  const dealsPorEstado = await sql(`
    SELECT coalesce(estado,'—') AS estado, count(*)::int AS deals,
           coalesce(sum(valor_estimado),0)::numeric(12,2) AS valor
    FROM deals WHERE tenant_id=$1 AND deleted=false GROUP BY estado ORDER BY deals DESC`, [tenantId]);
  const topCorretores = await sql(`
    SELECT c.nome AS cliente, count(d.id)::int AS deals,
           coalesce(sum(d.valor_estimado),0)::numeric(12,2) AS valor
    FROM deals d LEFT JOIN clientes c ON c.id=d.cliente_id
    WHERE d.tenant_id=$1 AND d.deleted=false GROUP BY c.nome ORDER BY valor DESC LIMIT 10`, [tenantId]);
  const [totais] = await sql(`
    SELECT count(*)::int AS deals,
           coalesce(sum(valor_estimado),0)::numeric(12,2) AS carteira_total
    FROM deals WHERE tenant_id=$1 AND deleted=false`, [tenantId]);
  return { fonte: 'relatorio_criado_pela_ferramenta', totais, deals_por_estado: dealsPorEstado, top_clientes: topCorretores };
}

export async function executarFerramentaBrokerhub(nome, params = {}) {
  const ferramenta = FERRAMENTAS_BROKERHUB[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}
