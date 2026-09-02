/**
 * ═══════════════════════════════════════════════════════════════════
 *  MACHAMBAPRO — registo de ferramentas (todas APENAS LEITURA).
 *  Scoping multi-tenant por empresa (`companyId`, do token).
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MACHAMBA_DATABASE_URL);

function empresaDe(params) {
  if (!params?.companyId) throw new Error('Sessão sem empresa: inicie sessão.');
  return params.companyId;
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

async function resumoVendas(periodo, companyId) {
  const inicio = periodo === 'total' ? null : janelaTempo(periodo);
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum("totalAmount"),0)::numeric(12,2) AS total,
           coalesce(avg("totalAmount"),0)::numeric(12,2) AS ticket_medio
    FROM "Sale"
    WHERE "companyId" = $1 AND (\$2::timestamptz IS NULL OR date >= \$2)
  `, [companyId, inicio]);
  const porForma = await sql(`
    SELECT coalesce("paymentMethod",'—') AS forma_pagamento,
           count(*)::int AS pedidos,
           coalesce(sum("totalAmount"),0)::numeric(12,2) AS total
    FROM "Sale"
    WHERE "companyId" = $1 AND (\$2::timestamptz IS NULL OR date >= \$2)
    GROUP BY "paymentMethod" ORDER BY total DESC
  `, [companyId, inicio]);
  return { totais, por_forma_pagamento: porForma };
}

async function topProdutos(companyId) {
  return sql(`
    SELECT name AS nome, category AS nome_generico,
           "currentStock"::int AS quantidade_vendida,
           coalesce("pricePerUnit" * "currentStock",0)::numeric(12,2) AS receita
    FROM "Product"
    WHERE "companyId" = $1
    ORDER BY "currentStock" DESC
    LIMIT 10
  `, [companyId]);
}

async function estoqueBaixo(companyId) {
  return sql(`
    SELECT id, name AS nome, category AS nome_generico,
           "currentStock"::int AS quantidade, 0::int AS quantidade_minima,
           "pricePerUnit" AS preco_venda
    FROM "Product"
    WHERE "companyId" = $1 AND "currentStock" <= 5
    ORDER BY "currentStock" ASC
    LIMIT 20
  `, [companyId]);
}

async function resumoClientes(companyId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS clientes, 0::int AS novos_30d
    FROM "Partner"
    WHERE "companyId" = $1
  `, [companyId]);
  const lista = await sql(`
    SELECT id, name AS nome, coalesce(type,'—') AS tipo, phone AS telefone,
           coalesce(category,'—') AS categoria, coalesce("totalPurchased",0) AS total_comprado
    FROM "Partner"
    WHERE "companyId" = $1
    ORDER BY name ASC
    LIMIT 100
  `, [companyId]);
  return { totais, lista };
}

async function buscarProdutos(termos, companyId) {
  const t = `%${String(termos || '').toLowerCase()}%`;
  const r = await sql(`
    SELECT id, name AS nome, category AS nome_generico, "pricePerUnit" AS preco_venda,
           "currentStock" AS quantidade
    FROM "Product"
    WHERE "companyId" = $1 AND lower(name) LIKE $2
    ORDER BY name ASC
    LIMIT 8
  `, [companyId, t]);
  return r;
}

async function detalheProduto(id, companyId) {
  const p = await sql(`
    SELECT id, name AS nome, category AS nome_generico, unit AS unidade,
           "pricePerUnit" AS preco_venda, "currentStock" AS quantidade,
           origin AS origem
    FROM "Product"
    WHERE id = $1 AND "companyId" = $2
  `, [id, companyId]);
  if (p.length === 0) return null;
  return { ...p[0], estoque: p[0].quantidade != null ? [{ quantidade: p[0].quantidade, preco_venda: p[0].preco_venda }] : [] };
}

export const FERRAMENTAS_MACHAMBA = {
  buscar_produtos: (p = {}) => buscarProdutos(p.termos, empresaDe(p)),
  vendas: (p = {}) => resumoVendas(p.periodo ?? 'total', empresaDe(p)),
  top_produtos: (p = {}) => topProdutos(empresaDe(p)),
  estoque_baixo: (p = {}) => estoqueBaixo(empresaDe(p)),
  clientes: (p = {}) => resumoClientes(empresaDe(p)),
  detalhe_produto: (p = {}) => detalheProduto(p.id, empresaDe(p))
};

export async function executarFerramentaMachamba(nome, params = {}) {
  const ferramenta = FERRAMENTAS_MACHAMBA[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}

export { buscarProdutos };
