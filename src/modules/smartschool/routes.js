import express from 'express';
import { contextoDoPedido } from '../../auth/index.js';
import { criarMotor } from '../../ai/motor.js';
import { PROMPT_SMARTSCHOOL } from './prompt.js';
import { executarFerramentaSmartschool } from './ferramentas.js';
import { loginSmartschool } from './auth.js';

const motor = criarMotor(PROMPT_SMARTSCHOOL, executarFerramentaSmartschool, []);
const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });
  try {
    res.json(await loginSmartschool(email, password));
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

  const escolaId = req.ctx.farmaciaId;
  try {
    const { blocos, produtos, modo } = await motor.processar(query, { tenant: { escolaId } });
    res.json({ blocos, produtos, total_produtos: produtos.length, modo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
