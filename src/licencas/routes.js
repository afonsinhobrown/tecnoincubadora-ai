import express from 'express';
import { contextoDoPedido } from '../auth/index.js';
import { verificarAcesso, registrarDownload, getOrCreateLicenca } from './index.js';

const router = express.Router();

function exigirAuth(req, res, next) {
  const ctx = contextoDoPedido(req);
  if (!ctx || !ctx.farmaciaId) return res.status(401).json({ error: 'Não autenticado' });
  req.ctx = ctx; next();
}

// GET /api/licencas/status?sistema=gymar  -> estado da licença do tenant autenticado
router.get('/status', exigirAuth, async (req, res) => {
  const sistemaSlug = req.query.sistema || 'gestorfarma';
  try {
    const lic = await getOrCreateLicenca({ sistemaSlug, tenantId: String(req.ctx.farmaciaId) });
    // para resposta, busca verificação completa (com limites)
    const ver = await verificarAcesso({ sistemaSlug, tenantId: String(req.ctx.farmaciaId) });
    res.json({ licenca: ver });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/licencas/download  { sistemaSlug } -> verifica e debita 1 download
router.post('/download', exigirAuth, async (req, res) => {
  const sistemaSlug = req.body.sistemaSlug || req.query.sistema || 'gestorfarma';
  const tenantId = String(req.ctx.farmaciaId || req.ctx.usuarioId);
  try {
    const ver = await verificarAcesso({ sistemaSlug, tenantId });
    if (ver.unlimited) { await registrarDownload({ sistemaSlug, tenantId }); return res.json({ ok: true, licenca: ver }); }
    const plano = ver.plano;
    const limites = { basico: 0, standard: 10, pro: Infinity };
    const limite = limites[plano] ?? 0;
    const usados = ver.lic?.downloads_usados ?? 0;
    if (usados >= limite) return res.status(402).json({ error: `Limite de ${limite} downloads/mês do plano ${plano} atingido. Faça upgrade.`, licenca: ver });
    await registrarDownload({ sistemaSlug, tenantId });
    const ver2 = await verificarAcesso({ sistemaSlug, tenantId });
    res.json({ ok: true, licenca: ver2 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
