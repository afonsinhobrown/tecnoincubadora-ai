/**
 * ═══════════════════════════════════════════════════════════════════
 *  FAZER VENDA — única operação de ESCRITA, reservada a utilizador
 *  autenticado e autorizado na farmácia. Todo o resto é só-leitura.
 *  Cria o pedido (status ENTREGUE, pago), os itens e baixa o estoque,
 *  imitando o formato dos registos reais do GestorFarma.
 * ═══════════════════════════════════════════════════════════════════
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.FARMACIA_DATABASE_URL);

const FORMAS_PAGAMENTO = ['DINHEIRO', 'MPESA', 'EMOLA', 'POS', 'TRANSFERENCIA', 'OUTROS'];
const FORMAS_NORMALIZADAS = {
  dinheiro: 'DINHEIRO', mpesa: 'MPESA', emola: 'EMOLA', pos: 'POS',
  cartao: 'POS', transferencia: 'TRANSFERENCIA', outros: 'OUTROS', credito: 'OUTROS'
};

function normalizar(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizarFormaPagamento(forma) {
  const n = normalizar(forma);
  if (FORMAS_NORMALIZADAS[n]) return FORMAS_NORMALIZADAS[n];
  const encontrada = FORMAS_PAGAMENTO.find(f => f.toLowerCase() === n);
  return encontrada || 'OUTROS';
}

// Formato real do GestorFarma: PED20260901201802
function gerarNumeroPedido() {
  const d = new Date();
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `PED${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Resolve a sessão de caixa ABERTA mais recente da farmácia.
async function sessaoAberta(farmaciaId) {
  const res = await sql(`
    SELECT s.id AS sessao_id, s.operador_id, s.caixa_id
    FROM caixa_sessaocaixa s
    JOIN caixa_caixa c ON c.id = s.caixa_id
    WHERE c.farmacia_id = $1 AND s.status = 'ABERTO'
    ORDER BY s.id DESC LIMIT 1
  `, [farmaciaId]);
  return res[0] || null;
}

// Resolve produto+estoque vendável na farmácia pelo nome/termo.
async function resolverProduto(termo, farmaciaId) {
  const t = `%${normalizar(termo)}%`;
  const res = await sql(`
    SELECT e.id AS estoque_id, p.id AS produto_id, p.nome, p.nome_generico,
           e.quantidade, e.preco_venda,
           coalesce(e.preco_promocional, e.preco_venda) AS preco_aplicado,
           p.requer_receita, p.controlado
    FROM produtos_estoqueproduto e
    JOIN produtos_produto p ON p.id = e.produto_id
    WHERE e.farmacia_id = $1 AND e.is_disponivel = true AND p.is_ativo = true
      AND (translate(lower(p.nome), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') LIKE $2
        OR translate(lower(p.nome_generico), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') LIKE $2
        OR p.codigo_barras LIKE $2)
    ORDER BY (translate(lower(p.nome), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') LIKE $2) DESC,
             e.quantidade DESC
    LIMIT 1
  `, [farmaciaId, t]);
  return res[0] || null;
}

/**
 * Regista uma venda de balcão. `ctx` traz farmaciaId e vendedorId do token.
 * Devolve o "recibo": número do pedido, total, itens e forma de pagamento.
 */
export async function fazerVenda({ itens = [], forma_pagamento }, { farmaciaId, vendedorId }) {
  if (!farmaciaId) throw new Error('Sessão sem farmácia: inicie sessão de uma farmácia.');
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error('A venda precisa de pelo menos um produto.');
  }

  const sessao = await sessaoAberta(farmaciaId);
  if (!sessao) throw new Error('Não há caixa/sessão aberta nesta farmácia para registar a venda.');

  const forma = normalizarFormaPagamento(forma_pagamento);

  // Resolve cada item -> estoque concreto e preços
  const detalhes = [];
  let subtotal = 0;
  for (const item of itens) {
    const qtd = Math.floor(Number(item.quantidade));
    if (!item.produto || !Number.isFinite(qtd) || qtd <= 0) {
      throw new Error(`Item inválido: "${item.produto || '?'}" deve ter quantidade positiva.`);
    }
    const prod = await resolverProduto(item.produto, farmaciaId);
    if (!prod) throw new Error(`Produto não encontrado no estoque desta farmácia: "${item.produto}".`);
    if (qtd > prod.quantidade) {
      throw new Error(`Estoque insuficiente de "${prod.nome}" (disponível: ${prod.quantidade}, pedido: ${qtd}).`);
    }
    const linhaSubtotal = Number(prod.preco_aplicado) * qtd;
    subtotal += linhaSubtotal;
    detalhes.push({ ...prod, quantidade: qtd, subtotal: linhaSubtotal });
  }

  subtotal = Math.round(subtotal * 100) / 100;
  const numero = gerarNumeroPedido();
  const agora = new Date();

  // 1) Cria o pedido no formato real do GestorFarma
  const [pedido] = await sql(`
    INSERT INTO pedidos_pedido (
      numero_pedido, status, forma_pagamento, pago,
      subtotal, taxa_entrega, desconto, total,
      endereco_entrega, bairro, cidade, referencia,
      telefone_contato, observacoes, observacoes_farmacia,
      validado, motivo_cancelamento, data_criacao,
      codigo_coleta, codigo_entrega, troco, valor_pago,
      medico_nome, medico_registro, posologia_geral,
      farmacia_id, vendedor_id, sessao_caixa_id
    ) VALUES (
      $1, 'ENTREGUE', $2, true,
      $3, 0, 0, $3,
      'BALCÃO', '-', '-', '',
      '-', 'Venda Balcão - via IA', '',
      false, '', $4,
      '', '', 0, $3,
      '', '', '',
      $5, $6, $7
    )
    RETURNING id, numero_pedido, total, forma_pagamento
  `, [numero, forma, subtotal, agora, farmaciaId, vendedorId, sessao.sessao_id]);

  // 2) Cria os itens e baixa o estoque
  for (const det of detalhes) {
    const precoUnit = Math.round(Number(det.preco_aplicado) * 100) / 100;
    await sql(`
      INSERT INTO pedidos_itempedido (
        quantidade, preco_unitario, subtotal, observacoes,
        estoque_id, produto_id, pedido_id, is_avulso, valor_comissao, posologia
      ) VALUES ($1, $2, $3, '', $4, $5, $6, true, 0, '')
    `, [det.quantidade, precoUnit, det.subtotal, det.estoque_id, det.produto_id, pedido.id]);

    await sql(`
      UPDATE produtos_estoqueproduto
      SET quantidade = quantidade - $2, data_atualizacao = now()
      WHERE id = $1
    `, [det.estoque_id, det.quantidade]);
  }

  return {
    numero_pedido: pedido.numero_pedido,
    total: pedido.total,
    forma_pagamento: pedido.forma_pagamento,
    itens: detalhes.map(d => ({ produto: d.nome, quantidade: d.quantidade, preco_unitario: d.preco_aplicado, subtotal: d.subtotal }))
  };
}
