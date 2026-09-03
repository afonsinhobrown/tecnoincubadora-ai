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
async function resultados({ ano, tipo, provincia, distrito, posto, agrupar } = {}) {
  const { where, params } = construirFiltro({ ano, tipo, provincia, distrito, posto }, true);

  // traz por partido ordenado, decifra e soma no JS
  const linhas = await sql(`
    SELECT UPPER(r.nome_partido) AS partido, r.votos AS voto
    FROM resultados_partidos r
    JOIN eleicoes e ON e.id = r.eleicao_id
    ${where}
  `, params);

  const mapa = new Map();
  for (const l of linhas) {
    const v = decifrarInt(l.voto);
    mapa.set(l.partido, (mapa.get(l.partido) || 0) + v);
  }
  const lista = [...mapa.entries()]
    .map(([partido, votos]) => ({ partido, votos }))
    .sort((a, b) => b.votos - a.votos);

  const total = lista.reduce((s, x) => s + x.votos, 0);
  const comPct = lista.map(x => ({ ...x, pct: total ? Math.round((x.votos / total) * 1000) / 10 : 0 }));

  // vencedor
  const vencedor = comPct.length ? { partido: comPct[0].partido, votos: comPct[0].votos, pct: comPct[0].pct } : null;
  return { total_votos: total, partidos: comPct, vencedor, filtro: { ano, tipo, provincia, distrito, posto } };
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
  const anoAlvo = ano || 2023;
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
