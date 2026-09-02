import express from 'express';
import { contextoDoPedido } from '../auth/index.js';
import { verificarAcesso, registrarDownload, getOrCreateLicenca, listarLicencas, atualizarLicenca, renovarLicenca, bloquearLicenca } from './index.js';

const router = express.Router();

function exigirAuth(req, res, next) {
  const ctx = contextoDoPedido(req);
  if (!ctx || (!ctx.farmaciaId && !ctx.isSuperAdmin)) return res.status(401).json({ error: 'Não autenticado' });
  req.ctx = ctx; next();
}
function exigirSuperAdmin(req, res, next) {
  const ctx = contextoDoPedido(req);
  if (!ctx || !ctx.isSuperAdmin) return res.status(403).json({ error: 'Apenas superadmin' });
  req.ctx = ctx; next();
}

// GET /api/licencas/status?sistema=gymar  -> estado da licença do tenant autenticado
router.get('/status', exigirAuth, async (req, res) => {
  const sistemaSlug = req.query.sistema || 'gestorfarma';
  const tenantId = String(req.query.tenantId || req.ctx.farmaciaId || req.ctx.usuarioId);
  const isSuperAdmin = !!req.ctx.isSuperAdmin;
  try {
    const lic = await getOrCreateLicenca({ sistemaSlug, tenantId, isSuperAdmin });
    const ver = await verificarAcesso({ sistemaSlug, tenantId, isSuperAdmin });
    res.json({ licenca: ver });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/licencas/download  { sistemaSlug } -> verifica e debita 1 download
router.post('/download', exigirAuth, async (req, res) => {
  const sistemaSlug = req.body.sistemaSlug || req.query.sistema || 'gestorfarma';
  const tenantId = String(req.ctx.farmaciaId || req.ctx.usuarioId);
  const isSuperAdmin = !!req.ctx.isSuperAdmin;
  try {
    const ver = await verificarAcesso({ sistemaSlug, tenantId, isSuperAdmin });
    if (ver.unlimited) { await registrarDownload({ sistemaSlug, tenantId }); return res.json({ ok: true, licenca: ver }); }
    const plano = ver.plano;
    const limites = { basico: 0, standard: 10, pro: Infinity };
    const limite = limites[plano] ?? 0;
    const usados = ver.lic?.downloads_usados ?? 0;
    if (usados >= limite) return res.status(402).json({ error: `Limite de ${limite} downloads/mês do plano ${plano} atingido. Faça upgrade.`, licenca: ver });
    await registrarDownload({ sistemaSlug, tenantId });
    const ver2 = await verificarAcesso({ sistemaSlug, tenantId, isSuperAdmin });
    res.json({ ok: true, licenca: ver2 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Superadmin: gestão de licenças ─────────────────────────────────
router.get('/', exigirSuperAdmin, async (req, res) => {
  try { const lista = await listarLicencas(); res.json(lista); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.patch('/:sistema/:tenantId', exigirSuperAdmin, async (req, res) => {
  try {
    const r = await atualizarLicenca({ sistemaSlug: req.params.sistema, tenantId: req.params.tenantId, plano: req.body.plano, status: req.body.status, trialFim: req.body.trialFim });
    res.json(r);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/:sistema/:tenantId/renovar', exigirSuperAdmin, async (req, res) => {
  try {
    const r = await renovarLicenca({ sistemaSlug: req.params.sistema, tenantId: req.params.tenantId, dias: Number(req.body.dias) || 10 });
    res.json(r);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/:sistema/:tenantId/bloquear', exigirSuperAdmin, async (req, res) => {
  try {
    const bloquear = req.body.bloquear !== false;
    const r = await bloquearLicenca({ sistemaSlug: req.params.sistema, tenantId: req.params.tenantId, bloquear });
    res.json(r);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/:sistema/:tenantId/desbloquear', exigirSuperAdmin, async (req, res) => {
  try {
    const r = await bloquearLicenca({ sistemaSlug: req.params.sistema, tenantId: req.params.tenantId, bloquear: false });
    res.json(r);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

export default router;
