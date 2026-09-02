import express from 'express';
import { contextoDoPedido } from '../../auth/index.js';
import { criarMotor } from '../../ai/motor.js';
import { PROMPT_CAFEPOINT } from './prompt.js';
import { executarFerramentaCafepoint, buscarProdutos as bx } from './ferramentas.js';
import { loginCafepoint } from './auth.js';

const motor = criarMotor(PROMPT_CAFEPOINT, executarFerramentaCafepoint, []);
const router = express.Router();

router.post('/login', async (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ error: 'usuario e password são obrigatórios' });
  try {
    res.json(await loginCafepoint(usuario, password));
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

function exigirAutenticacao(req, res, next) {
  const ctx = contextoDoPedido(req);
  if (!ctx || !ctx.farmaciaId) {
    return res.status(401).json({ error: 'Não autenticado ou sem restaurante autorizado. Faça login.' });
  }
  req.ctx = ctx;
  next();
}
router.use(exigirAutenticacao);

router.post('/pergunta', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query é obrigatório' });

  const restaurantId = req.ctx.farmaciaId;
  const ctx = {
    tenant: { restaurantId },
    buscarProdutos: (frase, limite) => bx(frase, restaurantId)
  };
  try {
    const { blocos, produtos, modo } = await motor.processar(query, ctx);
    res.json({ blocos, produtos, total_produtos: produtos.length, modo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/produto/:id', async (req, res) => {
  try {
    const produto = await executarFerramentaCafepoint('detalhe_produto', { id: req.params.id, restaurantId: req.ctx.farmaciaId });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(produto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
