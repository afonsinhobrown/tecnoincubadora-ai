import express from 'express';
import { buscarProdutos, obterProdutoExato } from './search.js';
import { processar } from '../../ai/motor.js';
import { login, contextoDoPedido } from '../../auth/index.js';
import { verificarAcesso, registrarUsoPrompt } from '../../licencas/index.js';
// Módulo: TECNOINCUBADORA AI — Farmácia (GestorFarma)
// Router montado em /modules/farmacia pelo servidor central (src/server.js)
// Todo o acesso à IA exige credencial; as operações são limitadas à farmácia
// do utilizador autenticado (multi-tenant).

const router = express.Router();

// Autenticação: credenciais -> token + farmácia
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });
  try {
    const sessao = await login(email, password);
    res.json(sessao);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Middleware: exige token válido e devolve o contexto (farmaciaId, vendedorId)
function exigirAutenticacao(req, res, next) {
  const ctx = contextoDoPedido(req);
  if (!ctx || (!ctx.farmaciaId && !ctx.isSuperAdmin)) {
    return res.status(401).json({ error: 'Não autenticado ou sem farmácia autorizada. Faça login.' });
  }
  req.ctx = ctx;
  next();
}

router.use(exigirAutenticacao);

// Endpoint principal: o motor dirigido por prompt (src/ai/motor.js) interpreta
// a frase segundo o prompt de sistema e executa apenas ferramentas autorizadas,
// sempre limitadas à farmácia do utilizador autenticado.
router.post('/pergunta', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query é obrigatório' });
  const _lic = await verificarAcesso({ sistemaSlug: 'gestorfarma', tenantId: String(req.ctx.farmaciaId) });
  if (!_lic.permitido) return res.status(402).json({ error: _lic.motivo, licenca: _lic, plano: _lic.plano });

  const { farmaciaId, vendedorId } = req.ctx;
  const ctx = {
    farmaciaId,
    vendedorId,
    buscarProdutos: (frase, limite) => buscarProdutos(frase, limite, farmaciaId)
  };
  try {
    const { blocos, produtos, modo } = await processar(query, ctx);
    await registrarUsoPrompt({ sistemaSlug: 'gestorfarma', tenantId: String(req.ctx.farmaciaId) });
    res.json({ blocos, produtos: produtos.slice(0, 8), total_produtos: produtos.length, modo, licenca: _lic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Passo 1: string livre -> lista agrupada de produtos (da própria farmácia)
router.post('/buscar', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query é obrigatório' });

  try {
    const resultados = await buscarProdutos(query, 20, req.ctx.farmaciaId);
    res.json({ resultados, total: resultados.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Passo 2: utilizador escolhe um produto -> resultado exato + estoque
router.get('/produto/:id', async (req, res) => {
  try {
    const produto = await obterProdutoExato(req.params.id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(produto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
