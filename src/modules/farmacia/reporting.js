import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.FARMACIA_DATABASE_URL);

// As funções abaixo são APENAS LEITURA e são expostas ao registo de
// ferramentas (src/ferramentas/index.js). A interpretação de intenções
// deixou de viver aqui — vive no prompt de sistema (src/ai/promptSistema.js).

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

export async function resumoVendas(periodo, farmaciaId) {
  const inicio = periodo === 'total' ? null : janelaTempo(periodo);
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS total,
           coalesce(avg(total),0)::numeric(12,2) AS ticket_medio
    FROM pedidos_pedido
    WHERE data_criacao >= $1 AND status NOT IN ('CANCELADO','cancelado')
      AND farmacia_id = $2
  `, [inicio, farmaciaId]);
  const porForma = await sql(`
    SELECT coalesce(forma_pagamento,'—') AS forma_pagamento,
           count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS total
    FROM pedidos_pedido
    WHERE data_criacao >= $1 AND status NOT IN ('CANCELADO','cancelado')
      AND farmacia_id = $2
    GROUP BY forma_pagamento ORDER BY total DESC
  `, [inicio, farmaciaId]);
  return { totais, por_forma_pagamento: porForma };
}

export async function topProdutos(farmaciaId) {
  return sql(`
    SELECT p.nome, p.nome_generico,
           sum(i.quantidade)::int AS quantidade_vendida,
           sum(i.subtotal)::numeric(12,2) AS receita
    FROM pedidos_itempedido i
    JOIN produtos_produto p ON p.id = i.produto_id
    JOIN pedidos_pedido ped ON ped.id = i.pedido_id
    WHERE ped.status NOT IN ('CANCELADO','cancelado') AND ped.farmacia_id = $1
    GROUP BY p.id, p.nome, p.nome_generico
    ORDER BY quantidade_vendida DESC
    LIMIT 10
  `, [farmaciaId]);
}

export async function estoqueBaixo(farmaciaId) {
  return sql(`
    SELECT p.id, p.nome, p.nome_generico,
           e.quantidade, e.quantidade_minima,
           e.preco_venda, e.data_validade::date AS data_validade
    FROM produtos_estoqueproduto e
    JOIN produtos_produto p ON p.id = e.produto_id
    WHERE p.is_ativo = true AND e.is_disponivel = true
      AND e.farmacia_id = $1
      AND e.quantidade <= e.quantidade_minima
    ORDER BY e.quantidade ASC
    LIMIT 20
  `, [farmaciaId]);
}

export async function resumoClientes(farmaciaId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS clientes,
           count(*) FILTER (WHERE data_cadastro >= now() - interval '30 days')::int AS novos_30d
    FROM clientes_cliente
    WHERE farmacia_id = $1
  `, [farmaciaId]);
  const lista = await sql(`
    SELECT id, nome_completo AS nome, telefone, email, cidade,
           coalesce(tipo,'—') AS tipo
    FROM clientes_cliente
    WHERE farmacia_id = $1
    ORDER BY nome_completo ASC
    LIMIT 100
  `, [farmaciaId]);
  return { totais, lista };
}

export async function pedidosPorEstado(farmaciaId) {
  return sql(`
    SELECT status, count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS total
    FROM pedidos_pedido
    WHERE farmacia_id = $1
    GROUP BY status ORDER BY pedidos DESC
  `, [farmaciaId]);
}
