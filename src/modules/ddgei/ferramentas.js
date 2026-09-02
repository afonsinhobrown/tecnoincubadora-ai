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

import { extrairCriterio } from '../../criterios/index.js';

// Dicionário de departamentos reais (setores) para distinguir global/específico
async function departamentosDicionario() {
  const setores = await sql(`SELECT id, nome FROM setores ORDER BY nome`);
  return setores.map(s => {
    // rotuloCurto: sem prefixos genéricos (departamento de/das, gabinete...)
    const curto = String(s.nome).replace(/^(DEPARTAMENTO|SETOR|SECTOR|GABINETE|REPARTI[ÇC][AÃ]O|DIREC[ÇC][AÃ]O|DOOE|DDGEI|UGEA)\s+(DE|DO|DA|DOS|DAS)?\s*/i, '').trim();
    return { rotulo: s.nome, rotuloCurto: curto, valor: s.id, campo: 'setor_id' };
  });
}

async function funcionarios({ setor, consulta } = {}) {
  const dicionario = await departamentosDicionario();

  // 1) setor explícito do LLM? 2) deduzir do texto da pergunta (dicionário)
  let criterio = null;
  if (setor && String(setor).trim()) {
    const c = extrairCriterio(String(setor), dicionario);
    if (!c.global) criterio = c.criterio;
  }
  if (!criterio && consulta) {
    const c = extrairCriterio(String(consulta), dicionario);
    if (!c.global) criterio = c.criterio;
  }

  const especifico = !!criterio; // distingue pedido específico vs global
  const lista = especifico
    ? await sql(`
        SELECT f.id, f.nome, coalesce(f.cargo,'—') AS cargo, coalesce(s.nome,'—') AS setor
        FROM funcionarios f
        LEFT JOIN setores s ON s.id = f.setor_id
        WHERE f.setor_id = $1
        ORDER BY f.nome ASC LIMIT 200
      `, [criterio.valor])
    : await sql(`
        SELECT f.id, f.nome, coalesce(f.cargo,'—') AS cargo, coalesce(s.nome,'—') AS setor
        FROM funcionarios f
        LEFT JOIN setores s ON s.id = f.setor_id
        ORDER BY f.nome ASC LIMIT 200
      `);
  return {
    totais: { funcionarios: lista.length, novos_30d: 0 },
    pedido: especifico ? 'especifico' : 'global',
    filtro: criterio ? { departamento: criterio.valor } : undefined,
    lista
  };
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

async function inventarioLocal(consulta) {
  const dict = await (async () => {
    const s = await sql(`SELECT DISTINCT setor_id, local_uso FROM inventario_local WHERE setor_id IS NOT NULL OR local_uso IS NOT NULL AND local_uso<>''`);
    return [];
  })();
  const lista = await sql(`
    SELECT id, equipamento AS equipamento, coalesce(marca,'—') AS marca,
           coalesce(numero_serie,'—') AS numero_serie, quantidade::int AS quantidade,
           coalesce(status,'—') AS estado, coalesce(local_uso,'—') AS local_uso
    FROM inventario_local
    ORDER BY local_uso, equipamento LIMIT 200
  `);
  const [totais] = await sql(`SELECT count(*)::int AS itens, count(*) FILTER (WHERE status='Disponível')::int AS disponiveis FROM inventario_local`);
  return { totais, pedido: 'global', lista };
}

async function processosEleitorais() {
  return sql(`SELECT id, nome, tipo, ano, coalesce(estado,'—') AS estado, data_inicio, data_fim FROM eleitoral_processo_eleitoral ORDER BY ano DESC`);
}

async function locaisArmazenamento() {
  return sql(`SELECT id, coalesce(tipo,'—') AS tipo_local, coalesce(nome,'—') AS nome, activo AS ativo, parent_id AS local_pai FROM eleitoral_local_armazenamento ORDER BY nome LIMIT 200`);
}

async function tiposMaterial() {
  return sql(`SELECT id, coalesce(categoria_id::text,'—') AS categoria, coalesce(nome,'—') AS nome, coalesce(variante,'') AS variante, coalesce(unidade_medida,'') AS unidade FROM eleitoral_tipo_material WHERE activo = 1 ORDER BY nome LIMIT 200`);
}

async function movimentoMaterial() {
  const lista = await sql(`
    SELECT m.id, p.nome AS processo, m.estado AS estado, m.data_envio, m.data_recepcao,
           lo.nome AS local_origem, ld.nome AS local_destino
    FROM eleitoral_movimento_material m
    LEFT JOIN eleitoral_processo_eleitoral p ON p.id = m.processo_id
    LEFT JOIN eleitoral_local_armazenamento lo ON lo.id = m.local_origem_id
    LEFT JOIN eleitoral_local_armazenamento ld ON ld.id = m.local_destino_id
    ORDER BY m.data_envio DESC LIMIT 100
  `);
  return { totais: { movimentos: lista.length }, lista };
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

// Relatório tipo dashboard STAE (replica /relatorios sobre a BD)
async function relatorios({ consulta, abas = ['inventario', 'movimentos'] } = {}) {
  const c = extrairCriterio(consulta || '', [
    { rotulo: 'entradas e saídas', rotuloCurto: 'entradas', valor: 'entradas_saidas' },
    { rotulo: 'entradas saídas', rotuloCurto: 'entradas', valor: 'entradas_saidas' },
    { rotulo: 'movimentos', rotuloCurto: 'movimentos', valor: 'movimentos' },
    { rotulo: 'inventário', rotuloCurto: 'inventario', valor: 'inventario' }
  ].map(d => ({ rotulo: d.rotulo, rotuloCurto: d.rotuloCurto, valor: d.valor })));
  const abasFinal = c.global ? ['inventario', 'movimentos'] : [c.criterio.valor];

  const out = {};
  if (abasFinal.includes('inventario')) {
    out.inventario = await sql(`
      SELECT i.equipamento AS equipamento, coalesce(i.marca,'—') AS marca, i.numero_serie AS numero_serie,
             coalesce(i.quantidade,1) AS quantidade, i.status AS estado, coalesce(s.nome,'—') AS setor
      FROM inventario_local i LEFT JOIN setores s ON s.id = i.setor_id
      WHERE i.status <> 'Pendente' ORDER BY i.id DESC
    `);
  }
  if (abasFinal.includes('movimentos') || abasFinal.includes('entradas_saidas')) {
    const where = abasFinal.includes('entradas_saidas') ? " AND m.tipo IN ('ENTRADA','SAIDA')" : '';
    out.movimentos = await sql(`
      SELECT m.guia, m.tipo, m.equipamento, coalesce(m.marca,'—') AS marca, m.numero_serie AS numero_serie,
             m.origem_destino, m.quantidade, m.data, m.status, m.tecnico, m.motivo
      FROM movimentos m WHERE 1=1${where} ORDER BY m.id DESC
    `);
  }
  // Estatísticas (gráficos)
  const stat_equip = await sql(`
    SELECT COALESCE(equipamento,'N/A') AS equipamento,
           SUM(CASE WHEN tipo='ENTRADA' THEN COALESCE(CAST(quantidade AS INTEGER),1) ELSE 0 END) AS entradas,
           SUM(CASE WHEN tipo IN ('SAIDA','TRANSFERENCIA') THEN COALESCE(CAST(quantidade AS INTEGER),1) ELSE 0 END) AS saidas
    FROM movimentos GROUP BY equipamento ORDER BY equipamento`);
  const stat_setor = await sql(`
    SELECT COALESCE(NULLIF(origem_destino,''),'N/A') AS origem, COUNT(*) AS total
    FROM movimentos WHERE tipo='ENTRADA' GROUP BY origem ORDER BY total DESC LIMIT 10`);
  const stat_marca = await sql(`
    SELECT COALESCE(NULLIF(marca,''),'N/A') AS marca,
           SUM(CASE WHEN tipo='ENTRADA' THEN COALESCE(CAST(quantidade AS INTEGER),1) ELSE 0 END) AS entradas,
           SUM(CASE WHEN tipo IN ('SAIDA','TRANSFERENCIA') THEN COALESCE(CAST(quantidade AS INTEGER),1) ELSE 0 END) AS saidas
    FROM movimentos GROUP BY marca ORDER BY marca`);
  return { abas: abasFinal, pedido: c.global ? 'global' : 'especifico', ...out, estatisticas: { por_equipamento: stat_equip, por_origem: stat_setor, por_marca: stat_marca } };
}

// Relatório próprio da ferramenta (insight que o sistema não gera):
// distribuição de funcionários por departamento + movimentos por tipo/estado
async function relatorioInsight({ consulta } = {}) {
  const c = extrairCriterio(consulta || '', [
    { rotulo: 'funcionários', rotuloCurto: 'funcionarios', valor: 'funcionarios' },
    { rotulo: 'departamento', rotuloCurto: 'departamento', valor: 'funcionarios' },
    { rotulo: 'movimentos', rotuloCurto: 'movimentos', valor: 'movimentos' },
    { rotulo: 'equipamentos', rotuloCurto: 'equipamentos', valor: 'equipamentos' }
  ].map(d => ({ rotulo: d.rotulo, rotuloCurto: d.rotuloCurto, valor: d.valor })));
  const alvo = c.global ? 'geral' : c.criterio.valor;

  const insights = {};
  if (alvo === 'geral' || alvo === 'funcionarios') {
    insights.funcionarios_por_departamento = await sql(`
      SELECT coalesce(s.nome,'(sem setor)') AS departamento, count(f.id)::int AS funcionarios
      FROM funcionarios f LEFT JOIN setores s ON s.id = f.setor_id
      GROUP BY s.nome ORDER BY funcionarios DESC`);
  }
  if (alvo === 'geral' || alvo === 'movimentos') {
    insights.movimentos_por_tipo_estado = await sql(`
      SELECT tipo, status, count(*)::int AS total
      FROM movimentos GROUP BY tipo, status ORDER BY total DESC`);
  }
  if (alvo === 'geral' || alvo === 'equipamentos') {
    insights.equipamentos_por_estado = await sql(`
      SELECT coalesce(status,'—') AS estado, count(*)::int AS total
      FROM inventario_local GROUP BY status ORDER BY total DESC`);
  }
  return { fonte: 'relatorio_criado_pela_ferramenta', pedido: c.global ? 'global' : 'especifico', abrangencia: alvo, insights };
}

export const FERRAMENTAS_DDGEI = {
  inventario: () => inventario(),
  tipos: () => tipos(),
  fornecedores: () => fornecedores(),
  funcionarios: (p = {}) => funcionarios(p),
  setores: () => setores(),
  movimentos: () => movimentos(),
  inventario_local: (p = {}) => inventarioLocal(p.consulta),
  processos_eleitorais: () => processosEleitorais(),
  locais_armazenamento: () => locaisArmazenamento(),
  tipos_material: () => tiposMaterial(),
  movimento_material: () => movimentoMaterial(),
  material_sobrante: () => materialSobrante(),
  relatorios: (p = {}) => relatorios(p),
  relatorio_insight: (p = {}) => relatorioInsight(p),
  buscar_equipamento: (p = {}) => buscarEquipamento(p.termos)
};

export async function executarFerramentaDdgei(nome, params = {}) {
  const ferramenta = FERRAMENTAS_DDGEI[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}
