/**
 * Helper para ferramentas interpretarem a consulta em critérios de SQL.
 * Retorna a condição WHERE + como reportar o pedido (global/específico).
 */
import { extrairCriterio } from '../criterios/index.js';

/**
 * @param {string} consulta texto original
 * @param {Array<{rotulo:string, rotuloCurto?:string, valor:any, sql?:string}>} dicionario
 *        valores reais. `sql` = condição a aplicar quando bater (padrão coluna = valor)
 * @param {string} coluna coluna onde aplicar o filtro (ex: status)
 * @returns {{condicao:string, valores:any[], global:boolean, criterio?:any, palavraChave?:string}}
 */
export function filtroPorDicionario(consulta, dicionario = [], coluna = '') {
  const c = extrairCriterio(consulta, dicionario);
  if (c.global) return { condicao: '', valores: [], global: true };
  const item = dicionario.find(d => (d.valor ?? d.rotulo) === c.criterio.valor) || {};
  const sql = item.sql || (coluna ? `${coluna} = $1` : '');
  return { condicao: sql, valores: [c.criterio.valor], global: false, criterio: c.criterio, palavraChave: c.palavraChave };
}

export { extrairCriterio };
