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
  const lista = await sql(`SELECT id, nome FROM fornecedores ORDER BY nome ASC LIMIT 100`);
  return { totais: { fornecedores: lista.length, novos_30d: 0 }, lista };
}

async function funcionarios() {
  const lista = await sql(`
    SELECT f.id, f.nome, coalesce(f.cargo,'—') AS cargo, coalesce(s.nome,'—') AS setor
    FROM funcionarios f
    LEFT JOIN setores s ON s.id = f.setor_id
    ORDER BY f.nome ASC LIMIT 100
  `);
  return { totais: { funcionarios: lista.length, novos_30d: 0 }, lista };
}

async function setores() {
  const lista = await sql(`SELECT id, nome FROM setores ORDER BY nome ASC LIMIT 100`);
  return { totais: { setores: lista.length, novos_30d: 0 }, lista };
}

async function movimentos() {
  const lista = await sql(`
    SELECT id, guia, tipo, equipamento, coalesce(marca,'') AS marca,
           coalesce(numero_serie,'') AS numero_serie, data, coalesce(status,'') AS status,
           coalesce(motivo,'') AS motivo
    FROM movimentos
    ORDER BY id DESC LIMIT 50
  `);
  const [totais] = await sql(`SELECT count(*)::int AS total, count(*) FILTER (WHERE tipo='ENTRADA')::int AS entradas, count(*) FILTER (WHERE tipo='SAIDA')::int AS saidas FROM movimentos`);
  return { totais, lista };
}

async function materialSobrante() {
  const lista = await sql(`
    SELECT id, local_id AS local, tipo_material_id AS tipo_material,
           quantidade_total::int AS quantidade_total, quantidade_bom::int AS bom, quantidade_mau::int AS mau
    FROM eleitoral_material_sobrante
    ORDER BY id DESC LIMIT 50
  `);
  const [totais] = await sql(`
    SELECT count(*)::int AS registos,
           coalesce(sum(quantidade_bom),0)::int AS total_bom,
           coalesce(sum(quantidade_mau),0)::int AS total_mau
    FROM eleitoral_material_sobrante
  `);
  return { totais, lista };
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
  setores: () => setores(),
  movimentos: () => movimentos(),
  material_sobrante: () => materialSobrante(),
  buscar_equipamento: (p = {}) => buscarEquipamento(p.termos)
};

export async function executarFerramentaDdgei(nome, params = {}) {
  const ferramenta = FERRAMENTAS_DDGEI[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}
