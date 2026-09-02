import express from 'express';
import { contextoDoPedido } from '../../auth/index.js';
import { criarMotor } from '../../ai/motor.js';
import { PROMPT_GYM } from './prompt.js';
import { executarFerramentaGym, buscarProdutos as bx } from './ferramentas.js';
import { loginGym } from './auth.js';

const motor = criarMotor(PROMPT_GYM, executarFerramentaGym, []);
const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });
  try {
    res.json(await loginGym(email, password));
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

function exigirAutenticacao(req, res, next) {
  const ctx = contextoDoPedido(req);
  if (!ctx || !ctx.farmaciaId) {
    return res.status(401).json({ error: 'Não autenticado ou sem ginásio autorizado. Faça login.' });
  }
  req.ctx = ctx;
  next();
}
router.use(exigirAutenticacao);

router.post('/pergunta', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query é obrigatório' });

  const gymId = req.ctx.farmaciaId;
  const ctx = {
    tenant: { gymId },
    buscarProdutos: (frase, limite) => bx(frase, gymId)
  };
  try {
    const { blocos, produtos } = await motor.processar(query, ctx);
    res.json({ blocos, produtos, total_produtos: produtos.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/produto/:id', async (req, res) => {
  try {
    const produto = await executarFerramentaGym('detalhe_produto', { id: req.params.id, gymId: req.ctx.farmaciaId });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(produto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
