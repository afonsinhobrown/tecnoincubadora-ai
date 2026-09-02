/**
 * ═══════════════════════════════════════════════════════════════════
 *  XONGUILE — registo de ferramentas (todas APENAS LEITURA).
 *  Scoping multi-tenant por salão (`salonId`, vindo do token).
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';
import { extrairCriterio } from '../../criterios/index.js';

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

async function resumoVendas(periodo, salonId, consulta) {
  const inicio = periodo === 'total' ? null : janelaTempo(periodo);
  // dicionário de formas de pagamento reais (Xonguile: Dinheiro, MPesa, etc.)
  const formas = await sql(`SELECT DISTINCT "paymentMethod" FROM "Invoices" WHERE "paymentMethod" IS NOT NULL AND "paymentMethod"<>''`);
  const dict = formas.map(f => ({ rotulo: String(f.paymentMethod).toLowerCase(), rotuloCurto: String(f.paymentMethod).toLowerCase(), valor: f.paymentMethod, sql: `"paymentMethod" = '${String(f.paymentMethod).replace(/'/g, "''")}'` }));
  const c = extrairCriterio(consulta || '', dict.map(d => ({ rotulo: d.rotulo, rotuloCurto: d.rotuloCurto, valor: d.valor })));
  const especifico = !c.global;
  const item = especifico ? dict.find(d => d.valor === c.criterio.valor) : null;
  const formaCond = item ? ` AND ${item.sql}` : '';
  const filtroData = `($2::timestamptz IS NULL OR "createdAt" >= $2)`;
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS total,
           coalesce(avg(total),0)::numeric(12,2) AS ticket_medio
    FROM "Invoices"
    WHERE "SalonId" = $1 AND status <> 'voided' AND "paymentStatus" = 'paid'
      AND ${filtroData}${formaCond}
  `, [salonId, inicio]);
  const porForma = await sql(`
    SELECT coalesce("paymentMethod",'—') AS forma_pagamento,
           count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS total
    FROM "Invoices"
    WHERE "SalonId" = $1 AND status <> 'voided' AND "paymentStatus" = 'paid'
      AND ${filtroData}${formaCond}
    GROUP BY "paymentMethod" ORDER BY total DESC
  `, [salonId, inicio]);
  return { totais, por_forma_pagamento: porForma, pedido: especifico ? 'especifico' : 'global', filtro: item ? { forma_pagamento: item.valor } : undefined };
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

// Agenda/agendamentos por estado (global vs específico)
async function agenda(salonId, consulta) {
  const dict = [
    { rotulo: 'marcados', rotuloCurto: 'marcados', valor: 'scheduled', sql: `status = 'scheduled'` },
    { rotulo: 'em serviço', rotuloCurto: 'em servico', valor: 'in_service', sql: `status = 'in_service'` },
    { rotulo: 'em atendimento', rotuloCurto: 'em atendimento', valor: 'in_service', sql: `status = 'in_service'` },
    { rotulo: 'concluidos', rotuloCurto: 'concluidos', valor: 'completed', sql: `status = 'completed'` },
    { rotulo: 'concluidos', rotuloCurto: 'concluidos', valor: 'completed', sql: `status = 'completed'` },
    { rotulo: 'concluidos', rotuloCurto: 'concluidos', valor: 'completed', sql: `status = 'completed'` }
  ];
  const c = extrairCriterio(consulta || '', dict.map(d => ({ rotulo: d.rotulo, rotuloCurto: d.rotuloCurto, valor: d.valor })));
  const especifico = !c.global;
  const item = especifico ? dict.find(d => d.valor === c.criterio.valor) : null;
  const cond = item ? ` AND ${item.sql}` : '';

  const [totais] = await sql(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE status = 'scheduled')::int AS marcados,
           count(*) FILTER (WHERE status = 'in_service')::int AS em_servico,
           count(*) FILTER (WHERE status = 'completed')::int AS concluidos
    FROM "Appointments"
    WHERE "SalonId" = $1${cond}
  `, [salonId]);
  const lista = await sql(`
    SELECT a.id, a.date AS data, a."startTime" AS inicio, a.status AS estado,
           a.price AS valor, c.name AS cliente, s.name AS servico
    FROM "Appointments" a
    LEFT JOIN "Clients" c ON c.id = a."ClientId"
    LEFT JOIN "Services" s ON s.id = a."ServiceId"
    WHERE a."SalonId" = $1${cond}
    ORDER BY a.date DESC, a."startTime" DESC
    LIMIT 50
  `, [salonId]);
  return { totais, pedido: especifico ? 'especifico' : 'global', filtro: item ? { estado: item.valor } : undefined, lista };
}

// Serviços e preços
async function servicos(salonId) {
  return sql(`
    SELECT id, name AS nome, price AS preco, duration AS duracao_min,
           active AS ativo
    FROM "Services"
    WHERE "SalonId" = $1
    ORDER BY name ASC
    LIMIT 100
  `, [salonId]);
}

// Profissionais
async function profissionais(salonId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS profissionais,
           count(*) FILTER (WHERE active = true)::int AS ativos
    FROM "Professionals"
    WHERE "SalonId" = $1
  `, [salonId]);
  const lista = await sql(`
    SELECT id, name AS nome, role AS funcao, active AS ativo,
           coalesce(commissionRate,0) AS comissao
    FROM "Professionals"
    WHERE "SalonId" = $1
    ORDER BY name ASC
    LIMIT 100
  `, [salonId]);
  return { totais, lista };
}

export const FERRAMENTAS_XONGUILE = {
  buscar_produtos: (p = {}) => buscarProdutos(p.termos, salaoDe(p)),
  vendas: (p = {}) => resumoVendas(p.periodo ?? 'total', salaoDe(p), p.consulta),
  top_produtos: (p = {}) => topProdutos(salaoDe(p)),
  estoque_baixo: (p = {}) => estoqueBaixo(salaoDe(p)),
  clientes: (p = {}) => resumoClientes(salaoDe(p)),
  detalhe_produto: (p = {}) => detalheProduto(p.id, salaoDe(p)),
  agenda: (p = {}) => agenda(salaoDe(p), p.consulta),
  servicos: (p = {}) => servicos(salaoDe(p)),
  profissionais: (p = {}) => profissionais(salaoDe(p)),
  relatorio_insight: (p = {}) => relatorioInsight(salaoDe(p))
};

// Relatório próprio da ferramenta: serviços mais vendidos + faturação por profissional
async function relatorioInsight(salonId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS clientes FROM "Clients" WHERE "SalonId"=$1`, [salonId]);
  const topServicos = await sql(`
    SELECT it.name AS servico, it.type AS tipo,
           sum(it.quantity)::int AS unidades, sum(it.total)::numeric(12,2) AS receita
    FROM "InvoiceItems" it JOIN "Invoices" inv ON inv.id=it."InvoiceId"
    WHERE it."SalonId"=$1 AND inv.status<>'voided'
    GROUP BY it.name, it.type ORDER BY receita DESC LIMIT 15`, [salonId]);
  const faturacaoMes = await sql(`
    SELECT to_char(date_trunc('month',"createdAt"),'YYYY-MM') AS mes,
           count(*)::int AS faturas, coalesce(sum(total),0)::numeric(12,2) AS total
    FROM "Invoices" WHERE "SalonId"=$1 AND status<>'voided' AND "paymentStatus"='paid'
    GROUP BY mes ORDER BY mes DESC LIMIT 12`, [salonId]);
  return { fonte: 'relatorio_criado_pela_ferramenta', totais, top_servicos: topServicos, faturacao_por_mes: faturacaoMes };
}

export async function executarFerramentaXonguile(nome, params = {}) {
  const ferramenta = FERRAMENTAS_XONGUILE[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}

export { buscarProdutos };
