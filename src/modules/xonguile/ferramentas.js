/**
 * ═══════════════════════════════════════════════════════════════════
 *  XONGUILE — registo de ferramentas (todas APENAS LEITURA).
 *  Scoping multi-tenant por salão (`salonId`, vindo do token).
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.XONGUILE_DATABASE_URL);

function salaoDe(params) {
  if (!params?.salonId) throw new Error('Sessão sem salão: inicie sessão.');
  return params.salonId;
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

async function resumoVendas(periodo, salonId) {
  const inicio = janelaTempo(periodo);
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS total,
           coalesce(avg(total),0)::numeric(12,2) AS ticket_medio
    FROM "Invoices"
    WHERE "SalonId" = $1 AND status <> 'voided' AND "paymentStatus" = 'paid' AND "createdAt" >= $2
  `, [salonId, inicio]);
  const porForma = await sql(`
    SELECT coalesce("paymentMethod",'—') AS forma_pagamento,
           count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS total
    FROM "Invoices"
    WHERE "SalonId" = $1 AND status <> 'voided' AND "paymentStatus" = 'paid' AND "createdAt" >= $2
    GROUP BY "paymentMethod" ORDER BY total DESC
  `, [salonId, inicio]);
  return { totais, por_forma_pagamento: porForma };
}

async function topProdutos(salonId) {
  return sql(`
    SELECT it.name AS nome, it.type AS tipo,
           sum(it.quantity)::int AS quantidade_vendida,
           sum(it.total)::numeric(12,2) AS receita
    FROM "InvoiceItems" it
    JOIN "Invoices" inv ON inv.id = it."InvoiceId"
    WHERE it."SalonId" = $1 AND inv.status <> 'voided'
    GROUP BY it.name, it.type
    ORDER BY quantidade_vendida DESC
    LIMIT 10
  `, [salonId]);
}

async function estoqueBaixo(salonId) {
  return sql(`
    SELECT id, name AS nome, quantity AS quantidade, "minQuantity" AS quantidade_minima, price AS preco_venda
    FROM "Products"
    WHERE "SalonId" = $1 AND quantity <= "minQuantity"
    ORDER BY quantity ASC
    LIMIT 20
  `, [salonId]);
}

async function resumoClientes(salonId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS clientes,
           count(*) FILTER (WHERE "createdAt" >= now() - interval '30 days')::int AS novos_30d
    FROM "Clients"
    WHERE "SalonId" = $1
  `, [salonId]);
  const lista = await sql(`
    SELECT id, name AS nome, phone AS telefone, email, "xonguileId" AS codigo
    FROM "Clients"
    WHERE "SalonId" = $1
    ORDER BY name ASC
    LIMIT 100
  `, [salonId]);
  return { totais, lista };
}

async function buscarProdutos(termos, salonId) {
  const t = `%${String(termos || '').toLowerCase()}%`;
  const r = await sql(`
    SELECT id, name AS nome, price AS preco_venda, quantity AS quantidade
    FROM "Products"
    WHERE "SalonId" = $1 AND lower(name) LIKE $2
    ORDER BY name ASC
    LIMIT 8
  `, [salonId, t]);
  return r.map(p => ({ ...p, nome_generico: 'Produto' }));
}

async function detalheProduto(id, salonId) {
  const p = await sql(`
    SELECT id, name AS nome, price AS preco_venda, quantity AS quantidade,
           "minQuantity" AS quantidade_minima, category AS categoria, cost AS preco_custo
    FROM "Products"
    WHERE id = $1 AND "SalonId" = $2
  `, [id, salonId]);
  if (p.length === 0) return null;
  return { ...p[0], estoque: p[0].quantidade ? [{ quantidade: p[0].quantidade, preco_venda: p[0].preco_venda }] : [] };
}

export const FERRAMENTAS_XONGUILE = {
  buscar_produtos: (p = {}) => buscarProdutos(p.termos, salaoDe(p)),
  vendas: (p = {}) => resumoVendas(p.periodo ?? '30d', salaoDe(p)),
  top_produtos: (p = {}) => topProdutos(salaoDe(p)),
  estoque_baixo: (p = {}) => estoqueBaixo(salaoDe(p)),
  clientes: (p = {}) => resumoClientes(salaoDe(p)),
  detalhe_produto: (p = {}) => detalheProduto(p.id, salaoDe(p))
};

export async function executarFerramentaXonguile(nome, params = {}) {
  const ferramenta = FERRAMENTAS_XONGUILE[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}

export { buscarProdutos };
