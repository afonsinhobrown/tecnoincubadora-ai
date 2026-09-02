/**
 * ═══════════════════════════════════════════════════════════════════
 *  REGISTO DE FERRAMENTAS
 *  Quase todas são APENAS LEITURA e recebem sempre o contexto autenticado
 *  (farmaciaId) para scoping multi-tenant. A única de escrita é
 *  `fazer_venda`, reservada a utilizador autenticado e autorizado.
 *  O motor só executa ferramentas que existam AQUI E estejam autorizadas
 *  no prompt (src/ai/promptSistema.js -> `ferramentas`).
 * ═══════════════════════════════════════════════════════════════════
 */
import {
  resumoVendas,
  topProdutos,
  estoqueBaixo,
  resumoClientes,
  pedidosPorEstado
} from '../modules/farmacia/reporting.js';
import {
  buscarProdutos,
  obterProdutoExato
} from '../modules/farmacia/search.js';
import { fazerVenda } from '../modules/farmacia/vendas.js';

function farmaciaDe(params) {
  if (!params?.farmaciaId) throw new Error('Sessão sem farmácia: inicie sessão.');
  return params.farmaciaId;
}

export const FERRAMENTAS = {
  buscar_produtos: (p = {}) => buscarProdutos(p.termos ?? '', 8, farmaciaDe(p)),
  vendas: (p = {}) => resumoVendas(p.periodo ?? 'total', farmaciaDe(p), p.consulta),
  top_produtos: (p = {}) => topProdutos(farmaciaDe(p)),
  estoque_baixo: (p = {}) => estoqueBaixo(farmaciaDe(p)),
  pedidos_estado: (p = {}) => pedidosPorEstado(farmaciaDe(p)),
  clientes: (p = {}) => resumoClientes(farmaciaDe(p)),
  detalhe_produto: (p = {}) => obterProdutoExato(p.id),
  // ESCRITA — apenas com utilizador autorizado na farmácia
  fazer_venda: (p = {}) => fazerVenda(p, { farmaciaId: p.farmaciaId, vendedorId: p.vendedorId })
};

export async function executarFerramenta(nome, params = {}) {
  const ferramenta = FERRAMENTAS[nome];
  if (!ferramenta) throw new Error(`Ferramenta desconhecida: "${nome}"`);
  return ferramenta(params);
}

export { buscarProdutos };
