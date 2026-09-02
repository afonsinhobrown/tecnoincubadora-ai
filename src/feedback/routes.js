import express from 'express';
import { contextoDoPedido } from '../auth/index.js';
import { salvarFeedback, listarFeedback } from './index.js';

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

// POST /api/feedback  { sistemaSlug, tenantId, query, blocoTitulo, blocoIntencao, gostou, comentario }
router.post('/', exigirAuth, async (req, res) => {
  const { sistemaSlug, query, blocoTitulo, blocoIntencao, gostou, comentario } = req.body;
  if (typeof gostou !== 'boolean') return res.status(400).json({ error: 'gostou (boolean) obrigatório' });
  try {
    const r = await salvarFeedback({
      sistemaSlug: sistemaSlug || 'unknown',
      tenantId: String(req.ctx.farmaciaId || req.ctx.usuarioId || ''),
      usuarioId: String(req.ctx.usuarioId || ''),
      usuarioNome: '',
      query: query || '',
      blocoTitulo: blocoTitulo || '',
      blocoIntencao: blocoIntencao || '',
      gostou, comentario: comentario || ''
    });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', exigirSuperAdmin, async (req, res) => {
  try {
    const lista = await listarFeedback({ sistemaSlug: req.query.sistema || null, limite: Number(req.query.limite) || 200 });
    res.json(lista);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
