/**
 * ═══════════════════════════════════════════════════════════════════
 *  CAFÉPOINT — registo de ferramentas (todas APENAS LEITURA).
 *  Scoping multi-tenant por restaurante (`restaurantId`, do token).
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';
import { extrairCriterio } from '../../criterios/index.js';

const sql = neon(process.env.CAFEPOINT_DATABASE_URL);

function restDe(params) {
  if (!params?.restaurantId) throw new Error('Sessão sem restaurante: inicie sessão.');
  return params.restaurantId;
}

function janelaTempo(periodo) {
  const agora = new Date();
  const inicio = new Date(agora);
  switch (periodo) {
    case 'hoje': inicio.setHours(0, 0, 0, 0); break;
    case 'semana': inicio.setDate(inicio.getDate() - 7); break;
    case 'mes': inicio.setDate(1); inicio.setHours(0, 0, 0, 0); break;
    default: inicio.setDate(inicio.getDate() - 30);
  }
  return inicio;
}

async function resumoVendas(periodo, restaurantId) {
  const inicio = periodo === 'total' ? null : janelaTempo(periodo);
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum("totalAmount"),0)::numeric(12,2) AS total,
           coalesce(avg("totalAmount"),0)::numeric(12,2) AS ticket_medio
    FROM "Order"
    WHERE "restaurantId" = $1 AND status IN ('PAID','COMPLETED') AND (\$2::timestamptz IS NULL OR "createdAt" >= \$2)
  `, [restaurantId, inicio]);
  return { totais, por_forma_pagamento: [] };
}

async function topProdutos(restaurantId) {
  return sql(`
    SELECT mi.name AS nome, mi.category AS categoria,
           sum(oi.quantity)::int AS quantidade_vendida,
           sum(oi.quantity * oi.price)::numeric(12,2) AS receita
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    JOIN "MenuItem" mi ON mi.id = oi."menuItemId"
    WHERE o."restaurantId" = $1 AND o.status IN ('PAID','COMPLETED')
    GROUP BY mi.name, mi.category
    ORDER BY quantidade_vendida DESC
    LIMIT 10
  `, [restaurantId]);
}

async function estoqueBaixo(restaurantId) {
  return sql(`
    SELECT id, name AS nome, category AS categoria,
           "stockQuantity" AS quantidade, "minStock" AS quantidade_minima,
           price AS preco_venda
    FROM "MenuItem"
    WHERE "restaurantId" = $1 AND "stockQuantity" <= "minStock"
    ORDER BY "stockQuantity" ASC
    LIMIT 20
  `, [restaurantId]);
}

async function resumoClientes(restaurantId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS clientes,
           count(*) FILTER (WHERE "createdAt" >= now() - interval '30 days')::int AS novos_30d
    FROM "Customer"
    WHERE "restaurantId" = $1
  `, [restaurantId]);
  const lista = await sql(`
    SELECT id, name AS nome, email, phone AS telefone, coalesce(type,'—') AS tipo
    FROM "Customer"
    WHERE "restaurantId" = $1
    ORDER BY name ASC
    LIMIT 100
  `, [restaurantId]);
  return { totais, lista };
}

// Palavras comuns que não identificam produto (para extrair termos de busca)
const STOPWORDS = new Set([
  'quero', 'queria', 'gostaria', 'preciso', 'procuro', 'procurar', 'pesquisar', 'pesquisa',
  'buscar', 'busca', 'lista', 'listar', 'ver', 'mostrar', 'mostre', 'tem', 'existe', 'ha', 'há',
  'fazer', 'comprar', 'compra', 'produtos', 'produto', 'itens', 'item', 'menu', 'cardapio', 'menú',
  'preco', 'preço', 'custam', 'disponivel', 'disponível', 'sobre', 'para', 'por', 'com', 'sem',
  'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'um', 'uma', 'uns', 'umas',
  'o', 'a', 'os', 'as', 'e', 'ou', 'que', 'qual', 'quais', 'onde', 'como', 'todos', 'todas',
  'tipo', 'algum', 'alguma', 'por favor', 'favor', 'obrigado', 'oi', 'ola', 'olá', 'bom',
  'dia', 'tarde', 'boa', 'mim', 'me', 'meu', 'minha', 'custa', 'quanto', 'custaquanto'
]);

// Remove acentos + minúsculas para comparação (mesma regra no JS e no SQL)
const ACENTOS = 'áàâãäéèêëíìîïóòôõöúùûüçñýÿ';
const SEM_ACENTOS = 'aaaaaeeeeiiiiooooouuuucnyy';

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Extrai termos úteis de uma frase: "quero ver os cafes" -> ["cafe"]
function extrairTermos(stringUsuario, extra = null) {
  const fonte = (extra ? normalizar(extra) + ' ' : '') + normalizar(stringUsuario);
  return fonte
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(p => p.length > 1 && !STOPWORDS.has(p));
}

async function buscarProdutos(termos, restaurantId, extra = null) {
  const termosUteis = extrairTermos(termos, extra);

  // Sem termos úteis: devolve os itens mais recentes do menu
  if (termosUteis.length === 0) {
    return sql(`
      SELECT id, name AS nome, category AS categoria, price AS preco_venda,
             "stockQuantity" AS quantidade
      FROM "MenuItem"
      WHERE "restaurantId" = $1
      ORDER BY id DESC
      LIMIT 8
    `, [restaurantId]);
  }

  const condicoes = [];
  const params = [];
  const scoreParts = [];
  let i = 2;
  // nome numa coluna normalizada sem acentos; barcode usa busca por prefixo
  const colNameNorm = `translate(lower(name), '${ACENTOS}', '${SEM_ACENTOS}')`;
  const colCatNorm = `translate(lower(category), '${ACENTOS}', '${SEM_ACENTOS}')`;

  for (const termo of termosUteis) {
    // Código de barras (6+ dígitos): busca exata por prefixo
    if (/^\d{6,}$/.test(termo)) {
      condicoes.push(`barcode ILIKE $${i}`);
      scoreParts.push(`CASE WHEN barcode ILIKE $${i} THEN 10 ELSE 0 END`);
      params.push(`${termo}%`);
      i++;
      continue;
    }
    for (const [col, score] of [[colNameNorm, 4], [colCatNorm, 2]]) {
      const p = i++;
      condicoes.push(`${col} LIKE $${p}`);
      scoreParts.push(`CASE WHEN ${col} LIKE $${p} THEN ${score} ELSE 0 END`);
      params.push(`%${termo}%`);
    }
  }

  const query = `
    SELECT id, name AS nome, category AS categoria, price AS preco_venda,
           "stockQuantity" AS quantidade,
           round(((${scoreParts.join(' + ')})::numeric), 2) AS relevancia
    FROM "MenuItem"
    WHERE "restaurantId" = $1 AND (${condicoes.join(' OR ')})
    ORDER BY relevancia DESC, name ASC
    LIMIT 8
  `;

  return sql(query, [restaurantId, ...params]);
}

async function detalheProduto(id, restaurantId) {
  const p = await sql(`
    SELECT id, name AS nome, description AS descricao, category AS categoria,
           price AS preco_venda, "costPrice" AS preco_custo,
           "stockQuantity" AS quantidade, "minStock" AS quantidade_minima
    FROM "MenuItem"
    WHERE id = $1 AND "restaurantId" = $2
  `, [id, restaurantId]);
  if (p.length === 0) return null;
  return { ...p[0], estoque: p[0].quantidade != null ? [{ quantidade: p[0].quantidade, preco_venda: p[0].preco_venda }] : [] };
}

async function pedidosEstado(restaurantId) {
  const lista = await sql(`
    SELECT status AS estado, count(*)::int AS total,
           coalesce(sum("totalAmount"),0)::numeric(12,2) AS valor
    FROM "Order"
    WHERE "restaurantId" = $1
    GROUP BY status ORDER BY total DESC
  `, [restaurantId]);
  const [totais] = await sql(`SELECT count(*)::int AS total FROM "Order" WHERE "restaurantId" = $1`, [restaurantId]);
  return { totais, lista };
}

async function mesas(restaurantId) {
  return sql(`
    SELECT number AS numero, capacity AS capacidade, status, type AS tipo
    FROM "Table"
    WHERE "restaurantId" = $1
    ORDER BY number ASC LIMIT 100
  `, [restaurantId]);
}

async function reservas(restaurantId) {
  return sql(`
    SELECT "customerName" AS cliente, "customerPhone" AS telefone, date AS data,
           guests AS pessoas, status, "tableId" AS mesa
    FROM "Reservation"
    WHERE "restaurantId" = $1
    ORDER BY date DESC LIMIT 50
  `, [restaurantId]);
}

async function despesas(restaurantId) {
  const lista = await sql(`
    SELECT description AS descricao, amount AS valor, category AS categoria,
           date AS data, "paymentMethod" AS pagamento, "isPaid" AS pago
    FROM "Expense"
    WHERE "restaurantId" = $1
    ORDER BY date DESC LIMIT 50
  `, [restaurantId]);
  const [totais] = await sql(`
    SELECT count(*)::int AS total,
           coalesce(sum(amount),0)::numeric(12,2) AS valor_total,
           coalesce(sum(amount) FILTER (WHERE "isPaid"=true),0)::numeric(12,2) AS pago
    FROM "Expense" WHERE "restaurantId" = $1
  `, [restaurantId]);
  return { totais, lista };
}

export const FERRAMENTAS_CAFEPOINT = {
  buscar_produtos: (p = {}) => buscarProdutos(p.termos, restDe(p), p.consulta),
  vendas: (p = {}) => resumoVendas(p.periodo ?? 'total', restDe(p)),
  top_produtos: (p = {}) => topProdutos(restDe(p)),
  estoque_baixo: (p = {}) => estoqueBaixo(restDe(p)),
  clientes: (p = {}) => resumoClientes(restDe(p)),
  detalhe_produto: (p = {}) => detalheProduto(p.id, restDe(p)),
  pedidos_estado: (p = {}) => pedidosEstado(restDe(p)),
  mesas: (p = {}) => mesas(restDe(p)),
  reservas: (p = {}) => reservas(restDe(p)),
  despesas: (p = {}) => despesas(restDe(p)),
  relatorio_insight: (p = {}) => relatorioInsight(restDe(p))
};

// Relatório próprio da ferramenta: receita por categoria + vendas/mês + despesas/mês
async function relatorioInsight(restaurantId) {
  const receitaPorCategoria = await sql(`
    SELECT mi.category AS categoria,
           count(*)::int AS vendas,
           coalesce(sum(oi.quantity * oi.price),0)::numeric(12,2) AS receita
    FROM "OrderItem" oi JOIN "Order" o ON o.id=oi."orderId"
    JOIN "MenuItem" mi ON mi.id=oi."menuItemId"
    WHERE o."restaurantId"=$1 AND o.status IN ('PAID','COMPLETED')
    GROUP BY mi.category ORDER BY receita DESC`, [restaurantId]);
  const faturacaoMes = await sql(`
    SELECT to_char(date_trunc('month',o."createdAt"),'YYYY-MM') AS mes,
           count(*)::int AS pedidos, coalesce(sum(o."totalAmount"),0)::numeric(12,2) AS total
    FROM "Order" o WHERE o."restaurantId"=$1 AND o.status IN ('PAID','COMPLETED')
    GROUP BY mes ORDER BY mes DESC LIMIT 12`, [restaurantId]);
  const despesasMes = await sql(`
    SELECT to_char(date_trunc('month',e.date),'YYYY-MM') AS mes,
           count(*)::int AS despesas, coalesce(sum(e.amount),0)::numeric(12,2) AS total
    FROM "Expense" e WHERE e."restaurantId"=$1 GROUP BY mes ORDER BY mes DESC LIMIT 12`, [restaurantId]);
  const [totais] = await sql(`
    SELECT (SELECT count(*)::int FROM "Customer" WHERE "restaurantId"=$1) AS clientes,
           (SELECT coalesce(sum("totalAmount"),0)::numeric(12,2) FROM "Order" WHERE "restaurantId"=$1 AND status IN ('PAID','COMPLETED')) AS faturado
  `, [restaurantId]);
  return { fonte: 'relatorio_criado_pela_ferramenta', totais, receita_por_categoria: receitaPorCategoria, faturacao_por_mes: faturacaoMes, despesas_por_mes: despesasMes };
}

export async function executarFerramentaCafepoint(nome, params = {}) {
  const ferramenta = FERRAMENTAS_CAFEPOINT[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}

export { buscarProdutos };
