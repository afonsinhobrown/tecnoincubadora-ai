import express from 'express';
import { contextoDoPedido } from '../../auth/index.js';
import { verificarAcesso, registrarUsoPrompt } from '../../licencas/index.js';
import { getCache, setCache } from '../../cache/index.js';
import { registrarAuditoria } from '../../auditoria/index.js';
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
  if (!ctx || (!ctx.farmaciaId && !ctx.isSuperAdmin)) {
    return res.status(401).json({ error: 'Não autenticado ou sem ginásio autorizado. Faça login.' });
  }
  req.ctx = ctx;
  next();
}
router.use(exigirAutenticacao);

router.post('/pergunta', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query é obrigatório' });
  const isSuperAdmin = !!req.ctx.isSuperAdmin;
  const _lic = await verificarAcesso({ sistemaSlug: 'gymar', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId || 'superadmin'), isSuperAdmin });
  if (!_lic.permitido) return res.status(402).json({ error: _lic.motivo, licenca: _lic, plano: _lic.plano });

  const gymId = isSuperAdmin ? null : req.ctx.farmaciaId;
  const ctx = {
    tenant: { gymId, isSuperAdmin },
    buscarProdutos: (frase, limite) => bx(frase, gymId, isSuperAdmin)
  };
  try {
    const cacheKey = { sistemaSlug: 'gymar', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId), query };
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ ...cached, modo: 'cache', licenca: _lic });
  const { blocos, produtos, modo } = await motor.processar(query, ctx);
    if (!isSuperAdmin) await registrarUsoPrompt({ sistemaSlug: 'gymar', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId) });
      try { await registrarAuditoria({ sistemaSlug: 'gymar' || _lic.plano || 'unknown', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId || ''), tenantNome: _lic.lic?.tenant_nome || '', usuarioId: String(req.ctx.usuarioId||''), usuarioNome: '', query, modo, plano: _lic.plano, licencaStatus: _lic.lic?.status || '', ip: req.ip }); } catch {}
    res.json({ blocos, produtos, total_produtos: produtos.length, modo, licenca: _lic });
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
