/**
 * ═══════════════════════════════════════════════════════════════════
 *  ENTREGASMOZ — registo de ferramentas (todas APENAS LEITURA).
 *  Scoping por papel: provider vê só as suas; admin vê tudo.
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.ENTREGAS_DATABASE_URL);

// ctx traz { userId, userType, providerId? }
function filtroProvider(ctx) {
  // admin vê tudo; provider/loja vê só as suas encomendas/produtos
  if (ctx?.userType === 'ADMIN' || !ctx?.providerId) return { where: '', params: [] };
  return { where: ' AND "providerId" = $2', params: [ctx.providerId] };
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

async function resumoVendas(periodo, ctx) {
  const inicio = janelaTempo(periodo);
  const fp = filtroProvider(ctx);
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum("totalAmount"),0)::numeric(12,2) AS total,
           coalesce(avg("totalAmount"),0)::numeric(12,2) AS ticket_medio
    FROM "Order"
    WHERE status NOT IN ('CANCELLED','cancelled') AND "createdAt" >= $1 ${fp.where}
  `, [inicio, ...fp.params]);
  return { totais, por_forma_pagamento: [] };
}

async function topProdutos(ctx) {
  const fp = filtroProvider(ctx);
  const filtro = fp.where ? ` WHERE o."providerId" = ${fp.params[0]}` : '';
  const params = fp.where ? [] : [];
  return sql(`
    SELECT p.name AS nome, 'produto' AS nome_generico,
           sum(oi.quantity)::int AS quantidade_vendida,
           coalesce(sum(oi.quantity * p.price),0)::numeric(12,2) AS receita
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    JOIN "Product" p ON p.id = oi."productId"
    ${filtro}
    GROUP BY p.name
    ORDER BY quantidade_vendida DESC
    LIMIT 10
  `, params);
}

async function clientes() {
  const [totais] = await sql(`SELECT count(*)::int AS clientes, 0::int AS novos_30d FROM "Client"`);
  const lista = await sql(`
    SELECT c.id, u.name AS nome, u.email, u.phone AS telefone
    FROM "Client" c
    JOIN "User" u ON u.id = c."userId"
    ORDER BY u.name ASC
    LIMIT 100
  `);
  return { totais, lista };
}

async function lojas() {
  return sql(`SELECT "storeName" AS nome, category AS categoria, isOpen AS aberta
              FROM "Provider" ORDER BY "storeName" ASC LIMIT 50`);
}

async function estafetas() {
  return sql(`SELECT "vehicleType" AS veiculo, "totalDeliveries"::int AS entregas, isAvailable AS disponivel
              FROM "DeliveryPerson" ORDER BY "totalDeliveries" DESC LIMIT 20`);
}

export const FERRAMENTAS_ENTREGAS = {
  vendas: (p = {}) => resumoVendas(p.periodo ?? '30d', p),
  top_produtos: (p = {}) => topProdutos(p),
  clientes: (p = {}) => clientes(p),
  lojas: (p = {}) => lojas(p),
  estafetas: (p = {}) => estafetas(p)
};

export async function executarFerramentaEntregas(nome, params = {}) {
  const ferramenta = FERRAMENTAS_ENTREGAS[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}
