/**
 * ═══════════════════════════════════════════════════════════════════
 *  DDGEI — registo de ferramentas (todas APENAS LEITURA).
 *  Sistema institucional (single-tenant).
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DDGEI_DATABASE_URL);

async function inventario() {
  const [resumo] = await sql(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE estado IS NOT NULL AND estado <> '')::int AS com_estado
    FROM equipamento_rastreio
  `);
  const porEstado = await sql(`
    SELECT coalesce(estado,'—') AS estado, count(*)::int AS total
    FROM equipamento_rastreio
    GROUP BY estado ORDER BY total DESC
  `);
  return { totais: { total: resumo.total, com_estado: resumo.com_estado }, por_estado: porEstado };
}

async function tipos() {
  return sql(`SELECT id, nome FROM tipos_equipamento ORDER BY nome ASC LIMIT 50`);
}

async function fornecedores() {
  const [r] = await sql(`SELECT count(*)::int AS fornecedores FROM fornecedores`);
  return { fornecedores: r.fornecedores, novos_30d: 0 };
}

async function funcionarios() {
  const [r] = await sql(`SELECT count(*)::int AS funcionarios FROM funcionarios`);
  return { funcionarios: r.funcionarios, novos_30d: 0 };
}

async function buscarEquipamento(termos) {
  const t = `%${String(termos || '').toLowerCase()}%`;
  return sql(`
    SELECT id, equipamento AS nome, marca, numero_serie, estado, local_atual
    FROM equipamento_rastreio
    WHERE lower(coalesce(equipamento,'')) LIKE $1 OR lower(coalesce(marca,'')) LIKE $1 OR lower(coalesce(numero_serie,'')) LIKE $1
    ORDER BY id DESC LIMIT 20
  `, [t]);
}

export const FERRAMENTAS_DDGEI = {
  inventario: () => inventario(),
  tipos: () => tipos(),
  fornecedores: () => fornecedores(),
  funcionarios: () => funcionarios(),
  buscar_equipamento: (p = {}) => buscarEquipamento(p.termos)
};

export async function executarFerramentaDdgei(nome, params = {}) {
  const ferramenta = FERRAMENTAS_DDGEI[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}
