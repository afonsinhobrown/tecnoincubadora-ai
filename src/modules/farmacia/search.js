import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.FARMACIA_DATABASE_URL);

// Colunas de texto relevantes para busca de produtos, na tabela real do GestorFarma
const COLUNAS_BUSCA_PRODUTO = [
  'nome',
  'nome_generico',
  'codigo_barras',
  'codigo_interno',
  'descricao',
  'composicao',
  'indicacao'
];

// Palavras que utilizadores comuns escrevem mas que não identificam produto
// ex: "quero lista de produtos", "preciso comprar paracetamol"
const STOPWORDS = new Set([
  'quero', 'queria', 'gostaria', 'preciso', 'procuro', 'pesquisar', 'pesquisa',
  'buscar', 'busca', 'lista', 'listar', 'listagem', 'ver', 'mostrar', 'monstra',
  'mostre', 'dá', 'da', 'me', 'deme', 'tem', 'existe', 'ha', 'há', 'fazer',
  'comprar', 'compra', 'vender', 'venda', 'vendas', 'preco', 'preço', 'precos',
  'produtos', 'produto', 'remedio', 'remédio', 'remedios', 'remédios',
  'medicamento', 'medicamentos', 'medicina', 'farmacia', 'farmácia',
  'estoque', 'stock', 'disponivel', 'disponível', 'sobre', 'para', 'por',
  'com', 'sem', 'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas',
  'em', 'um', 'uma', 'uns', 'umas', 'o', 'a', 'os', 'as', 'e', 'ou', 'que',
  'qual', 'quais', 'onde', 'como', 'todos', 'todas', 'tipo', 'algum', 'alguma',
  'por favor', 'favor', 'obrigado', 'oi', 'ola', 'olá', 'bom', 'dia', 'tarde',
  'boa', 'mim'
]);

// Remove acentos e normaliza para comparação (JS e SQL usam a mesma regra)
const ACENTOS = 'áàâãäéèêëíìîïóòôõöúùûüçñýÿ';
const SEM_ACENTOS = 'aaaaaeeeeiiiiooooouuuucnyy';

export function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Extrai termos úteis de uma frase natural: "quero lista de produtos" -> []
// "preciso comprar paracetamol" -> ["paracetamol"]
export function extrairTermos(stringUsuario) {
  return normalizar(stringUsuario)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(p => p.length > 1 && !STOPWORDS.has(p));
}

// Expressão SQL equivalente ao normalizar(): lower + remove acentos
function colunaNormalizada(coluna) {
  return `translate(lower("${coluna}"), '${ACENTOS}', '${SEM_ACENTOS}')`;
}

/**
 * Passo 1 — Recebe string livre (frase natural do utilizador), extrai termos,
 * busca com tolerância a acentos e erros de digitação (pg_trgm),
 * devolve lista agrupada e ranqueada por relevância.
 */
export async function buscarProdutos(stringUsuario, limite = 20) {
  const termos = extrairTermos(stringUsuario);

  // Frase sem termos úteis ("quero lista de produtos"): devolve os mais recentes
  if (termos.length === 0) {
    return sql(`
      SELECT id, nome, nome_generico, codigo_barras, codigo_interno,
             forma_farmaceutica, concentracao, requer_receita, controlado,
             is_ativo, 0 AS relevancia
      FROM produtos_produto
      WHERE is_ativo = true
      ORDER BY data_criacao DESC, nome ASC
      LIMIT ${limite}
    `);
  }

  const condicoes = [];
  const params = [];
  const scoreParts = [];
  let i = 1;

  for (const termo of termos) {
    // Código de barras: busca exata por prefixo, sem fuzzy
    if (/^\d{6,}$/.test(termo)) {
      condicoes.push(`"codigo_barras" ILIKE $${i}`);
      scoreParts.push(`(CASE WHEN "codigo_barras" ILIKE $${i} THEN 10 ELSE 0 END)`);
      params.push(`${termo}%`);
      i++;
      continue;
    }

    for (const coluna of COLUNAS_BUSCA_PRODUTO) {
      const col = colunaNormalizada(coluna);
      const p = i++;
      // correspondência exata (contém) vale mais que fuzzy
      scoreParts.push(`(CASE WHEN ${col} LIKE $${p} THEN 2 ELSE 0 END)`);
      // tolerância a erros de digitação via trigramas (word_similarity
      // funciona bem para termo curto dentro de nome comprido)
      scoreParts.push(`(CASE WHEN word_similarity($${p}, ${col}) > 0.6 THEN word_similarity($${p}, ${col}) ELSE 0 END)`);
      if (coluna === 'nome' || coluna === 'nome_generico') {
        condicoes.push(`${col} LIKE $${p} OR word_similarity($${p}, ${col}) > 0.6`);
      }
      params.push(`%${termo}%`);
    }
  }

  const query = `
    SELECT
      id, nome, nome_generico, codigo_barras, codigo_interno,
      forma_farmaceutica, concentracao, requer_receita, controlado,
      is_ativo,
      round(((${scoreParts.join(' + ')})::numeric), 2) AS relevancia
    FROM produtos_produto
    WHERE is_ativo = true AND (${condicoes.join(' OR ')})
    ORDER BY relevancia DESC, nome ASC
    LIMIT ${limite}
  `;

  return sql(query, params);
}

/**
 * Passo 2 — Utilizador escolheu um produto específico da lista.
 * Devolve o registo completo, incluindo estoque atual.
 */
export async function obterProdutoExato(produtoId) {
  const produto = await sql(
    `SELECT * FROM produtos_produto WHERE id = $1`,
    [produtoId]
  );
  if (produto.length === 0) return null;

  const estoque = await sql(
    `SELECT quantidade, quantidade_minima, preco_venda, preco_promocional,
            em_promocao, lote, data_validade, is_disponivel, localizacao_estoque
     FROM produtos_estoqueproduto
     WHERE produto_id = $1 AND is_disponivel = true`,
    [produtoId]
  );

  return { ...produto[0], estoque };
}
