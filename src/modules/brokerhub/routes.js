import express from 'express';
import { contextoDoPedido } from '../../auth/index.js';
import { criarMotor } from '../../ai/motor.js';
import { PROMPT_BROKERHUB } from './prompt.js';
import { executarFerramentaBrokerhub } from './ferramentas.js';
import { loginBrokerhub } from './auth.js';

const motor = criarMotor(PROMPT_BROKERHUB, executarFerramentaBrokerhub, []);
const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });
  try {
    res.json(await loginBrokerhub(email, password));
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

  const tenantId = req.ctx.farmaciaId;
  try {
    const { blocos, produtos } = await motor.processar(query, { tenant: { tenantId } });
    res.json({ blocos, produtos, total_produtos: produtos.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
