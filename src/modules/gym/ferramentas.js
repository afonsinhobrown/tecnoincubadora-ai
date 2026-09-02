/**
 * ═══════════════════════════════════════════════════════════════════
 *  GYMAR/HefelGym — registo de ferramentas (todas APENAS LEITURA).
 *  Scoping multi-tenant por ginásio (`gymId`, do token).
 *  Nota: as datas estão em texto; a faturação é somada por gym_id.
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';
import { extrairCriterio } from '../../criterios/index.js';

const sql = neon(process.env.GYMAR_DATABASE_URL);

function gymDe(params) {
  if (params?.isSuperAdmin) return null;
  if (!params?.gymId) throw new Error('Sessão sem ginásio: inicie sessão.');
  return params.gymId;
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

async function resumoVendas(periodo, gymId, consulta) {
  const formas = await sql(`SELECT DISTINCT payment_method FROM invoices WHERE payment_method IS NOT NULL AND payment_method<>''`);
  const dict = formas.map(f => ({ rotulo: String(f.payment_method).toLowerCase(), rotuloCurto: String(f.payment_method).toLowerCase(), valor: f.payment_method, sql: `payment_method = '${String(f.payment_method).replace(/'/g, "''")}'` }));
  const c = extrairCriterio(consulta || '', dict.map(d => ({ rotulo: d.rotulo, rotuloCurto: d.rotuloCurto, valor: d.valor })));
  const especifico = !c.global;
  const item = especifico ? dict.find(d => d.valor === c.criterio.valor) : null;
  const formaCond = item ? ` AND ${item.sql}` : '';
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum(amount),0)::numeric(12,2) AS total,
           coalesce(avg(amount),0)::numeric(12,2) AS ticket_medio
    FROM invoices
    WHERE ($1::text IS NULL OR gym_id::text = $1) AND status NOT IN ('voided','CANCELLED','cancelado')${formaCond}
  `, [gymId]);
  const porForma = await sql(`
    SELECT coalesce(payment_method,'—') AS forma_pagamento,
           count(*)::int AS pedidos,
           coalesce(sum(amount),0)::numeric(12,2) AS total
    FROM invoices
    WHERE ($1::text IS NULL OR gym_id::text = $1) AND status NOT IN ('voided','CANCELLED','cancelado')${formaCond}
    GROUP BY payment_method ORDER BY total DESC
  `, [gymId]);
  return { totais, por_forma_pagamento: porForma, pedido: especifico ? 'especifico' : 'global', filtro: item ? { forma_pagamento: item.valor } : undefined };
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
    WHERE ($1::text IS NULL OR gym_id::text = $1) AND stock <= 5
    ORDER BY stock ASC
    LIMIT 20
  `, [gymId]);
}

async function resumoClientes(gymId, consulta) {
  const dict = [
    { rotulo: 'ativos', rotuloCurto: 'ativos', valor: 'active', sql: `status = 'active'` },
    { rotulo: 'activo', rotuloCurto: 'activo', valor: 'active', sql: `status = 'active'` },
    { rotulo: 'expirados', rotuloCurto: 'expirados', valor: 'expired', sql: `status = 'expired'` },
    { rotulo: 'vencidos', rotuloCurto: 'vencidos', valor: 'expired', sql: `status = 'expired'` },
    { rotulo: 'inativos', rotuloCurto: 'inativos', valor: 'inactive', sql: `status = 'inactive'` }
  ];
  const c = extrairCriterio(consulta || '', dict.map(d => ({ rotulo: d.rotulo, rotuloCurto: d.rotuloCurto, valor: d.valor })));
  const especifico = !c.global;
  const item = especifico ? dict.find(d => d.valor === c.criterio.valor) : null;
  const cond = item ? ` AND ${item.sql}` : '';

  const [totais] = await sql(`
    SELECT count(*)::int AS clientes,
           count(*) FILTER (WHERE status = 'active')::int AS ativos,
           0::int AS novos_30d
    FROM clients
    WHERE ($1::text IS NULL OR gym_id::text = $1)${cond}
  `, [gymId]);
  const lista = await sql(`
    SELECT id, name AS nome, phone AS telefone, coalesce(plan_name,'—') AS plano,
           status, coalesce(end_date,'') AS data_fim
    FROM clients
    WHERE ($1::text IS NULL OR gym_id::text = $1)${cond}
    ORDER BY name ASC
    LIMIT 100
  `, [gymId]);
  return { totais, pedido: especifico ? 'especifico' : 'global', filtro: item ? { estado: item.valor } : undefined, lista };
}

async function buscarProdutos(termos, gymId) {
  const t = `%${String(termos || '').toLowerCase()}%`;
  const r = await sql(`
    SELECT id, name AS nome, category AS nome_generico, price AS preco_venda, stock AS quantidade
    FROM products
    WHERE ($1::text IS NULL OR gym_id::text = $1) AND lower(name) LIKE $2
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

// Alunos que estão agora dentro do ginásio (último registo = entrada)
async function quemDentro(gymId) {
  return sql(`
    WITH ult AS (
      SELECT DISTINCT ON (user_id) user_id, user_name, type, timestamp
      FROM attendance
      WHERE ($1::text IS NULL OR gym_id::text = $1)
      ORDER BY user_id, timestamp DESC
    )
    SELECT user_name AS nome, timestamp AS ultima
    FROM ult
    WHERE type IN ('in','Entrada')
    ORDER BY timestamp DESC
  `, [gymId]);
}

// Faturas por estado
async function faturas(gymId) {
  const lista = await sql(`
    SELECT id, client_name AS cliente, amount AS valor,
           coalesce(status,'—') AS estado, date AS data, payment_method AS pagamento
    FROM invoices
    WHERE ($1::text IS NULL OR gym_id::text = $1)
    ORDER BY date DESC
    LIMIT 100
  `, [gymId]);
  const [totais] = await sql(`
    SELECT count(*)::int AS faturas,
           count(*) FILTER (WHERE status = 'pago')::int AS pagas,
           count(*) FILTER (WHERE status = 'pendente')::int AS pendentes,
           coalesce(sum(amount) FILTER (WHERE status = 'pago'),0)::numeric(12,2) AS total_pago
    FROM invoices
    WHERE ($1::text IS NULL OR gym_id::text = $1)
  `, [gymId]);
  return { totais, lista };
}

// Mensalidades/planos por estado (ativo, pendente, expirado)
async function mensalidades(gymId) {
  const lista = await sql(`
    SELECT id, name AS aluno, coalesce(plan_name,'—') AS plano,
           coalesce(status,'—') AS estado, coalesce(end_date,'') AS fim
    FROM clients
    WHERE ($1::text IS NULL OR gym_id::text = $1)
    ORDER BY name ASC
    LIMIT 100
  `, [gymId]);
  const [totais] = await sql(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE status = 'active')::int AS ativos,
           count(*) FILTER (WHERE end_date IS NOT NULL AND end_date < to_char(now(),'YYYY-MM-DD'))::int AS expirados
    FROM clients
    WHERE ($1::text IS NULL OR gym_id::text = $1)
  `, [gymId]);
  return { totais, lista };
}

// Ranking de clientes por valor de faturas
async function rankingClientes(gymId) {
  return sql(`
    SELECT client_name AS nome,
           count(*)::int AS quantidade_vendida,
           coalesce(sum(amount),0)::numeric(12,2) AS receita
    FROM invoices
    WHERE ($1::text IS NULL OR gym_id::text = $1) AND status = 'pago'
    GROUP BY client_name
    ORDER BY receita DESC
    LIMIT 10
  `, [gymId]);
}

// Sessões de caixa
async function caixa(gymId) {
  const lista = await sql(`
    SELECT id, user_email AS operador, status,
           coalesce(saldo_inicial,0) AS saldo_inicial, coalesce(saldo_fecho,0) AS saldo_fecho,
           data_abertura, data_fecho
    FROM caixa_sessions
    WHERE ($1::text IS NULL OR gym_id::text = $1)
    ORDER BY data_abertura DESC
    LIMIT 20
  `, [gymId]);
  const [totais] = await sql(`
    SELECT count(*)::int AS sessoes,
           count(*) FILTER (WHERE status = 'aberto')::int AS abertas
    FROM caixa_sessions
    WHERE ($1::text IS NULL OR gym_id::text = $1)
  `, [gymId]);
  return { totais, lista };
}

// Faturação agregada por mês (só pagas)
async function faturacaoMes(gymId) {
  return sql(`
    SELECT to_char(to_date(date,'YYYY-MM-DD'),'YYYY-MM') AS mes,
           count(*)::int AS pedidos,
           coalesce(sum(amount),0)::numeric(12,2) AS total
    FROM invoices
    WHERE ($1::text IS NULL OR gym_id::text = $1) AND status = 'pago' AND date IS NOT NULL AND date <> ''
    GROUP BY mes
    ORDER BY mes DESC
    LIMIT 12
  `, [gymId]);
}

async function acessos(periodo, gymId) {
  const inicio = periodo === 'total' ? null : janelaTempo(periodo);
  const inicioStr = inicio ? inicio.toISOString() : null;
  const whereGym = `($1::text IS NULL OR gym_id::text = $1)`;
  const whereData = `($2::text IS NULL OR timestamp >= $2::text)`;
  const [totais] = await sql(`
    SELECT count(distinct user_id)::int AS clientes
    FROM attendance
    WHERE ${whereGym} AND ${whereData}
  `, [gymId, inicioStr]);
  const lista = await sql(`
    SELECT user_name AS nome, max(timestamp) AS ultimo_acesso, count(*)::int AS acessos
    FROM attendance
    WHERE ${whereGym} AND ${whereData}
    GROUP BY user_id, user_name
    ORDER BY ultimo_acesso DESC
    LIMIT 100
  `, [gymId, inicioStr]);
  return { totais, lista };
}

export const FERRAMENTAS_GYM = {
  buscar_produtos: (p = {}) => buscarProdutos(p.termos, p.isSuperAdmin ? null : gymDe(p)),
  vendas: (p = {}) => resumoVendas(p.periodo ?? 'total', p.isSuperAdmin ? null : gymDe(p), p.consulta),
  top_produtos: (p = {}) => topProdutos(p.isSuperAdmin ? null : gymDe(p)),
  estoque_baixo: (p = {}) => estoqueBaixo(p.isSuperAdmin ? null : gymDe(p)),
  clientes: (p = {}) => resumoClientes(p.isSuperAdmin ? null : gymDe(p), p.consulta),
  detalhe_produto: (p = {}) => detalheProduto(p.id, p.isSuperAdmin ? null : gymDe(p)),
  dentro: (p = {}) => quemDentro(p.isSuperAdmin ? null : gymDe(p)),
  faturas: (p = {}) => faturas(p.isSuperAdmin ? null : gymDe(p)),
  mensalidades: (p = {}) => mensalidades(p.isSuperAdmin ? null : gymDe(p)),
  ranking_clientes: (p = {}) => rankingClientes(p.isSuperAdmin ? null : gymDe(p)),
  caixa: (p = {}) => caixa(p.isSuperAdmin ? null : gymDe(p)),
  faturacao_mes: (p = {}) => faturacaoMes(p.isSuperAdmin ? null : gymDe(p)),
  acessos: (p = {}) => acessos(p.periodo ?? 'mes', p.isSuperAdmin ? null : gymDe(p))
};

export async function executarFerramentaGym(nome, params = {}) {
  const ferramenta = FERRAMENTAS_GYM[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}

export { buscarProdutos };
