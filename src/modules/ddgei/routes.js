import express from 'express';
import { contextoDoPedido } from '../../auth/index.js';
import { criarMotor } from '../../ai/motor.js';
import { PROMPT_DDGEI } from './prompt.js';
import { executarFerramentaDdgei } from './ferramentas.js';
import { loginDdgei } from './auth.js';

const motor = criarMotor(PROMPT_DDGEI, executarFerramentaDdgei, []);
const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username e password são obrigatórios' });
  try {
    res.json(await loginDdgei(username, password));
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

function exigirAutenticacao(req, res, next) {
  const ctx = contextoDoPedido(req);
  if (!ctx) return res.status(401).json({ error: 'Não autenticado. Faça login.' });
  req.ctx = ctx;
  next();
}
router.use(exigirAutenticacao);

router.post('/pergunta', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query é obrigatório' });
  try {
    const { blocos } = await motor.processar(query, { tenant: {} });
    res.json({ blocos, produtos: [], total_produtos: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
