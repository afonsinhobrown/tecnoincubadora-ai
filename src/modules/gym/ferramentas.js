/**
 * ═══════════════════════════════════════════════════════════════════
 *  GYMAR/HefelGym — registo de ferramentas (todas APENAS LEITURA).
 *  Scoping multi-tenant por ginásio (`gymId`, do token).
 *  Nota: as datas estão em texto; a faturação é somada por gym_id.
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.GYMAR_DATABASE_URL);

function gymDe(params) {
  if (!params?.gymId) throw new Error('Sessão sem ginásio: inicie sessão.');
  return params.gymId;
}

async function resumoVendas(periodo, gymId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum(amount),0)::numeric(12,2) AS total,
           coalesce(avg(amount),0)::numeric(12,2) AS ticket_medio
    FROM invoices
    WHERE gym_id = $1 AND status NOT IN ('voided','CANCELLED','cancelado')
  `, [gymId]);
  const porForma = await sql(`
    SELECT coalesce(payment_method,'—') AS forma_pagamento,
           count(*)::int AS pedidos,
           coalesce(sum(amount),0)::numeric(12,2) AS total
    FROM invoices
    WHERE gym_id = $1 AND status NOT IN ('voided','CANCELLED','cancelado')
    GROUP BY payment_method ORDER BY total DESC
  `, [gymId]);
  return { totais, por_forma_pagamento: porForma };
}

async function topProdutos(gymId) {
  return sql(`
    SELECT p.name AS nome, p.category AS nome_generico,
           count(c.id)::int AS quantidade_vendida,
           coalesce(sum(p.price),0)::numeric(12,2) AS receita
    FROM plans p
    LEFT JOIN clients c ON c.plan_id = p.id AND c.gym_id = p.gym_id AND c.status = 'active'
    WHERE p.gym_id = $1
    GROUP BY p.name, p.category, p.price
    ORDER BY quantidade_vendida DESC
    LIMIT 10
  `, [gymId]);
}

async function estoqueBaixo(gymId) {
  return sql(`
    SELECT id, name AS nome, category AS nome_generico,
           stock AS quantidade, 5 AS quantidade_minima, price AS preco_venda
    FROM products
    WHERE gym_id = $1 AND stock <= 5
    ORDER BY stock ASC
    LIMIT 20
  `, [gymId]);
}

async function resumoClientes(gymId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS clientes,
           count(*) FILTER (WHERE status = 'active')::int AS ativos,
           0::int AS novos_30d
    FROM clients
    WHERE gym_id = $1
  `, [gymId]);
  return totais;
}

async function buscarProdutos(termos, gymId) {
  const t = `%${String(termos || '').toLowerCase()}%`;
  const r = await sql(`
    SELECT id, name AS nome, category AS nome_generico, price AS preco_venda, stock AS quantidade
    FROM products
    WHERE gym_id = $1 AND lower(name) LIKE $2
    ORDER BY name ASC
    LIMIT 8
  `, [gymId, t]);
  return r;
}

async function detalheProduto(id, gymId) {
  const p = await sql(`
    SELECT id, name AS nome, category AS nome_generico, type AS tipo,
           price AS preco_venda, cost_price AS preco_custo, stock AS quantidade
    FROM products
    WHERE id = $1 AND gym_id = $2
  `, [id, gymId]);
  if (p.length === 0) return null;
  return { ...p[0], estoque: p[0].quantidade != null ? [{ quantidade: p[0].quantidade, preco_venda: p[0].preco_venda }] : [] };
}

export const FERRAMENTAS_GYM = {
  buscar_produtos: (p = {}) => buscarProdutos(p.termos, gymDe(p)),
  vendas: (p = {}) => resumoVendas(p.periodo ?? '30d', gymDe(p)),
  top_produtos: (p = {}) => topProdutos(gymDe(p)),
  estoque_baixo: (p = {}) => estoqueBaixo(gymDe(p)),
  clientes: (p = {}) => resumoClientes(gymDe(p)),
  detalhe_produto: (p = {}) => detalheProduto(p.id, gymDe(p))
};

export async function executarFerramentaGym(nome, params = {}) {
  const ferramenta = FERRAMENTAS_GYM[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}

export { buscarProdutos };
