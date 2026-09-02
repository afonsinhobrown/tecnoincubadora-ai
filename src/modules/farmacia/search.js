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

/**
 * Passo 1 — Recebe string livre, divide em palavras, procura ocorrências
 * em produtos_produto, devolve lista agrupada e ranqueada por relevância.
 */
export async function buscarProdutos(stringUsuario, limite = 20) {
  const palavras = stringUsuario
    .trim()
    .split(/\s+/)
    .filter(p => p.length > 1);

  if (palavras.length === 0) return [];

  const condicoes = [];
  const params = [];
  const scoreParts = [];
  let i = 1;

  for (const palavra of palavras) {
    for (const coluna of COLUNAS_BUSCA_PRODUTO) {
      condicoes.push(`"${coluna}" ILIKE $${i}`);
      scoreParts.push(`(CASE WHEN "${coluna}" ILIKE $${i} THEN 1 ELSE 0 END)`);
      params.push(`%${palavra}%`);
      i++;
    }
  }

  const query = `
    SELECT
      id, nome, nome_generico, codigo_barras, codigo_interno,
      forma_farmaceutica, concentracao, requer_receita, controlado,
      is_ativo,
      (${scoreParts.join(' + ')}) AS relevancia
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
