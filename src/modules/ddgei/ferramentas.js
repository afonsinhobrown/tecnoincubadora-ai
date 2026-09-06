/**
 * ═══════════════════════════════════════════════════════════════════
 *  DDGEI — registo de ferramentas (todas APENAS LEITURA).
 *  Sistema institucional (single-tenant).
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DDGEI_DATABASE_URL);

import { extrairCriterio } from '../../criterios/index.js';

// Tipo de equipamento mencionado na pergunta (ex "laptop", "impressora").
// Devolve o nome real em inventario_local, ou null se a pergunta não o citar.
async function tipoEquipamentoDaConsulta(consulta) {
  const q = String(consulta || '').trim();
  if (!q) return null;
  const tipos = await sql(`SELECT nome FROM tipos_equipamento WHERE nome IS NOT NULL AND lower(nome) <> 'outro' ORDER BY nome`);
  const dicionario = tipos.map(t => ({ rotulo: t.nome, rotuloCurto: t.nome, valor: t.nome, campo: 'equipamento' }));
  const c = extrairCriterio(q, dicionario);
  return c.global ? null : c.criterio.valor;
}

async function inventario({ consulta } = {}) {
  const tipo = await tipoEquipamentoDaConsulta(consulta);
  const where = tipo ? `WHERE i.equipamento ILIKE $1` : '';
  const params = tipo ? [`%${tipo}%`] : [];
  const [resumo] = await sql(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE status IS NOT NULL AND status <> '')::int AS com_estado,
           count(*) FILTER (WHERE status = 'Disponível')::int AS disponiveis
    FROM inventario_local i
    ${where}
  `, params);
  const porEstado = await sql(`
    SELECT coalesce(status,'—') AS estado, count(*)::int AS total
    FROM inventario_local i
    ${where}
    GROUP BY status ORDER BY total DESC
  `, params);
  const lista = await sql(`
    SELECT i.id, i.equipamento AS equipamento, coalesce(i.marca,'—') AS marca,
           coalesce(i.numero_serie,'—') AS numero_serie, coalesce(i.quantidade,1)::int AS quantidade,
           coalesce(i.status,'—') AS estado, coalesce(s.nome,'—') AS local_uso
    FROM inventario_local i
    LEFT JOIN setores s ON s.id = i.setor_id
    ${where}
    ORDER BY i.id DESC LIMIT 300
  `, params);
  const filtro = tipo ? { equipamento: tipo } : undefined;
  return {
    totais: { total: resumo.total, com_estado: resumo.com_estado, disponiveis: resumo.disponiveis },
    por_estado: porEstado,
    lista,
    pedido: tipo ? 'especifico' : 'global',
    filtro
  };
}

async function tipos() {
  return sql(`SELECT id, nome FROM tipos_equipamento ORDER BY nome ASC LIMIT 50`);
}

async function fornecedores() {
  const lista = await sql(`SELECT id, nome FROM fornecedores ORDER BY nome ASC LIMIT 100`);
  return { totais: { fornecedores: lista.length, novos_30d: 0 }, lista };
}

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

async function movimentos({ consulta } = {}) {
  const conds = [];
  const params = [];
  const q = String(consulta || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const mesNome = MESES.find(m => q.includes(m));
  if (mesNome) {
    const ano = (q.match(/20\d{2}/) || [])[0] || String(new Date().getFullYear());
    const mes = 1 + MESES.indexOf(mesNome);
    const y = Number(ano);
    const ini = `${y}-${String(mes).padStart(2, '0')}-01`;
    const fim = mes === 12 ? `${y + 1}-01-01` : `${y}-${String(mes + 1).padStart(2, '0')}-01`;
    params.push(ini, fim);
    conds.push(`data >= $${params.length - 1} AND data < $${params.length}`);
  }
  const entradas = /\bentradas?\b/.test(q);
  const saidas = /\bsaidas?\b/.test(q);
  if (entradas || saidas) {
    const tipos = [];
    if (entradas) tipos.push('ENTRADA');
    if (saidas) tipos.push('SAIDA');
    params.push(tipos);
    conds.push(`tipo = ANY($${params.length})`);
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const lista = await sql(`
    SELECT id, guia, tipo, equipamento, coalesce(marca,'') AS marca,
           coalesce(numero_serie,'') AS numero_serie, data, coalesce(status,'') AS status,
           coalesce(motivo,'') AS motivo
    FROM movimentos
    ${where}
    ORDER BY id DESC LIMIT 100
  `, params);
  const [totais] = await sql(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE tipo='ENTRADA')::int AS entradas,
           count(*) FILTER (WHERE tipo='SAIDA')::int AS saidas
    FROM movimentos
    ${where}
  `, params);
  const filtro = {};
  if (mesNome) filtro.mes = mesNome;
  if (entradas || saidas) filtro.tipos = [entradas ? 'entradas' : null, saidas ? 'saidas' : null].filter(Boolean).join(' e ');
  return {
    totais,
    pedido: (mesNome || entradas || saidas) ? 'especifico' : 'global',
    filtro: Object.keys(filtro).length ? filtro : undefined,
    lista
  };
}

async function inventarioLocal({ consulta } = {}) {
  const dicionario = await departamentosDicionario();
  let criterio = null;
  if (consulta && String(consulta).trim()) {
    const c = extrairCriterio(String(consulta), dicionario);
    if (!c.global) criterio = c.criterio;
  }
  const tipo = await tipoEquipamentoDaConsulta(consulta);

  const conds = [];
  const params = [];
  if (criterio) { conds.push('i.setor_id = $' + (params.length + 1)); params.push(criterio.valor); }
  if (tipo) { conds.push('i.equipamento ILIKE $' + (params.length + 1)); params.push(`%${tipo}%`); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const lista = await sql(`
    SELECT i.id, i.equipamento AS equipamento, coalesce(i.marca,'—') AS marca,
           coalesce(i.numero_serie,'—') AS numero_serie, coalesce(i.quantidade,1)::int AS quantidade,
           coalesce(i.status,'—') AS estado, coalesce(s.nome,'—') AS local_uso
    FROM inventario_local i
    LEFT JOIN setores s ON s.id = i.setor_id
    ${where}
    ORDER BY local_uso, i.equipamento LIMIT 300
  `, params);
  const [totais] = await sql(`
    SELECT count(*)::int AS itens, count(*) FILTER (WHERE status='Disponível')::int AS disponiveis
    FROM inventario_local i ${where}
  `, params);

  const filtro = {
    ...(criterio ? { local: criterio.valor } : {}),
    ...(tipo ? { equipamento: tipo } : {})
  };
  return {
    totais,
    pedido: (criterio || tipo) ? 'especifico' : 'global',
    filtro: Object.keys(filtro).length ? filtro : undefined,
    lista
  };
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

async function provinciasDicionario() {
  const rows = await sql(`SELECT id, nome FROM eleitoral_provincia WHERE activo = 1 ORDER BY nome`);
  return rows.map(p => ({ rotulo: p.nome, rotuloCurto: p.nome, valor: p.id, campo: 'provincia_id' }));
}

async function materialSobrante({ provincia } = {}) {
  let criterio = null;
  if (provincia && String(provincia).trim()) {
    const dicionario = await provinciasDicionario();
    const c = extrairCriterio(String(provincia), dicionario);
    if (!c.global) criterio = c.criterio;
  }

  const where = criterio ? `WHERE la.provincia_id = $1` : '';
  const params = criterio ? [criterio.valor] : [];

  const lista = await sql(`
    SELECT ms.id, coalesce(la.nome, ms.local_id::text) AS local,
           p.nome AS provincia, tm.nome AS tipo_material,
           ms.quantidade_total::int AS quantidade_total, ms.quantidade_bom::int AS bom, ms.quantidade_mau::int AS mau
    FROM eleitoral_material_sobrante ms
    LEFT JOIN eleitoral_local_armazenamento la ON la.id = ms.local_id
    LEFT JOIN eleitoral_provincia p ON p.id = la.provincia_id
    LEFT JOIN eleitoral_tipo_material tm ON tm.id = ms.tipo_material_id
    ${where}
    ORDER BY ms.id DESC LIMIT 50
  `, params);
  const [totais] = await sql(`
    SELECT count(*)::int AS registos,
           coalesce(sum(ms.quantidade_bom),0)::int AS total_bom,
           coalesce(sum(ms.quantidade_mau),0)::int AS total_mau
    FROM eleitoral_material_sobrante ms
    LEFT JOIN eleitoral_local_armazenamento la ON la.id = ms.local_id
    ${where}
  `, params);
  return {
    totais,
    pedido: criterio ? 'especifico' : 'global',
    filtro: criterio ? { provincia: criterio.valor } : undefined,
    lista
  };
}

async function buscarEquipamento({ termos, consulta } = {}) {
  let base = String(termos || '').trim().toLowerCase();
  if (!base && consulta) {
    // se o modelo não enviou termos, deduz o tipo de equipamento do pedido
    const tipo = await tipoEquipamentoDaConsulta(consulta);
    base = (tipo || String(consulta)).toLowerCase();
  }
  const t = `%${base}%`;
  return sql(`
    SELECT i.id, i.equipamento AS nome, coalesce(i.marca,'—') AS marca,
           coalesce(i.numero_serie,'—') AS numero_serie, coalesce(i.quantidade,1)::int AS quantidade,
           coalesce(i.status,'—') AS estado, coalesce(s.nome,'—') AS local_uso
    FROM inventario_local i
    LEFT JOIN setores s ON s.id = i.setor_id
    WHERE lower(coalesce(i.equipamento,'')) LIKE $1
       OR lower(coalesce(i.marca,'')) LIKE $1
       OR lower(coalesce(i.numero_serie,'')) LIKE $1
    ORDER BY i.id DESC LIMIT 20
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
  inventario: (p = {}) => inventario(p),
  tipos: () => tipos(),
  fornecedores: () => fornecedores(),
  funcionarios: (p = {}) => funcionarios(p),
  setores: () => setores(),
  movimentos: (p = {}) => movimentos(p),
  inventario_local: (p = {}) => inventarioLocal(p),
  processos_eleitorais: () => processosEleitorais(),
  locais_armazenamento: () => locaisArmazenamento(),
  tipos_material: () => tiposMaterial(),
  movimento_material: () => movimentoMaterial(),
  material_sobrante: (p = {}) => materialSobrante(p),
  relatorios: (p = {}) => relatorios(p),
  relatorio_insight: (p = {}) => relatorioInsight(p),
  buscar_equipamento: (p = {}) => buscarEquipamento(p)
};

export async function executarFerramentaDdgei(nome, params = {}) {
  const ferramenta = FERRAMENTAS_DDGEI[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}
