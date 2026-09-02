import express from 'express';
import { contextoDoPedido } from '../../auth/index.js';
import { verificarAcesso, registrarUsoPrompt } from '../../licencas/index.js';
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
  const _lic = await verificarAcesso({ sistemaSlug: 'ddgei', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId) });
  if (!_lic.permitido) return res.status(402).json({ error: _lic.motivo, licenca: _lic, plano: _lic.plano });

  try {
    const { blocos, modo } = await motor.processar(query, { tenant: {} });
    await registrarUsoPrompt({ sistemaSlug: 'ddgei', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId) });
    res.json({ blocos, produtos: [], total_produtos: 0, modo, licenca: _lic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
