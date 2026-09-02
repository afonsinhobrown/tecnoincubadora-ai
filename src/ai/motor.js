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

const API_KEY = process.env.GEMINI_API_KEY;
const MODELO = process.env.GEMINI_MODELO || 'gemini-1.5-flash';
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
            periodo: { type: 'STRING', enum: ['hoje', 'semana', 'mes', '30d'],
              description: 'Período da análise; infere da pergunta (ex.: "hoje", "semana", "mês"). Padrão 30d.' }
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

  // ── Chama a API Gemini ───────────────────────────────────────────
  async function chamarGemini(frase) {
    const body = {
      systemInstruction: { parts: [{ text: construirPromptSistema() }] },
      contents: [{ role: 'user', parts: [{ text: frase }] }],
      tools: [{ functionDeclarations: declararFerramentas() }],
      generationConfig: { temperature: 0.2 }
    };
    const MAX_TENTATIVAS = 3;
    let res;
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      res = await fetch(URL_GEMINI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.status === 503 || res.status === 429) {
        await new Promise(r => setTimeout(r, tentativa * 1500));
        continue;
      }
      break;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts
      ?.find(p => p.functionCall || p.text);
    return part || null;
  }

  // ── Modo LLM ─────────────────────────────────────────────────────
  async function processarLLM(frase, ctx) {
    const part = await chamarGemini(frase);
    if (!part) return { blocos: [], produtos: [] };

    if (part.functionCall) {
      const { name, args = {} } = part.functionCall;
      // contexto autenticado da sessão, nunca vindo do modelo
      const params = { ...args, ...ctx.tenant };
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
    return '30d';
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
      const params = { ...(intencao.parametros || {}), ...tenant };
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
  async function processar(frase, ctx) {
    if (API_KEY) {
      try {
        const r = await processarLLM(frase, ctx);
        if (r.blocos.length || r.produtos.length) return r;
      } catch (err) {
        console.error('LLM falhou, a usar motor padrão:', err.message);
      }
    }
    return processarPadrao(frase, ctx);
  }

  return { processar, normalizar };
}

// Motor padrão (GestorFarma), por compatibilidade com as routes atuais
const { processar } = criarMotor(PROMPT_FARMACIA, ferramentasFarmacia);
export { processar };
