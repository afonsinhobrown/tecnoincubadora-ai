/**
 * ═══════════════════════════════════════════════════════════════════
 *  ADEGAHUB — registo de ferramentas (todas APENAS LEITURA).
 *  Scoping multi-tenant por `tenant_id` (do token).
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.ADEGAHUB_DATABASE_URL);

function tenantDe(params) {
  if (!params?.tenantId) throw new Error('Sessão sem tenant: inicie sessão.');
  return params.tenantId;
}

function janelaTempo(periodo) {
  const agora = new Date();
  const inicio = new Date(agora);
  switch (periodo) {
    case 'hoje': inicio.setHours(0, 0, 0, 0); break;
    case 'semana': inicio.setDate(inicio.getDate() - 7); break;
    case 'mes': inicio.setDate(1); inicio.setHours(0, 0, 0, 0); break;
    default: inicio.setDate(inicio.getDate() - 30);
  }
  return inicio;
}

async function resumoVendas(periodo, tenantId) {
  const inicio = periodo === 'total' ? null : janelaTempo(periodo);
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum(total_amount),0)::numeric(12,2) AS total,
           coalesce(avg(total_amount),0)::numeric(12,2) AS ticket_medio
    FROM sales
    WHERE tenant_id = $1 AND status NOT IN ('cancelled','CANCELLED') AND (\$2::timestamptz IS NULL OR created_at >= \$2)
  `, [tenantId, inicio]);
  const porForma = await sql(`
    SELECT coalesce(payment_method,'—') AS forma_pagamento,
           count(*)::int AS pedidos,
           coalesce(sum(amount),0)::numeric(12,2) AS total
    FROM payments p
    JOIN sales s ON s.id = p.sale_id
    WHERE s.tenant_id = $1 AND s.status NOT IN ('cancelled','CANCELLED') AND p.status = 'captured'
      AND (\$2::timestamptz IS NULL OR s.created_at >= \$2)
    GROUP BY payment_method ORDER BY total DESC
  `, [tenantId, inicio]);
  return { totais, por_forma_pagamento: porForma };
}

async function topProdutos(tenantId) {
  return sql(`
    SELECT p.name AS nome, p.brand AS nome_generico,
           sum(si.quantity)::int AS quantidade_vendida,
           sum(si.total_amount)::numeric(12,2) AS receita
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    WHERE s.tenant_id = $1 AND s.status NOT IN ('cancelled','CANCELLED')
    GROUP BY p.name, p.brand
    ORDER BY quantidade_vendida DESC
    LIMIT 10
  `, [tenantId]);
}

async function estoqueBaixo(tenantId) {
  return sql(`
    SELECT id, name AS nome, brand AS nome_generico,
           min_stock AS quantidade_minima, base_price AS preco_venda
    FROM products
    WHERE tenant_id = $1 AND is_active = true AND min_stock > 0
    ORDER BY min_stock ASC
    LIMIT 20
  `, [tenantId]);
}

async function resumoClientes(tenantId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS clientes,
           count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS novos_30d
    FROM customers
    WHERE tenant_id = $1 AND is_active = true
  `, [tenantId]);
  const lista = await sql(`
    SELECT id, name AS nome, email, phone AS telefone, coalesce(customer_type,'—') AS tipo,
           current_credit AS credito_atual
    FROM customers
    WHERE tenant_id = $1 AND is_active = true
    ORDER BY name ASC
    LIMIT 100
  `, [tenantId]);
  return { totais, lista };
}

async function buscarProdutos(termos, tenantId) {
  const t = `%${String(termos || '').toLowerCase()}%`;
  const r = await sql(`
    SELECT id, name AS nome, brand AS nome_generico, base_price AS preco_venda,
           sku AS codigo_interno
    FROM products
    WHERE tenant_id = $1 AND (lower(name) LIKE $2 OR lower(sku) LIKE $2 OR lower(brand) LIKE $2)
    ORDER BY name ASC
    LIMIT 8
  `, [tenantId, t]);
  return r;
}

async function detalheProduto(id, tenantId) {
  const p = await sql(`
    SELECT id, name AS nome, brand AS nome_generico, description AS descricao,
           base_price AS preco_venda, base_cost AS preco_custo, sku AS codigo_interno,
           min_stock AS quantidade_minima, alcohol_percentage AS teor_alcool
    FROM products
    WHERE id = $1 AND tenant_id = $2
  `, [id, tenantId]);
  if (p.length === 0) return null;
  return { ...p[0], estoque: [] };
}

export const FERRAMENTAS_ADEGAHUB = {
  buscar_produtos: (p = {}) => buscarProdutos(p.termos, tenantDe(p)),
  vendas: (p = {}) => resumoVendas(p.periodo ?? 'total', tenantDe(p)),
  top_produtos: (p = {}) => topProdutos(tenantDe(p)),
  estoque_baixo: (p = {}) => estoqueBaixo(tenantDe(p)),
  clientes: (p = {}) => resumoClientes(tenantDe(p)),
  detalhe_produto: (p = {}) => detalheProduto(p.id, tenantDe(p))
};

export async function executarFerramentaAdegahub(nome, params = {}) {
  const ferramenta = FERRAMENTAS_ADEGAHUB[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}

export { buscarProdutos };
