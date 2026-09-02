import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.FARMACIA_DATABASE_URL);

// ── Deteção de intenções em linguagem natural ────────────────────────────
// Cada intenção reconhecida gera um bloco de resposta independente.

const PADROES_INTENCOES = [
  {
    id: 'vendas_hoje',
    padrao: /\b(venda|vendas|fatur(a|a)ç(ã|a)o|factura|fatura|faturou|facturou)\b.*\b(hoje|dia|agora)\b|\bhoje\b.*\b(vend|fatur|factur)/i,
    titulo: '💰 Vendas de hoje',
    run: () => resumoVendas('hoje')
  },
  {
    id: 'vendas_semana',
    padrao: /\b(venda|vendas|fatur(a|a)ç(ã|a)o|factura|fatura)\b.*\b(semana|sete dias|7 dias)\b|\b(semana)\b.*\b(vend|fatur|factur)/i,
    titulo: '💰 Vendas da semana',
    run: () => resumoVendas('semana')
  },
  {
    id: 'vendas_mes',
    padrao: /\b(venda|vendas|fatur(a|a)ç(ã|a)o|factura|fatura|facturamento|faturamento)\b.*\b(m(ê|e)s|mensal|mes)\b|\b(m(ê|e)s|mensal)\b.*\b(vend|fatur|factur)|\b(vendas|faturacao|faturaçao|faturação|faturamento)\b\s*$/,
    titulo: '💰 Vendas do mês',
    run: () => resumoVendas('mes')
  },
  {
    id: 'vendas_periodo',
    padrao: /\b(venda|vendas|fatur|factur)/i,
    titulo: '💰 Resumo de vendas (últimos 30 dias)',
    run: () => resumoVendas('30d')
  },
  {
    id: 'top_produtos',
    padrao: /\b(mais vendido|mais vendidos|top|produtos mais|mais saem|campe(ã|a)o|campeoes|campe(õ|o)es|best ?seller)/i,
    titulo: '🏆 Produtos mais vendidos',
    run: () => topProdutos()
  },
  {
    id: 'estoque_baixo',
    padrao: /\b(estoque|stock)\b.*\b(baixo|baixa|minimo|mínimo|acab|esgot|falta|repor)\b|\b(repor|faltando?)\b/i,
    titulo: '⚠️ Produtos com estoque baixo',
    run: () => estoqueBaixo()
  },
  {
    id: 'clientes',
    padrao: /\b(cliente|clientes|consumidor)/i,
    titulo: '👥 Clientes',
    run: () => resumoClientes()
  },
  {
    id: 'pedidos_abertos',
    padrao: /\b(pedido|pedidos|encomenda|encomendas)\b.*\b(aberto|abertos|pendente|pendentes|andamento|ativo|ativos|status|estado)\b|\bstatus\b.*\bpedido/i,
    titulo: '📦 Pedidos por estado',
    run: () => pedidosPorEstado()
  }
];

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

async function resumoVendas(periodo) {
  const inicio = janelaTempo(periodo);
  const [totais] = await sql(`
    SELECT count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS total,
           coalesce(avg(total),0)::numeric(12,2) AS ticket_medio
    FROM pedidos_pedido
    WHERE data_criacao >= $1 AND status NOT IN ('CANCELADO','cancelado')
  `, [inicio]);
  const porForma = await sql(`
    SELECT coalesce(forma_pagamento,'—') AS forma_pagamento,
           count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS total
    FROM pedidos_pedido
    WHERE data_criacao >= $1 AND status NOT IN ('CANCELADO','cancelado')
    GROUP BY forma_pagamento ORDER BY total DESC
  `, [inicio]);
  return { totais, por_forma_pagamento: porForma };
}

async function topProdutos() {
  return sql(`
    SELECT p.nome, p.nome_generico,
           sum(i.quantidade)::int AS quantidade_vendida,
           sum(i.subtotal)::numeric(12,2) AS receita
    FROM pedidos_itempedido i
    JOIN produtos_produto p ON p.id = i.produto_id
    JOIN pedidos_pedido ped ON ped.id = i.pedido_id
    WHERE ped.status NOT IN ('CANCELADO','cancelado')
    GROUP BY p.id, p.nome, p.nome_generico
    ORDER BY quantidade_vendida DESC
    LIMIT 10
  `);
}

async function estoqueBaixo() {
  return sql(`
    SELECT p.id, p.nome, p.nome_generico,
           e.quantidade, e.quantidade_minima,
           e.preco_venda, e.data_validade::date AS data_validade
    FROM produtos_estoqueproduto e
    JOIN produtos_produto p ON p.id = e.produto_id
    WHERE p.is_ativo = true AND e.is_disponivel = true
      AND e.quantidade <= e.quantidade_minima
    ORDER BY e.quantidade ASC
    LIMIT 20
  `);
}

async function resumoClientes() {
  const [totais] = await sql(`
    SELECT count(*)::int AS clientes,
           count(*) FILTER (WHERE data_criacao >= now() - interval '30 days')::int AS novos_30d
    FROM clientes_cliente
  `);
  return totais;
}

async function pedidosPorEstado() {
  return sql(`
    SELECT status, count(*)::int AS pedidos,
           coalesce(sum(total),0)::numeric(12,2) AS total
    FROM pedidos_pedido
    GROUP BY status ORDER BY pedidos DESC
  `);
}

/**
 * Recebe a frase do utilizador, devolve os blocos de resposta das
 * intenções reconhecidas. Lista vazia = não era pergunta de relatório.
 */
export async function processarIntencoes(frase) {
  const blocos = [];
  const limiar = 4; // evita rodar tudo quando só 1 palavra bate
  let vendasJaRespondida = false;

  for (const intencao of PADROES_INTENCOES) {
    // "vendas_periodo" é o genérico: só corre se nenhuma mais específica bateu
    if (intencao.id === 'vendas_periodo' && vendasJaRespondida) continue;
    if (!intencao.padrao.test(frase)) continue;

    if (intencao.id.startsWith('vendas_') && intencao.id !== 'vendas_periodo') {
      vendasJaRespondida = true;
    }
    try {
      const dados = await intencao.run();
      blocos.push({ intencao: intencao.id, titulo: intencao.titulo, dados });
    } catch (err) {
      blocos.push({ intencao: intencao.id, titulo: intencao.titulo, erro: err.message });
    }
    if (blocos.length >= limiar) break;
  }
  return blocos;
}
