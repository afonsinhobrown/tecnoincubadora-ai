import { neon } from '@neondatabase/serverless';
import { extrairCriterio } from '../../criterios/index.js';

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

export async function resumoVendas(periodo, farmaciaId, consulta) {
  const inicio = periodo === 'total' ? null : janelaTempo(periodo);
  // dicionário de formas de pagamento reais
  const dict = ['DINHEIRO','MPESA','EMOLA','POS','TRANSFERENCIA','OUTROS'].map(fp =>
    ({ rotulo: fp.toLowerCase(), rotuloCurto: fp.toLowerCase(), valor: fp, sql: `forma_pagamento = '${fp}'` }));
  const c = extrairCriterio(consulta || '', dict.map(d => ({ rotulo: d.rotulo, rotuloCurto: d.rotuloCurto, valor: d.valor })));
  const especifico = !c.global;
  const item = especifico ? dict.find(d => d.valor === c.criterio.valor) : null;
  const formaCond = item ? ` AND ${item.sql}` : '';
  const filtroData = `($1::timestamptz IS NULL OR data_criacao >= $1)`;
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS total,
           coalesce(avg(total),0)::numeric(12,2) AS ticket_medio
    FROM pedidos_pedido
    WHERE ${filtroData} AND status NOT IN ('CANCELADO','cancelado')
      AND farmacia_id = $2${formaCond}
  `, [inicio, farmaciaId]);
  const porForma = await sql(`
    SELECT coalesce(forma_pagamento,'—') AS forma_pagamento,
           count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS total
    FROM pedidos_pedido
    WHERE ${filtroData} AND status NOT IN ('CANCELADO','cancelado')
      AND farmacia_id = $2${formaCond}
    GROUP BY forma_pagamento ORDER BY total DESC
  `, [inicio, farmaciaId]);
  return { totais, por_forma_pagamento: porForma, pedido: especifico ? 'especifico' : 'global', filtro: item ? { forma_pagamento: item.valor } : undefined };
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

// Relatório próprio da ferramenta (via BD): vendas por produto + faturação por mês + forma
export async function relatorioInsight(farmaciaId) {
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS faturado
    FROM pedidos_pedido WHERE farmacia_id=$1 AND status NOT IN ('CANCELADO','cancelado')`, [farmaciaId]);
  const vendasPorProduto = await sql(`
    SELECT p.nome AS produto, sum(i.quantidade)::int AS unidades,
           sum(i.subtotal)::numeric(12,2) AS receita
    FROM pedidos_itempedido i JOIN produtos_produto p ON p.id=i.produto_id
    JOIN pedidos_pedido ped ON ped.id=i.pedido_id
    WHERE ped.farmacia_id=$1 AND ped.status NOT IN ('CANCELADO','cancelado')
    GROUP BY p.nome ORDER BY receita DESC LIMIT 15`, [farmaciaId]);
  const faturacaoPorMes = await sql(`
    SELECT to_char(date_trunc('month', data_criacao),'YYYY-MM') AS mes,
           count(*)::int AS pedidos, coalesce(sum(total),0)::numeric(12,2) AS total
    FROM pedidos_pedido WHERE farmacia_id=$1 AND status NOT IN ('CANCELADO','cancelado')
    GROUP BY mes ORDER BY mes DESC LIMIT 12`, [farmaciaId]);
  const porForma = await sql(`
    SELECT forma_pagamento, count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS total
    FROM pedidos_pedido WHERE farmacia_id=$1 AND status NOT IN ('CANCELADO','cancelado')
    GROUP BY forma_pagamento ORDER BY total DESC`, [farmaciaId]);
  return { fonte: 'relatorio_criado_pela_ferramenta', totais, vendas_por_produto: vendasPorProduto, faturacao_por_mes: faturacaoPorMes, por_forma_pagamento: porForma };
}
