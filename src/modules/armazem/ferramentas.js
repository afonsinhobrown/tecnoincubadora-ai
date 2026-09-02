/**
 * ═══════════════════════════════════════════════════════════════════
 *  ARMAZEM (WMS) — registo de ferramentas (todas APENAS LEITURA).
 *  Scoping multi-tenant por empresa (`userId`, do token).
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.ARMAZEM_DATABASE_URL);

function empresaDe(params) {
  if (!params?.userId) throw new Error('Sessão sem empresa: inicie sessão.');
  return params.userId;
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

async function resumoVendas(periodo, userId) {
  const inicio = periodo === 'total' ? null : janelaTempo(periodo);
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS total,
           coalesce(avg(total),0)::numeric(12,2) AS ticket_medio
    FROM invoices
    WHERE user_id = $1 AND status NOT IN ('CANCELLED','cancelado') AND (\$2::timestamptz IS NULL OR created_at >= \$2)
  `, [userId, inicio]);
  return { totais, por_forma_pagamento: [] };
}

async function topProdutos(userId) {
  return sql(`
    SELECT p.name AS nome, p.sku AS nome_generico,
           sum(oi.quantity)::int AS quantidade_vendida,
           sum(oi.quantity * p.selling_price)::numeric(12,2) AS receita
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.user_id = $1 AND o.status NOT IN ('CANCELLED','cancelado')
    GROUP BY p.name, p.sku
    ORDER BY quantidade_vendida DESC
    LIMIT 10
  `, [userId]);
}

async function estoqueBaixo(userId) {
  return sql(`
    SELECT id, name AS nome, sku AS nome_generico,
           quantity AS quantidade, min_stock AS quantidade_minima,
           selling_price AS preco_venda, location AS localizacao
    FROM products
    WHERE user_id = $1 AND quantity <= min_stock
    ORDER BY quantity ASC
    LIMIT 20
  `, [userId]);
}

async function resumoClientes(userId) {
  const [clientes] = await sql(`
    SELECT count(*)::int AS clientes
    FROM customers
    WHERE user_id = $1
  `, [userId]);
  const [fornecedores] = await sql(`
    SELECT count(*)::int AS fornecedores
    FROM suppliers
    WHERE user_id = $1
  `, [userId]);
  const lista = await sql(`
    SELECT id, name AS nome, email, phone AS telefone, coalesce(nif,'—') AS nif
    FROM customers
    WHERE user_id = $1
    ORDER BY name ASC
    LIMIT 100
  `, [userId]);
  return { totais: { ...clientes, ...fornecedores, novos_30d: 0 }, lista };
}

async function buscarProdutos(termos, userId) {
  const t = `%${String(termos || '').toLowerCase()}%`;
  const r = await sql(`
    SELECT id, name AS nome, sku AS nome_generico, selling_price AS preco_venda, quantity AS quantidade
    FROM products
    WHERE user_id = $1 AND (lower(name) LIKE $2 OR lower(sku) LIKE $2)
    ORDER BY name ASC
    LIMIT 8
  `, [userId, t]);
  return r;
}

async function detalheProduto(id, userId) {
  const p = await sql(`
    SELECT id, name AS nome, sku AS nome_generico, description AS descricao,
           quantity AS quantidade, min_stock AS quantidade_minima,
           selling_price AS preco_venda, cost_price AS preco_custo,
           location AS localizacao, unit AS unidade
    FROM products
    WHERE id = $1 AND user_id = $2
  `, [id, userId]);
  if (p.length === 0) return null;
  return { ...p[0], estoque: p[0].quantidade != null ? [{ quantidade: p[0].quantidade, preco_venda: p[0].preco_venda }] : [] };
}

export const FERRAMENTAS_ARMAZEM = {
  buscar_produtos: (p = {}) => buscarProdutos(p.termos, empresaDe(p)),
  vendas: (p = {}) => resumoVendas(p.periodo ?? 'total', empresaDe(p)),
  top_produtos: (p = {}) => topProdutos(empresaDe(p)),
  estoque_baixo: (p = {}) => estoqueBaixo(empresaDe(p)),
  clientes: (p = {}) => resumoClientes(empresaDe(p)),
  detalhe_produto: (p = {}) => detalheProduto(p.id, empresaDe(p))
};

export async function executarFerramentaArmazem(nome, params = {}) {
  const ferramenta = FERRAMENTAS_ARMAZEM[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}

export { buscarProdutos };
