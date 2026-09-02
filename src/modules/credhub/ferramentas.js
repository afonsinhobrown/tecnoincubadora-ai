/**
 * ═══════════════════════════════════════════════════════════════════
 *  CREDHUBMZ — registo de ferramentas (todas APENAS LEITURA).
 *  Schema-per-tenant: as consultas correm no schema do tenant autenticado.
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.CREDHUB_DATABASE_URL);

// schema vem da BD (tenant autenticado); limita a caracteres seguros
function schemaDe(params) {
  const s = params?.schema;
  if (!s || !/^[a-z0-9_]+$/i.test(s)) throw new Error('Sessão sem tenant: inicie sessão.');
  return s;
}
const q = s => `"${s}"`;

async function carteira(schema) {
  const [resumo] = await sql(`
    SELECT count(*)::int AS emprestimos,
           coalesce(sum(amount),0)::numeric(12,2) AS total_emprestado,
           coalesce(sum(balance),0)::numeric(12,2) AS saldo_por_cobrar
    FROM ${q(schema)}.loans
  `);
  const porEstado = await sql(`
    SELECT coalesce(status,'—') AS status, count(*)::int AS total,
           coalesce(sum(balance),0)::numeric(12,2) AS saldo
    FROM ${q(schema)}.loans
    GROUP BY status ORDER BY total DESC
  `);
  return {
    totais: {
      pedidos: resumo.emprestimos,
      total: resumo.total_emprestado,
      ticket_medio: resumo.emprestimos ? resumo.total_emprestado / resumo.emprestimos : 0
    },
    por_forma_pagamento: porEstado.map(r => ({ forma_pagamento: r.status, pedidos: r.total, total: r.saldo }))
  };
}

async function clientes(schema) {
  const [totais] = await sql(`
    SELECT count(*)::int AS clientes,
           count(*) FILTER (WHERE status = 'active')::int AS ativos,
           count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS novos_30d
    FROM ${q(schema)}.clients
  `);
  return totais;
}

async function topClientes(schema) {
  return sql(`
    SELECT c.full_name AS nome,
           count(l.id)::int AS quantidade_vendida,
           coalesce(sum(l.amount),0)::numeric(12,2) AS receita
    FROM ${q(schema)}.clients c
    LEFT JOIN ${q(schema)}.loans l ON l.client_id = c.id
    GROUP BY c.full_name
    ORDER BY receita DESC
    LIMIT 10
  `);
}

async function cobrancas(schema) {
  const [totais] = await sql(`
    SELECT count(*)::int AS pagamentos,
           coalesce(sum(amount),0)::numeric(12,2) AS total_recebido
    FROM ${q(schema)}.payments
    WHERE status = 'paid' AND paid_at >= now() - interval '30 days'
  `);
  return totais;
}

async function buscarCliente(termos, schema) {
  const t = `%${String(termos || '').toLowerCase()}%`;
  return sql(`
    SELECT id, full_name AS nome, doc_number AS documento, phone AS telefone, status
    FROM ${q(schema)}.clients
    WHERE lower(coalesce(full_name,'')) LIKE $1 OR lower(coalesce(doc_number,'')) LIKE $1
    ORDER BY full_name ASC
    LIMIT 10
  `, [t]);
}

async function emprestimosEstado(schema) {
  return sql(`
    SELECT coalesce(status,'—') AS estado, count(*)::int AS total,
           coalesce(sum(amount),0)::numeric(12,2) AS valor,
           coalesce(sum(balance),0)::numeric(12,2) AS saldo
    FROM ${q(schema)}.loans
    GROUP BY status ORDER BY total DESC
  `);
}

async function atrasos(schema) {
  return sql(`
    SELECT c.full_name AS cliente, l.amount AS valor, l.balance AS saldo, l.status
    FROM ${q(schema)}.loans l
    JOIN ${q(schema)}.clients c ON c.id = l.client_id
    WHERE l.balance > 0 AND l.status IN ('late','overdue','atrasado','active')
    ORDER BY l.balance DESC LIMIT 50
  `);
}

async function grupos(schema) {
  // tenta várias tabelas de grupos
  try {
    return await sql(`SELECT count(*)::int AS grupos FROM ${q(schema)}.groups`);
  } catch { return [{ grupos: 0 }]; }
}

export const FERRAMENTAS_CREDHUB = {
  carteira: (p = {}) => carteira(schemaDe(p)),
  clientes: (p = {}) => clientes(schemaDe(p)),
  top_clientes: (p = {}) => topClientes(schemaDe(p)),
  cobrancas: (p = {}) => cobrancas(schemaDe(p)),
  buscar_cliente: (p = {}) => buscarCliente(p.termos, schemaDe(p)),
  emprestimos_estado: (p = {}) => emprestimosEstado(schemaDe(p)),
  atrasos: (p = {}) => atrasos(schemaDe(p)),
  grupos: (p = {}) => grupos(schemaDe(p))
};

export async function executarFerramentaCredhub(nome, params = {}) {
  const ferramenta = FERRAMENTAS_CREDHUB[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}
