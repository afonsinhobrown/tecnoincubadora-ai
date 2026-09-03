/**
 * ═══════════════════════════════════════════════════════════════════
 *  MOTOR — interpreta a frase do utilizador SEGUNDO o prompt de
 *  sistema de cada módulo e executa apenas as ferramentas autorizadas
 *  nesse prompt. Nenhuma lógica de negócio vive aqui; vive no prompt.
 *
 *  `criarMotor(prompt, ferramentas, gatilhosRecusa)` gera um motor
 *  para um sistema (GestorFarma, Xonguile, etc.). Por omissão exporta
 *  o motor do GestorFarma.
 *
 *  Dois modos:
 *   - LLM (padrão): API Google Gemini com o prompt como instrução de
 *     sistema + function calling para as ferramentas do módulo.
 *   - Fallback (regras): sem chave ou se a API falhar.
 * ═══════════════════════════════════════════════════════════════════
 */
import { PROMPT_SISTEMA as PROMPT_FARMACIA } from './promptSistema.js';
import { executarFerramenta as ferramentasFarmacia } from '../ferramentas/index.js';

// ── Configuração do LLM (fornecedor configurável) ────────────────────
// Prioridade: LLM_PROVIDER explícito. Se "openrouter", usa a API
// OpenAI-compatível; se "gemini" (padrão), usa a Generative Language API.
const PROVIDER = (process.env.LLM_PROVIDER || (process.env.LLM_API_KEY ? 'openrouter' : 'gemini')).toLowerCase();
const API_KEY = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;
const MODELO = process.env.LLM_MODEL || process.env.GEMINI_MODELO || 'gemini-3.6-flash';
const OPENROUTER_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions';
const URL_GEMINI = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${API_KEY}`;

const GATILHOS_RECUSA_PADRAO = [
  'dose', 'dosagem', 'quantas tomo', 'posso tomar', 'estou gravida',
  'gravida', 'diagnostico', 'o que tenho', 'receita medica para',
  'apagar', 'eliminar', 'apaga', 'elimina', 'mudar preco', 'alterar',
  'criar produto', 'eliminar produto', 'password', 'senha', 'telefone do cliente',
  'morada do cliente', 'endereco do cliente'
];

export function criarMotor(prompt, ferramentas, gatilhosRecusa = GATILHOS_RECUSA_PADRAO) {
  const { identidade, limites, recusa, ferramentas: defFerramentas, intencoes, periodos } = prompt;

  function normalizar(t) {
    return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // ── Monta o texto de sistema a partir do prompt ──────────────────
  function construirPromptSistema() {
    return [
      `És ${identidade.nome}. ${identidade.papel}`,
      '',
      'LIMITES (respeita sempre):',
      ...limites.map(l => ' • ' + l),
      '',
      'Se o pedido estiver fora do âmbito, responde em texto com:',
      recusa.texto,
      '',
      'Tens acesso a estas ferramentas (as de consulta são APENAS LEITURA):',
      ...Object.entries(defFerramentas).map(([nome, desc]) => ` • ${nome}: ${desc}`),
      '',
      'Escolhe a ferramenta certa para a pergunta. Só se não houver ferramenta',
      'adequada é que respondes em texto (conversa, recusa ou esclarecimento).',
      'Responde sempre em português.'
    ].join('\n');
  }

  // ── Declara as ferramentas do prompt para function calling ────────
  function declararFerramentas() {
    const lista = [];
    const add = (name, description, parameters) =>
      lista.push({ name, description, parameters });

    for (const [nome, desc] of Object.entries(defFerramentas)) {
      if (nome === 'vendas') {
        add(nome, desc, {
          type: 'OBJECT',
          properties: {
            periodo: { type: 'STRING', enum: ['total', 'hoje', 'semana', 'mes', '30d'],
              description: 'Período da análise. "total" = tudo faturado (padrão). Use "hoje", "semana" ou "mês" apenas se o utilizador os pedir explicitamente.' }
          }
        });
      } else if (nome === 'buscar_produtos') {
        add(nome, desc, {
          type: 'OBJECT',
          properties: { termos: { type: 'STRING', description: 'Termos do produto/serviço a procurar' } },
          required: ['termos']
        });
      } else if (nome === 'detalhe_produto') {
        add(nome, desc, {
          type: 'OBJECT',
          properties: { id: { type: 'INTEGER', description: 'ID do produto' } },
          required: ['id']
        });
      } else if (nome === 'acessos') {
        add(nome, desc, {
          type: 'OBJECT',
          properties: {
            periodo: { type: 'STRING', enum: ['total', 'hoje', 'semana', 'mes', '30d'],
              description: 'Período. "total" = tudo. Use período apenas se o utilizador o pedir explicitamente.' }
          }
        });
      } else if (nome === 'funcionarios' && identidade.nome === 'Assistente DDGEI') {
        add(nome, desc, {
          type: 'OBJECT',
          properties: {
            setor: { type: 'STRING', description: 'Nome do setor ou departamento. Inclua sempre que o utilizador pedir funcionários de um setor específico.' }
          }
        });
      } else if (nome === 'material_sobrante' && identidade.nome === 'Assistente DDGEI') {
        add(nome, desc, {
          type: 'OBJECT',
          properties: {
            provincia: { type: 'STRING', description: 'Nome da provincia (ex: "Cidade de Maputo", "Gaza", "Nampula"). Inclua sempre que o utilizador pedir material sobrante de uma provincia específica.' }
          }
        });
      } else if (identidade.nome === 'Assistente StatsE' && ['resumo_estrutura', 'resumo_votacao'].includes(nome)) {
        add(nome, desc, {
          type: 'OBJECT',
          properties: {
            ano: { type: 'STRING', description: 'Ano da eleição. Usa apenas se o utilizador o pedir.' },
            tipo: { type: 'STRING', description: 'Tipo de eleição (ex: autárquica).' },
            provincia: { type: 'STRING', description: 'Província (ex: "Gaza", "Maputo", "Nampula"). Use sempre que o utilizador citar uma província.' },
            distrito: { type: 'STRING', description: 'Distrito.' },
            posto: { type: 'STRING', description: 'Posto administrativo.' },
            localidade: { type: 'STRING', description: 'Localidade.' }
          }
        });
      } else if (identidade.nome === 'Assistente StatsE' && nome === 'resultados') {
        add(nome, desc, {
          type: 'OBJECT',
          properties: {
            ano: { type: 'STRING', description: 'Ano da eleição. Usa apenas se o utilizador o pedir.' },
            tipo: { type: 'STRING', description: 'Tipo de eleição (ex: autárquica).' },
            provincia: { type: 'STRING', description: 'Província (ex: "Gaza", "Maputo", "Nampula"). Apenas o nome da província, sem outros termos. Use sempre que o utilizador citar uma província.' },
            distrito: { type: 'STRING', description: 'Distrito.' },
            posto: { type: 'STRING', description: 'Posto administrativo.' },
            partido: { type: 'STRING', description: 'Nome de um partido (ex: "FRELIMO", "RENAMO") para limitar os resultados a esse partido. Use apenas se o utilizador nomear um partido.' },
            agrupar: { type: 'STRING', description: 'Agrupar resultados por "provincia" ou deixar vazio para o total geral do âmbito.' }
          }
        });
      } else if (identidade.nome === 'Assistente StatsE' && nome === 'buscar') {
        add(nome, desc, {
          type: 'OBJECT',
          properties: {
            termo: { type: 'STRING', description: 'Palavra-chave a procurar (local de voto, localidade, distrito ou código de assembleia).' },
            ano: { type: 'STRING', description: 'Ano da eleição (opcional).' }
          },
          required: ['termo']
        });
      } else if (nome === 'fazer_venda') {
        add(nome, desc, {
          type: 'OBJECT',
          properties: {
            itens: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  produto: { type: 'STRING', description: 'Nome/genérico/código do produto' },
                  quantidade: { type: 'INTEGER', description: 'Quantidade a vender' }
                },
                required: ['produto', 'quantidade']
              },
              description: 'Lista de produtos e quantidades da venda'
            },
            forma_pagamento: {
              type: 'STRING', enum: ['DINHEIRO', 'MPESA', 'EMOLA', 'POS', 'TRANSFERENCIA', 'OUTROS'],
              description: 'Forma de pagamento'
            }
          },
          required: ['itens', 'forma_pagamento']
        });
      } else {
        add(nome, desc);
      }
    }
    return lista;
  }

  // ── Chamada ao LLM com failover entre fornecedores ───────────────
  // Ordem: LLM_PRIMARY (padrão "gemini") primeiro; depois os restantes
  // que tenham chave. Se um falhar (quota/erro), passa ao seguinte.
  const temGemini = !!process.env.GEMINI_API_KEY;
  const temOpenRouter = !!process.env.LLM_API_KEY;

  function ordemProvedores() {
    const prim = (process.env.LLM_PRIMARY || 'gemini').toLowerCase();
    const ordem = [];
    if (prim === 'gemini' && temGemini) ordem.push('gemini');
    if (prim === 'openrouter' && temOpenRouter) ordem.push('openrouter');
    if (temGemini && !ordem.includes('gemini')) ordem.push('gemini');
    if (temOpenRouter && !ordem.includes('openrouter')) ordem.push('openrouter');
    return ordem;
  }

  async function chamarLLM(frase) {
    const erros = [];
    for (const prov of ordemProvedores()) {
      try {
        const r = prov === 'openrouter' ? await chamarOpenRouter(frase) : await chamarGemini(frase);
        if (r) return r;
      } catch (e) {
        erros.push(`${prov}: ${e.message.split('\n')[0]}`);
      }
    }
    throw new Error(erros.join(' | ') || 'Sem fornecedor LLM configurado');
  }

  async function chamarGemini(frase) {
    const body = {
      systemInstruction: { parts: [{ text: construirPromptSistema() }] },
      contents: [{ role: 'user', parts: [{ text: frase }] }],
      tools: [{ functionDeclarations: declararFerramentas() }],
      generationConfig: { temperature: 0.2 }
    };
    const res = await fetchComRetry(URL_GEMINI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`LLM Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts
      ?.find(p => p.functionCall || p.text);
    if (!part) return null;
    return part.functionCall
      ? { functionCall: { name: part.functionCall.name, args: part.functionCall.args || {} } }
      : { text: part.text || '' };
  }

  // OpenAI-compatível (OpenRouter, OpenAI, DeepSeek, etc.) com function calling
  // Normaliza os tipos do schema (Gemini usa STRING/OBJECT; OpenAI exige minúsculas).
  function normalizarSchema(s) {
    if (!s || typeof s !== 'object') return s;
    const out = Array.isArray(s) ? [] : {};
    for (const [k, v] of Object.entries(s)) {
      if (k === 'type' && typeof v === 'string') out[k] = v.toLowerCase();
      else out[k] = (v && typeof v === 'object') ? normalizarSchema(v) : v;
    }
    return out;
  }

  async function chamarOpenRouter(frase) {
    const tools = declararFerramentas().map(fn => ({
      type: 'function',
      function: {
        name: fn.name,
        description: fn.description,
        parameters: normalizarSchema(fn.parameters || { type: 'OBJECT', properties: {} })
      }
    }));
    const body = {
      model: MODELO,
      messages: [
        { role: 'system', content: construirPromptSistema() },
        { role: 'user', content: frase }
      ],
      tools,
      tool_choice: 'auto',
      temperature: 0.2
    };
    const res = await fetchComRetry(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    if (!msg) return null;
    const toolCall = msg.tool_calls?.[0];
    if (toolCall?.function) {
      let args = {};
      try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch {}
      return { functionCall: { name: toolCall.function.name, args } };
    }
    return { text: msg.content || '' };
  }

  async function fetchComRetry(url, init) {
    const MAX_TENTATIVAS = 3;
    let res;
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      res = await fetch(url, init);
      if (res.status === 503 || res.status === 429) {
        await new Promise(r => setTimeout(r, tentativa * 1500));
        continue;
      }
      break;
    }
    return res;
  }

  // ── Modo LLM ─────────────────────────────────────────────────────
  async function processarLLM(frase, ctx) {
    const part = await chamarLLM(frase);
    if (!part) return { blocos: [], produtos: [] };

    if (part.functionCall) {
      const { name, args = {} } = part.functionCall;
      // contexto autenticado da sessão + consulta original (nunca vindos do modelo)
      const params = { ...args, ...ctx.tenant, consulta: frase };
      if (name === 'buscar_produtos') {
        const produtos = await ferramentas(name, params);
        return { blocos: [], produtos };
      }
      const dados = await ferramentas(name, params);
      if (name === 'fazer_venda') {
        return { blocos: [{ intencao: 'fazer_venda', titulo: '🧾 Venda registada', dados }], produtos: [] };
      }
      const id = name === 'vendas' ? 'vendas_periodo' : name;
      const titulo = id === 'vendas_periodo' ? '💰 Vendas e faturação' : defFerramentas[name];
      return { blocos: [{ intencao: id, titulo, dados }], produtos: [] };
    }

    return { blocos: [{ intencao: 'resposta_llm', titulo: '🤖 Assistente', texto: part.text }], produtos: [] };
  }

  // ── Fallback por regras ──────────────────────────────────────────
  function pontuarIntencoes(fraseNorm) {
    let melhor = null;
    for (const intencao of intencoes) {
      let pontos = 0;
      for (const frase of intencao.frases || []) {
        const f = normalizar(frase).trim();
        if (f && fraseNorm.includes(f)) pontos += 5;
      }
      for (const palavra of intencao.palavras || []) {
        if (fraseNorm.includes(normalizar(palavra))) pontos += 2;
      }
      if (pontos > 0 && (!melhor || pontos > melhor.pontos)) melhor = { intencao, pontos };
    }
    return melhor;
  }

  function extrairPeriodo(fraseNorm) {
    for (const [periodo, palavras] of Object.entries(periodos)) {
      if (palavras.some(p => fraseNorm.includes(normalizar(p)))) return periodo;
    }
    return 'total';
  }

  function extrairSetorDdgei(frase) {
    const correspondencia = String(frase || '').match(/(?:do|da|de)\s+(?:setor|departamento)\s+(.+?)(?:[?!.,;]|$)/i);
    return correspondencia?.[1]?.trim() || '';
  }

  function extrairProvinciaDdgei(frase) {
    const correspondencia = String(frase || '').match(/(?:da|de|em|no|na)\s+(?:provincia\s+(?:de\s+)?|cidade\s+de\s+)?(.+?)(?:[?!.,;]|$)/i);
    return correspondencia?.[1]?.trim() || '';
  }

  async function processarPadrao(frase, ctx) {
    const { buscarProdutos = async () => [], tenant } = ctx;
    const fraseNorm = normalizar(frase || '');

    if (gatilhosRecusa.some(g => fraseNorm.includes(g))) {
      return { blocos: [{ intencao: 'recusa', titulo: recusa.titulo, texto: recusa.texto }], produtos: [] };
    }

    const blocos = [];
    const melhor = pontuarIntencoes(fraseNorm);
    if (melhor && melhor.pontos >= 2) {
      const { intencao } = melhor;
      if (!defFerramentas[intencao.ferramenta]) {
        throw new Error(`Ferramenta "${intencao.ferramenta}" não autorizada no prompt de sistema`);
      }
      const params = { ...(intencao.parametros || {}), ...tenant, consulta: frase };
      if (intencao.ferramenta === 'funcionarios' && identidade.nome === 'Assistente DDGEI') {
        const setor = extrairSetorDdgei(frase);
        if (setor) params.setor = setor;
      }
      if (intencao.ferramenta === 'material_sobrante' && identidade.nome === 'Assistente DDGEI') {
        const provincia = extrairProvinciaDdgei(frase);
        if (provincia) params.provincia = provincia;
      }
      if (params.periodo === 'auto') params.periodo = extrairPeriodo(fraseNorm);
      const dados = await ferramentas(intencao.ferramenta, params);
      blocos.push({ intencao: intencao.id, titulo: intencao.titulo, dados });
    }

    const produtos = await buscarProdutos(frase, 8);

    if (blocos.length === 0 && produtos.length === 0) {
      return { blocos: [{ intencao: 'sem_resultado', titulo: '🤔 Não percebi', texto: 'Tenta perguntar de outra forma ou com um termo específico.' }], produtos: [] };
    }
    return { blocos, produtos };
  }

  // ════ Ponto de entrada do motor ══════════════════════════════════
  const comModo = (r, modo) => { r.modo = modo; return r; };
  async function processar(frase, ctx) {
    if (API_KEY) {
      try {
        const r = await processarLLM(frase, ctx);
        // resposta com ferramenta executada (dados reais) -> usar
        const usouFerramenta = r.blocos.some(b => b.intencao !== 'resposta_llm') || r.produtos.length > 0;
        if (usouFerramenta) return comModo(r, 'externo');
        // o LLM respondeu em texto livre (sem ferramenta): não confiar em
        // números; correr o motor interno por regras que chama a ferramenta real.
        const interno = await processarPadrao(frase, ctx);
        if (interno.blocos.some(b => b.dados) || interno.produtos.length) return comModo(interno, 'interno');
        // nada de dados no motor interno -> aceitar a resposta conversacional do LLM
        return comModo(r, 'externo');
      } catch (err) {
        console.error('IA externa falhou, a usar o motor interno:', err.message);
      }
    }
    return comModo(await processarPadrao(frase, ctx), 'interno');
  }

  return { processar, normalizar };
}

// Motor padrão (GestorFarma), por compatibilidade com as routes atuais
const { processar } = criarMotor(PROMPT_FARMACIA, ferramentasFarmacia);
export { processar };
