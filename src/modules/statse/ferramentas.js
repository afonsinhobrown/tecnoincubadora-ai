/**
 * ═══════════════════════════════════════════════════════════════════
 *  StatsE — ferramentas de consulta (APENAS LEITURA).
 *  BD `analise_db`: tabela `eleicoes` (estrutura + valores de votação
 *  cifrados) e `resultados_partidos` (votos por partido, cifrados).
 *  Os valores numéricos são decifrados em runtime com crypto.js.
 * ═══════════════════════════════════════════════════════════════════
 */
import { decifrarInt, decifrar } from './crypto.js';
import { sqlStatse } from './db.js';

// Execução preguiçosa: resolve o cliente Neon apenas no momento da query.
const sql = (...args) => sqlStatse()(...args);

// Normaliza um texto para comparação (maiúsculas, sem acentos, sem pontuação)
function norm(texto) {
  return String(texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Ano mais recente existente, com cache (para limitar o âmbito por defeito).
let anoMax = null;
async function anoMaisRecente() {
  if (anoMax) return anoMax;
  const r = await sql(`SELECT max(ano_eleicao)::int AS ano FROM eleicoes`);
  anoMax = r[0]?.ano || 2023;
  return anoMax;
}

/**
 * Constrói o WHERE + params a partir de filtros opcionais sobre a tabela eleicoes.
 * useAlias: prefixa as colunas com `e.` (para queries com JOIN em resultados_partidos).
 */
function construirFiltro({ ano, tipo, provincia, distrito, posto, localidade }, useAlias = false) {
  const cond = [];
  const params = [];
  const p = (x) => useAlias ? `e.${x}` : x;
  const addParam = (v) => { params.push(v); return params.length; };

  if (ano !== undefined && ano !== null && ano !== '') { cond.push(`${p('ano_eleicao')} = $${addParam(Number(ano))}`); }
  if (tipo && String(tipo).trim()) { cond.push(`UPPER(${p('tipo_eleicao')}) = $${addParam(norm(tipo))}`); }
  if (provincia && String(provincia).trim()) { cond.push(`UPPER(${p('provincia')}) LIKE $${addParam(norm(provincia) + '%')}`); }
  if (distrito && String(distrito).trim()) { cond.push(`UPPER(${p('distrito')}) = $${addParam(norm(distrito))}`); }
  if (posto && String(posto).trim()) { cond.push(`UPPER(${p('posto_administrativo')}) = $${addParam(norm(posto))}`); }
  if (localidade && String(localidade).trim()) { cond.push(`UPPER(${p('localidade')}) = $${addParam(norm(localidade))}`); }

  return { where: cond.length ? `WHERE ${cond.join(' AND ')}` : '', params };
}

/**
 * 1) Estrutura/cobertura do processo eleitoral (contagens legíveis, sem decifra).
 * Responder: quantas mesas/local de voto, por província/distrito/posto/localidade.
 */
async function resumoEstrutura({ ano, tipo, provincia, distrito, posto, localidade } = {}) {
  const { where, params } = construirFiltro({ ano, tipo, provincia, distrito, posto, localidade });

  const [totais] = await sql(`
    SELECT count(*)::int AS mesas,
           count(DISTINCT local_voto)::int AS locais_voto,
           count(DISTINCT localidade)::int AS localidades
    FROM eleicoes e ${where}
  `, params);

  const provincias = await sql(`
    SELECT UPPER(provincia) AS provincia, count(*)::int mesas,
           count(DISTINCT distrito)::int distritos
    FROM eleicoes e ${where}
    GROUP BY UPPER(provincia) ORDER BY mesas DESC
  `, params);

  const anos = await sql(`
    SELECT ano_eleicao, UPPER(tipo_eleicao) AS tipo, count(*)::int mesas
    FROM eleicoes e ${where}
    GROUP BY ano_eleicao, UPPER(tipo_eleicao) ORDER BY ano_eleicao DESC
  `, params);

  return { totais, provincias, anos };
}

/**
 * 2) Totais de votação decifrados (inscritos, votantes, válidos, nulos, brancos,
 * abstenções) num âmbito. Soma as 6 colunas cifradas de todas as mesas do âmbito.
 */
async function resumoVotacao({ ano, tipo, provincia, distrito, posto, localidade } = {}) {
  if (ano === undefined || ano === null || ano === '') ano = await anoMaisRecente();
  const { where, params } = construirFiltro({ ano, tipo, provincia, distrito, posto, localidade });

  const linhas = await sql(`
    SELECT eleitores_inscritos AS insc, total_votantes AS vot, votos_validos AS val,
           votos_nulos AS nul, votos_branco AS bran, abstencoes AS abs
    FROM eleicoes e ${where}
  `, params);

  const soma = { inscritos: 0, votantes: 0, validos: 0, nulos: 0, brancos: 0, abstencoes: 0, mesas: linhas.length };
  for (const l of linhas) {
    soma.inscritos += decifrarInt(l.insc);
    soma.votantes += decifrarInt(l.vot);
    soma.validos += decifrarInt(l.val);
    soma.nulos += decifrarInt(l.nul);
    soma.brancos += decifrarInt(l.bran);
    soma.abstencoes += decifrarInt(l.abs);
  }
  if (soma.votantes > 0) soma.participacao_pct = Math.round((soma.votantes / soma.inscritos) * 1000) / 10;
  if (soma.validos > 0) soma.validos_pct = Math.round((soma.validos / soma.votantes) * 1000) / 10;
  return soma;
}

/**
 * 3) Resultados — votos por partido no âmbito, somando os valores cifrados de
 * `resultados_partidos` (unidos a `eleicoes` para respeitar o filtro territorial).
 * agrupar: 'geral' (soma tudo) ou 'provincia'.
 */
async function resultados({ ano, tipo, provincia, distrito, posto, agrupar, partido } = {}) {
  if (ano === undefined || ano === null || ano === '') ano = await anoMaisRecente();

  const partidoNorm = partido && String(partido).trim() ? norm(partido) : null;
  const matchPartido = (nome) => {
    const n = norm(nome);
    return partidoNorm ? (n === partidoNorm || n.includes(partidoNorm) || partidoNorm.includes(n)) : true;
  };

  // ── Modo "separar por província": partido+ano sem círculo eleitoral ──
  if (agrupar === 'provincia' && !provincia && !distrito && !posto) {
    const { where, params } = construirFiltro({ ano, tipo }, true);
    const linhas = await sql(`
      SELECT UPPER(e.provincia) AS provincia, UPPER(r.nome_partido) AS partido, r.votos AS voto
      FROM resultados_partidos r
      JOIN eleicoes e ON e.id = r.eleicao_id
      ${where}
    `, params);

    // agrega TODOS os partidos por província (para calcular a % de cada um)
    const porProv = new Map(); // provincia -> Map(partido->votos)
    for (const l of linhas) {
      const pv = l.provincia || '(sem província)';
      if (!porProv.has(pv)) porProv.set(pv, new Map());
      const m = porProv.get(pv);
      m.set(l.partido, (m.get(l.partido) || 0) + decifrarInt(l.voto));
    }

    const vencedorPorProvincia = [];
    const por_provincia = [];
    for (const [nome, mp] of porProv) {
      const todos = [...mp.entries()].map(([p, votos]) => ({ partido: p, votos })).sort((a, b) => b.votos - a.votos);
      const totalProv = todos.reduce((s, x) => s + x.votos, 0);
      if (todos.length) vencedorPorProvincia.push({ provincia: nome, partido: todos[0].partido, votos: todos[0].votos });
      // mostra todos os partidos (adversários) por província
      for (const x of todos) por_provincia.push({ provincia: nome, partido: x.partido, votos: x.votos, pct: totalProv ? Math.round((x.votos / totalProv) * 1000) / 10 : 0 });
    }

    const vencedorGeral = [...porProv.values()]
      .flatMap(m => [...m.entries()].map(([p, v]) => ({ partido: p, votos: v })))
      .reduce((acc, x) => { acc[x.partido] = (acc[x.partido] || 0) + x.votos; return acc; }, {});
    const venc = Object.entries(vencedorGeral).map(([p, v]) => ({ partido: p, votos: v })).sort((a, b) => b.votos - a.votos)[0] || null;

    return {
      agrupado_por: 'provincia', total_votos: venc ? venc.votos : 0, vencedor: venc,
      por_provincia, vencedor_por_provincia: vencedorPorProvincia,
      filtro: { ano, tipo, partido: partido || null }
    };
  }

  // ── Modo normal (âmbito único ou círculo eleitoral indicado) ──
  const { where, params } = construirFiltro({ ano, tipo, provincia, distrito, posto }, true);
  const linhas = await sql(`
    SELECT UPPER(r.nome_partido) AS partido, r.votos AS voto
    FROM resultados_partidos r
    JOIN eleicoes e ON e.id = r.eleicao_id
    ${where}
  `, params);

  const mapa = new Map();
  for (const l of linhas) {
    // mostra todos os partidos (adversários no mesmo local), sem filtrar por partido
    mapa.set(l.partido, (mapa.get(l.partido) || 0) + decifrarInt(l.voto));
  }
  const lista = [...mapa.entries()]
    .map(([partido, votos]) => ({ partido, votos }))
    .sort((a, b) => b.votos - a.votos);

  const total = lista.reduce((s, x) => s + x.votos, 0);
  const comPct = lista.map(x => ({ ...x, pct: total ? Math.round((x.votos / total) * 1000) / 10 : 0 }));
  const vencedor = comPct.length ? { partido: comPct[0].partido, votos: comPct[0].votos, pct: comPct[0].pct } : null;

  // ── Análise (replicada das fórmulas do eleicoes_app) ──────────────
  // percentual de votos válidos e percentual sobre os inscritos por partido + participação
  const { where: whereE, params: paramsE } = construirFiltro({ ano, tipo, provincia, distrito, posto }, false);
  const totRows = await sql(`
    SELECT eleitores_inscritos AS ins, total_votantes AS vot, votos_validos AS val
    FROM eleicoes e ${whereE}
  `, paramsE);
  let inscritos = 0, votantes = 0;
  for (const t of totRows) { inscritos += decifrarInt(t.ins); votantes += decifrarInt(t.vot); }

  const partidosAnalise = comPct.map(x => ({
    partido: x.partido, votos: x.votos,
    percentual_validos: x.pct,
    percentual_inscritos: inscritos ? Math.round((x.votos / inscritos) * 1000) / 10 : 0
  }));

  const participantes = partidosAnalise;
  const vencAnalise = participantes[0] || null;
  const segundo = participantes[1] || null;
  const participacao_pct = inscritos ? Math.round((votantes / inscritos) * 1000) / 10 : 0;

  const escopo = provincia ? ('província de ' + String(provincia).trim().toLowerCase()) : (distrito ? ('distrito de ' + String(distrito).trim().toLowerCase()) : 'a nível nacional');
  const trechos = [];
  if (vencAnalise) {
    trechos.push(`O ${vencAnalise.partido} lidera em ${escopo} no ano ${ano} com ${vencAnalise.votos.toLocaleString('pt-MZ')} votos (${vencAnalise.percentual_validos}% dos votos válidos; ${vencAnalise.percentual_inscritos}% dos inscritos).`);
    if (segundo) {
      const margem = vencAnalise.votos - segundo.votos;
      trechos.push(`Vantagem de ${margem.toLocaleString('pt-MZ')} votos sobre o ${segundo.partido} (${segundo.percentual_validos}%).`);
    }
  }
  // nota sobre o partido que o utilizador indicou (foco), se não for o líder
  const foco = partidoNorm || null;
  if (foco && vencAnalise && !matchPartido(vencAnalise.partido)) {
    const idx = partidosAnalise.findIndex(p => matchPartido(p.partido));
    if (idx >= 0) {
      const p = partidosAnalise[idx];
      const ord = ['1º', '2º', '3º', '4º', '5º'][idx] || ((idx + 1) + 'º');
      trechos.push(`O ${p.partido} que indicaste ficou em ${ord} lugar com ${p.votos.toLocaleString('pt-MZ')} votos (${p.percentual_validos}% dos votos válidos).`);
    }
  }
  if (inscritos) trechos.push(`Participação de ${participacao_pct}% (${votantes.toLocaleString('pt-MZ')} votaram de ${inscritos.toLocaleString('pt-MZ')} inscritos; abstenção de ${(100 - participacao_pct).toFixed(1)}%).`);
  const analise = { texto: trechos.join(' '), inscritos, votantes, participacao_pct };

  return {
    total_votos: total, partidos: comPct, vencedor,
    partidos_analise: partidosAnalise,
    foco, analise,
    filtro: { ano, tipo, provincia, distrito, posto, partido: partido || null }
  };
}

/**
 * 4) Pesquisa de texto — local de voto / assembleia / localidade por palavra-chave.
 * Retorna mesas que correspondem (para "quantas mesas em X" / onde fica X).
 */
async function buscar({ termo, ano } = {}) {
  const t = `%${norm(termo)}%`;
  const params = [t];
  let anoCond = '';
  if (ano) { anoCond = ' AND ano_eleicao = $2'; params.push(Number(ano)); }

  const lista = await sql(`
    SELECT id, ano_eleicao, UPPER(provincia) AS provincia, UPPER(distrito) AS distrito,
           UPPER(posto_administrativo) AS posto, UPPER(localidade) AS localidade,
           local_voto, codigo_assembleia
    FROM eleicoes
    WHERE UPPER(coalesce(local_voto,'')) LIKE $1 OR UPPER(coalesce(localidade,'')) LIKE $1
       OR UPPER(coalesce(distrito,'')) LIKE $1 OR UPPER(coalesce(codigo_assembleia,'')) LIKE $1
       OR UPPER(coalesce(posto_administrativo,'')) LIKE $1
    ${anoCond}
    ORDER BY ano_eleicao DESC, provincia, distrito
    LIMIT 50
  `, params);

  return {
    termo,
    total: lista.length,
    filtro: { ano: ano || null },
    lista
  };
}

/**
 * 5) Relatório insight por partido — distribuição de partidos e vencedor por província.
 */
async function relatorioInsight({ ano } = {}) {
  const anoAlvo = ano || await anoMaisRecente();
  const [resumo] = await sql(`
    SELECT count(*)::int mesas,
           count(DISTINCT upper(provincia))::int provincias
    FROM eleicoes WHERE ano_eleicao = $1
  `, [Number(anoAlvo)]);

  const provPartido = await sql(`
    SELECT e.ano_eleicao, UPPER(e.provincia) AS provincia, UPPER(r.nome_partido) AS partido,
           count(*)::int mesas
    FROM resultados_partidos r
    JOIN eleicoes e ON e.id = r.eleicao_id
    WHERE e.ano_eleicao = $1
    GROUP BY e.ano_eleicao, UPPER(e.provincia), UPPER(r.nome_partido)
    ORDER BY UPPER(e.provincia), mesas DESC
  `, [Number(anoAlvo)]);

  return { fonte: 'relatorio_criado_pela_ferramenta', ano: Number(anoAlvo), ...resumo, por_provincia: provPartido };
}

export const FERRAMENTAS_STATSE = {
  resumo_estrutura: (p = {}) => resumoEstrutura(p),
  resumo_votacao: (p = {}) => resumoVotacao(p),
  resultados: (p = {}) => resultados(p),
  buscar: (p = {}) => buscar(p),
  relatorio_insight: (p = {}) => relatorioInsight(p)
};

export async function executarFerramentaStatse(nome, params = {}) {
  const ferramenta = FERRAMENTAS_STATSE[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}
