/**
 * ═══════════════════════════════════════════════════════════════════
 *  CRITÉRIOS — transforma uma pergunta em linguagem natural em
 *  critérios de filtro estruturados, distinguindo pedidos GLOBAIS de
 *  pedidos ESPECÍFICOS, usando um dicionário de valores reais.
 * ═══════════════════════════════════════════════════════════════════
 */

function norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Palavras genéricas que aparecem em rótulos de entidades mas não identificam o valor
const GENERICAS = new Set(['departamento','setor','sector','seccao','secao','gabinete','reparticao','direccao','direcao','directoria','unidade','de','do','da','dos','das','e','administracao','administração','provincial','geral','central','dos','das']);

/**
 * @param {string} consulta  pergunta livre do utilizador
 * @param {Array<{rotulo:string, rotuloCurto?:string, valor:string, campo?:string}>} dicionario
 * @returns {{global:boolean, criterio?:{campo:string,valor:string}, palavraChave?:string}}
 */
export function extrairCriterio(consulta, dicionario = []) {
  const alvo = norm(consulta);
  const palavrasAlvo = new Set(alvo.split(/\s+/).filter(p => p.length > 1));

  let melhor = null;
  for (const item of dicionario) {
    const rot = norm(item.rotulo);
    const curto = norm(item.rotuloCurto || item.rotulo);
    let score = 0; let chave = '';

    // 1) substring exata do rótulo completo na pergunta
    if (rot.length > 3 && alvo.includes(rot)) { score = rot.length * 10 + 100; chave = rot; }
    // 2) palavras significativas do rótulo curto presentes na pergunta
    else {
      const sig = curto.split(/\s+/).filter(p => p.length > 2 && !GENERICAS.has(p));
      if (sig.length) {
        const presentes = sig.filter(w => palavrasAlvo.has(w));
        const fracao = presentes.length / sig.length;
        // exige maioria das palavras-chave e pelo menos 1
        if (presentes.length >= 1 && fracao >= 0.6) {
          score = presentes.length * 5 + sig.length;
          chave = presentes.join(' ');
        }
      }
    }

    if (score > 0 && (!melhor || score > melhor.score)) {
      melhor = { item, score, chave };
    }
  }

  if (melhor) {
    return {
      global: false,
      criterio: { campo: melhor.item.campo || 'id', valor: melhor.item.valor ?? melhor.item.rotulo },
      palavraChave: melhor.chave
    };
  }
  const temPedidoGlobal = /(todos|todas|global|lista completa|todos os|todas as|resumo)\b/.test(alvo);
  return { global: true, palavrasChave: temPedidoGlobal ? ['todos'] : [] };
}

/**
 * Junta os critérios com palavras-chave livres que apareçam na consulta.
 * Ex: { categoria: 'X' } se "bebidas", { marca: 'Y' } se "dell".
 */
export function combinarCriterios(consulta, dicionarios) {
  const resultado = {};
  let global = true;
  for (const { campo, dicionario } of dicionarios) {
    const r = extrairCriterio(consulta, dicionario);
    if (!r.global) { resultado[campo] = r.criterio.valor; global = false; }
  }
  return { global, criterios: resultado };
}
