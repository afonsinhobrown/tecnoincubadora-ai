/**
 * ═══════════════════════════════════════════════════════════════════
 *  CAFÉPOINT — registo de ferramentas (todas APENAS LEITURA).
 *  Scoping multi-tenant por restaurante (`restaurantId`, do token).
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.CAFEPOINT_DATABASE_URL);

function restDe(params) {
  if (!params?.restaurantId) throw new Error('Sessão sem restaurante: inicie sessão.');
  return params.restaurantId;
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

async function resumoVendas(periodo, restaurantId) {
  const inicio = janelaTempo(periodo);
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum("totalAmount"),0)::numeric(12,2) AS total,
           coalesce(avg("totalAmount"),0)::numeric(12,2) AS ticket_medio
    FROM "Order"
    WHERE "restaurantId" = $1 AND status IN ('PAID','COMPLETED') AND "createdAt" >= $2
  `, [restaurantId, inicio]);
  return { totais, por_forma_pagamento: [] };
}

async function topProdutos(restaurantId) {
  return sql(`
    SELECT mi.name AS nome, mi.category AS categoria,
           sum(oi.quantity)::int AS quantidade_vendida,
           sum(oi.quantity * oi.price)::numeric(12,2) AS receita
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    JOIN "MenuItem" mi ON mi.id = oi."menuItemId"
    WHERE o."restaurantId" = $1 AND o.status IN ('PAID','COMPLETED')
    GROUP BY mi.name, mi.category
    ORDER BY quantidade_vendida DESC
    LIMIT 10
  `, [restaurantId]);
}

async function estoqueBaixo(restaurantId) {
  return sql(`
    SELECT id, name AS nome, category AS categoria,
           "stockQuantity" AS quantidade, "minStock" AS quantidade_minima,
           price AS preco_venda
    FROM "MenuItem"
    WHERE "restaurantId" = $1 AND "stockQuantity" <= "minStock"
    ORDER BY "stockQuantity" ASC
    LIMIT 20
  `, [restaurantId]);
}

async function resumoClientes(restaurantId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS clientes,
           count(*) FILTER (WHERE "createdAt" >= now() - interval '30 days')::int AS novos_30d
    FROM "Customer"
    WHERE "restaurantId" = $1
  `, [restaurantId]);
  return totais;
}

async function buscarProdutos(termos, restaurantId) {
  const t = `%${String(termos || '').toLowerCase()}%`;
  const r = await sql(`
    SELECT id, name AS nome, category AS nome_generico, price AS preco_venda,
           "stockQuantity" AS quantidade
    FROM "MenuItem"
    WHERE "restaurantId" = $1 AND lower(name) LIKE $2
    ORDER BY name ASC
    LIMIT 8
  `, [restaurantId, t]);
  return r;
}

async function detalheProduto(id, restaurantId) {
  const p = await sql(`
    SELECT id, name AS nome, description AS descricao, category AS categoria,
           price AS preco_venda, "costPrice" AS preco_custo,
           "stockQuantity" AS quantidade, "minStock" AS quantidade_minima
    FROM "MenuItem"
    WHERE id = $1 AND "restaurantId" = $2
  `, [id, restaurantId]);
  if (p.length === 0) return null;
  return { ...p[0], estoque: p[0].quantidade != null ? [{ quantidade: p[0].quantidade, preco_venda: p[0].preco_venda }] : [] };
}

export const FERRAMENTAS_CAFEPOINT = {
  buscar_produtos: (p = {}) => buscarProdutos(p.termos, restDe(p)),
  vendas: (p = {}) => resumoVendas(p.periodo ?? '30d', restDe(p)),
  top_produtos: (p = {}) => topProdutos(restDe(p)),
  estoque_baixo: (p = {}) => estoqueBaixo(restDe(p)),
  clientes: (p = {}) => resumoClientes(restDe(p)),
  detalhe_produto: (p = {}) => detalheProduto(p.id, restDe(p))
};

export async function executarFerramentaCafepoint(nome, params = {}) {
  const ferramenta = FERRAMENTAS_CAFEPOINT[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}

export { buscarProdutos };
