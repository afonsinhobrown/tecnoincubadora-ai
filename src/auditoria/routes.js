import express from 'express';
import { contextoDoPedido } from '../auth/index.js';
import { listarAuditoria, resetPrompts } from './index.js';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.FARMACIA_DATABASE_URL);
const router = express.Router();

function exigirAuth(req, res, next) {
  const ctx = contextoDoPedido(req);
  if (!ctx) return res.status(401).json({ error: 'Não autenticado' });
  req.ctx = ctx; next();
}
function exigirSuperAdmin(req, res, next) {
  const ctx = contextoDoPedido(req);
  if (!ctx || !ctx.isSuperAdmin) return res.status(403).json({ error: 'Apenas superadmin' });
  req.ctx = ctx; next();
}

// GET /api/auditoria?sistema=gymar&tenantId=xxx&usuarioId=yyy  (superadmin vê tudo, normal vê só o seu tenant)
router.get('/', exigirAuth, async (req, res) => {
  const isSuper = !!req.ctx.isSuperAdmin;
  const sistemaSlug = req.query.sistema || null;
  const tenantId = isSuper ? (req.query.tenantId || null) : String(req.ctx.farmaciaId || req.ctx.usuarioId);
  const usuarioId = isSuper ? (req.query.usuarioId || null) : null;
  try {
    const lista = await listarAuditoria({ sistemaSlug, tenantId, usuarioId, limite: Number(req.query.limite) || 200 });
    res.json(lista);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auditoria/reset  { sistemaSlug, tenantId }  (superadmin)
router.post('/reset', exigirSuperAdmin, async (req, res) => {
  const { sistemaSlug, tenantId } = req.body;
  if (!sistemaSlug || !tenantId) return res.status(400).json({ error: 'sistemaSlug e tenantId obrigatórios' });
  try {
    await resetPrompts({ sistemaSlug, tenantId });
    const r = await sql`SELECT * FROM tecno_licencas WHERE sistema_slug=${sistemaSlug} AND tenant_id=${tenantId}`;
    res.json(r[0] || { ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
