import express from 'express';
import { contextoDoPedido } from '../../auth/index.js';
import { criarMotor } from '../../ai/motor.js';
import { PROMPT_MACHAMBA } from './prompt.js';
import { executarFerramentaMachamba, buscarProdutos as bx } from './ferramentas.js';
import { loginMachamba } from './auth.js';

const motor = criarMotor(PROMPT_MACHAMBA, executarFerramentaMachamba, []);
const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });
  try {
    res.json(await loginMachamba(email, password));
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

function exigirAutenticacao(req, res, next) {
  const ctx = contextoDoPedido(req);
  if (!ctx || !ctx.farmaciaId) return res.status(401).json({ error: 'Não autenticado. Faça login.' });
  req.ctx = ctx;
  next();
}
router.use(exigirAutenticacao);

router.post('/pergunta', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query é obrigatório' });

  const companyId = req.ctx.farmaciaId;
  const ctx = {
    tenant: { companyId },
    buscarProdutos: (frase, limite) => bx(frase, companyId)
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
    const produto = await executarFerramentaMachamba('detalhe_produto', { id: req.params.id, companyId: req.ctx.farmaciaId });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(produto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
