import express from 'express';
import { neon } from '@neondatabase/serverless';
import { contextoDoPedido } from '../../auth/index.js';
import { verificarAcesso, registrarUsoPrompt } from '../../licencas/index.js';
import { criarMotor } from '../../ai/motor.js';
import { PROMPT_CREDHUB } from './prompt.js';
import { executarFerramentaCredhub } from './ferramentas.js';
import { loginCredhub } from './auth.js';

const sql = neon(process.env.CREDHUB_DATABASE_URL);
const motor = criarMotor(PROMPT_CREDHUB, executarFerramentaCredhub, []);
const router = express.Router();

router.post('/login', async (req, res) => {
  const { tenant, password } = req.body;
  if (!tenant || !password) return res.status(400).json({ error: 'tenant e password são obrigatórios' });
  try {
    res.json(await loginCredhub(tenant, password));
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
  const _lic = await verificarAcesso({ sistemaSlug: 'credhub', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId) });
  if (!_lic.permitido) return res.status(402).json({ error: _lic.motivo, licenca: _lic, plano: _lic.plano });

  try {
    // resolve o schema do tenant a partir do id autenticado
    const t = await sql(`SELECT schema_name FROM tenants WHERE id = $1`, [req.ctx.farmaciaId]);
    const schema = t[0]?.schema_name;
    if (!schema) return res.status(403).json({ error: 'Tenant sem schema configurado.' });
    const { blocos, produtos, modo } = await motor.processar(query, { tenant: { schema } });
    await registrarUsoPrompt({ sistemaSlug: 'credhub', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId) });
    res.json({ blocos, produtos, total_produtos: produtos.length, modo, licenca: _lic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
