import express from 'express';
import { contextoDoPedido } from '../../auth/index.js';
import { verificarAcesso, registrarUsoPrompt } from '../../licencas/index.js';
import { getCache, setCache } from '../../cache/index.js';
import { registrarAuditoria } from '../../auditoria/index.js';
import { criarMotor } from '../../ai/motor.js';
import { PROMPT_DDGEI } from './prompt.js';
import { executarFerramentaDdgei } from './ferramentas.js';
import { loginDdgei } from './auth.js';
import { gerarGuiaPdf } from './guia.js';

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
  const isSuperAdmin = !!req.ctx.isSuperAdmin;
  const _lic = await verificarAcesso({ sistemaSlug: 'ddgei', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId), isSuperAdmin });
  if (!_lic.permitido) return res.status(402).json({ error: _lic.motivo, licenca: _lic, plano: _lic.plano });

  try {
    const cacheKey = { sistemaSlug: 'ddgei', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId), query };
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ ...cached, modo: 'cache', licenca: _lic });
  const { blocos, modo } = await motor.processar(query, { tenant: { consulta: query } });
    await registrarUsoPrompt({ sistemaSlug: 'ddgei', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId) });
      try { await registrarAuditoria({ sistemaSlug: 'ddgei', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId || ''), tenantNome: _lic.lic?.tenant_nome || '', usuarioId: String(req.ctx.usuarioId||''), usuarioNome: '', query, modo, plano: _lic.plano, licencaStatus: _lic.lic?.status || '', ip: req.ip }); } catch {}
    if (blocos.length) await setCache({ sistemaSlug: 'ddgei', tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId), query, resposta: { blocos, produtos: [], total_produtos: 0, modo } });
    res.json({ blocos, produtos: [], total_produtos: 0, modo, licenca: _lic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ddgei/guia/:guia/pdf  -> download da ficha PDF da guia
router.get('/guia/:guia/pdf', async (req, res) => {
  try {
    const buf = await gerarGuiaPdf(req.params.guia);
    if (!buf) return res.status(404).json({ error: 'Guia não encontrada' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="guia_${req.params.guia}.pdf"`);
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
