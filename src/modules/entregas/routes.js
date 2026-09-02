import express from 'express';
import { neon } from '@neondatabase/serverless';
import { contextoDoPedido } from '../../auth/index.js';
import { verificarAcesso, registrarUsoPrompt } from '../../licencas/index.js';
import { criarMotor } from '../../ai/motor.js';
import { PROMPT_ENTREGAS } from './prompt.js';
import { executarFerramentaEntregas } from './ferramentas.js';
import { loginEntregas } from './auth.js';

const sql = neon(process.env.ENTREGAS_DATABASE_URL);
const motor = criarMotor(PROMPT_ENTREGAS, executarFerramentaEntregas, []);
const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });
  try {
    res.json(await loginEntregas(email, password));
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

function exigirAutenticacao(req, res, next) {
  const ctx = contextoDoPedido(req);
  if (!ctx || !ctx.usuarioId) return res.status(401).json({ error: 'Não autenticado. Faça login.' });
  req.ctx = ctx;
  next();
}
router.use(exigirAutenticacao);

router.post('/pergunta', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query é obrigatório' });
  const _lic = await verificarAcesso({ sistemaSlug: 'entregasmoz', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId) });
  if (!_lic.permitido) return res.status(402).json({ error: _lic.motivo, licenca: _lic, plano: _lic.plano });

  try {
    // resolve contexto do utilizador a partir do uid do token
    const user = await sql(`SELECT id, "userType" FROM "User" WHERE id = $1`, [req.ctx.usuarioId]);
    const u = user[0];
    let providerId = null;
    if (u && u.userType === 'PROVIDER') {
      const p = await sql(`SELECT id FROM "Provider" WHERE "userId" = $1 LIMIT 1`, [u.id]);
      providerId = p[0]?.id || null;
    }
    const tenant = { userId: req.ctx.usuarioId, userType: u?.userType || 'ADMIN', providerId };
    const { blocos, produtos, modo } = await motor.processar(query, { tenant });
    await registrarUsoPrompt({ sistemaSlug: 'entregasmoz', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId) });
    res.json({ blocos, produtos, total_produtos: produtos.length, modo, licenca: _lic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
