/**
 * ═══════════════════════════════════════════════════════════════════
 *  SMARTSCHOOL — registo de ferramentas (todas APENAS LEITURA).
 *  Scoping multi-tenant por escola (`escolaId`, do token).
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.SMARTSCHOOL_DATABASE_URL);

function escolaDe(params) {
  if (!params?.escolaId) throw new Error('Sessão sem escola: inicie sessão.');
  return params.escolaId;
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

async function resumoVendas(periodo, escolaId) {
  const inicio = periodo === 'total' ? null : janelaTempo(periodo);
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum("valorPago"),0)::numeric(12,2) AS total,
           coalesce(avg("valorPago"),0)::numeric(12,2) AS ticket_medio
    FROM "Mensalidade"
    WHERE "escolaId" = $1 AND "valorPago" > 0 AND (\$2::timestamptz IS NULL OR "updatedAt" >= \$2)
  `, [escolaId, inicio]);
  return { totais, por_forma_pagamento: [] };
}

async function clientes(escolaId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS clientes,
           count(*) FILTER (WHERE status = 'ativo')::int AS ativos,
           count(*) FILTER (WHERE "createdAt" >= now() - interval '30 days')::int AS novos_30d
    FROM "Aluno"
    WHERE "escolaId" = $1
  `, [escolaId]);
  const lista = await sql(`
    SELECT id, nome, apelido, "numeroProcesso" AS numero_processo, turmaId,
           coalesce(status,'—') AS status
    FROM "Aluno"
    WHERE "escolaId" = $1
    ORDER BY nome ASC
    LIMIT 100
  `, [escolaId]);
  return { totais, lista };
}

async function turmas(escolaId) {
  return sql(`
    SELECT nome, classe, turno, "vagasOcupadas" AS alunos,
           "capacidadeMaxima" AS capacidade
    FROM "Turma"
    WHERE "tenantId" = $1 AND ativa = true
    ORDER BY classe, nome
    LIMIT 50
  `, [escolaId]);
}

async function buscarAluno(termos, escolaId) {
  const t = `%${String(termos || '').toLowerCase()}%`;
  return sql(`
    SELECT id, nome, apelido, "numeroProcesso" AS numero_processo, turmaId, status
    FROM "Aluno"
    WHERE "escolaId" = $1 AND (lower(nome) LIKE $2 OR lower(apelido) LIKE $2 OR lower(coalesce("numeroProcesso",'')) LIKE $2)
    ORDER BY nome ASC
    LIMIT 10
  `, [escolaId, t]);
}

export const FERRAMENTAS_SMARTSCHOOL = {
  vendas: (p = {}) => resumoVendas(p.periodo ?? 'total', escolaDe(p)),
  clientes: (p = {}) => clientes(escolaDe(p)),
  turmas: (p = {}) => turmas(escolaDe(p)),
  buscar_aluno: (p = {}) => buscarAluno(p.termos, escolaDe(p))
};

export async function executarFerramentaSmartschool(nome, params = {}) {
  const ferramenta = FERRAMENTAS_SMARTSCHOOL[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}
