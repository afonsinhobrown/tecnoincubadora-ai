import express from 'express';
import { contextoDoPedido } from '../../auth/index.js';
import { verificarAcesso, registrarUsoPrompt } from '../../licencas/index.js';
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
  const _lic = await verificarAcesso({ sistemaSlug: 'smartschool', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId) });
  if (!_lic.permitido) return res.status(402).json({ error: _lic.motivo, licenca: _lic, plano: _lic.plano });

  const escolaId = req.ctx.farmaciaId;
  try {
    const { blocos, produtos, modo } = await motor.processar(query, { tenant: { escolaId } });
    await registrarUsoPrompt({ sistemaSlug: 'smartschool', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId) });
    res.json({ blocos, produtos, total_produtos: produtos.length, modo, licenca: _lic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
