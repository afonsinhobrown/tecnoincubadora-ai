import express from 'express';
import { contextoDoPedido } from '../../auth/index.js';
import { criarMotor } from '../../ai/motor.js';
import { PROMPT_XONGUILE } from './prompt.js';
import { executarFerramentaXonguile, buscarProdutos as bx } from './ferramentas.js';
import { loginXonguile } from './auth.js';

const motor = criarMotor(PROMPT_XONGUILE, executarFerramentaXonguile, []);
const router = express.Router();

// Login com as credenciais do Xonguile
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });
  try {
    res.json(await loginXonguile(email, password));
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Middleware: token válido + salão
function exigirAutenticacao(req, res, next) {
  const ctx = contextoDoPedido(req);
  if (!ctx || !ctx.farmaciaId) {
    return res.status(401).json({ error: 'Não autenticado ou sem salão autorizado. Faça login.' });
  }
  req.ctx = ctx;
  next();
}
router.use(exigirAutenticacao);

// Assistente: consultas limitadas ao salão do utilizador
router.post('/pergunta', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query é obrigatório' });

  const salonId = req.ctx.farmaciaId;
  const ctx = {
    tenant: { salonId },
    buscarProdutos: (frase, limite) => bx(frase, salonId)
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
    const produto = await executarFerramentaXonguile('detalhe_produto', { id: req.params.id, salonId: req.ctx.farmaciaId });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(produto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
