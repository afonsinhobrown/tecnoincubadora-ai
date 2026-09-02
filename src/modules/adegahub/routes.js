import express from 'express';
import { contextoDoPedido } from '../../auth/index.js';
import { verificarAcesso, registrarUsoPrompt } from '../../licencas/index.js';
import { getCache, setCache } from '../../cache/index.js';
import { registrarAuditoria } from '../../auditoria/index.js';
import { criarMotor } from '../../ai/motor.js';
import { PROMPT_ADEGAHUB } from './prompt.js';
import { executarFerramentaAdegahub, buscarProdutos as bx } from './ferramentas.js';
import { loginAdegahub } from './auth.js';

const motor = criarMotor(PROMPT_ADEGAHUB, executarFerramentaAdegahub, []);
const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });
  try {
    res.json(await loginAdegahub(email, password));
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

function exigirAutenticacao(req, res, next) {
  const ctx = contextoDoPedido(req);
  if (!ctx || (!ctx.farmaciaId && !ctx.isSuperAdmin)) return res.status(401).json({ error: 'Não autenticado. Faça login.' });
  req.ctx = ctx;
  next();
}
router.use(exigirAutenticacao);

router.post('/pergunta', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query é obrigatório' });
  const _lic = await verificarAcesso({ sistemaSlug: 'adegahub', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId), isSuperAdmin: !!req.ctx.isSuperAdmin });
  if (!_lic.permitido) return res.status(402).json({ error: _lic.motivo, licenca: _lic, plano: _lic.plano });

  const tenantId = req.ctx.farmaciaId;
  const ctx = {
    tenant: { tenantId },
    buscarProdutos: (frase, limite) => bx(frase, tenantId)
  };
  try {
    const cacheKey = { sistemaSlug: 'adegahub', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId), query };
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ ...cached, modo: 'cache', licenca: _lic });
  const { blocos, produtos, modo } = await motor.processar(query, ctx);
    await registrarUsoPrompt({ sistemaSlug: 'adegahub', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId) });
      try { await registrarAuditoria({ sistemaSlug: 'adegahub' || _lic.plano || 'unknown', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId || ''), tenantNome: _lic.lic?.tenant_nome || '', usuarioId: String(req.ctx.usuarioId||''), usuarioNome: '', query, modo, plano: _lic.plano, licencaStatus: _lic.lic?.status || '', ip: req.ip }); } catch {}
    res.json({ blocos, produtos, total_produtos: produtos.length, modo, licenca: _lic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/produto/:id', async (req, res) => {
  try {
    const produto = await executarFerramentaAdegahub('detalhe_produto', { id: req.params.id, tenantId: req.ctx.farmaciaId });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(produto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
