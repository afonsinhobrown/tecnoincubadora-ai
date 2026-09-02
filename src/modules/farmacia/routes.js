import express from 'express';
import { buscarProdutos, obterProdutoExato } from './search.js';
// Módulo: TECNOINCUBADORA AI — Farmácia (GestorFarma)
// Router montado em /modules/farmacia pelo servidor central (src/server.js)

const router = express.Router();

// Passo 1: string livre -> lista agrupada de produtos
router.post('/buscar', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query é obrigatório' });

  try {
    const resultados = await buscarProdutos(query);
    res.json({ resultados, total: resultados.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Passo 2: utilizador escolhe um produto -> resultado exato + estoque
router.get('/produto/:id', async (req, res) => {
  try {
    const produto = await obterProdutoExato(req.params.id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(produto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
