import express from 'express';
import { SISTEMAS, sistemaPorSlug } from '../../sistemas.js';
import { login as loginFarmacia, isSuperAdminCredentials, assinarSuperAdminToken } from '../../auth/index.js';
import { loginXonguile } from '../xonguile/auth.js';
import { loginCafepoint } from '../cafepoint/auth.js';
import { loginArmazem } from '../armazem/auth.js';
import { loginGym } from '../gym/auth.js';
import { loginDdgei } from '../ddgei/auth.js';
import { loginCredhub } from '../credhub/auth.js';
import { loginAdegahub } from '../adegahub/auth.js';
import { loginMachamba } from '../machamba/auth.js';
import { loginSmartschool } from '../smartschool/auth.js';
import { loginBrokerhub } from '../brokerhub/auth.js';
import { loginEntregas } from '../entregas/auth.js';

const router = express.Router();

// Lista dos sistemas que usam a IA (para a landing page)
router.get('/', (_req, res) => {
  res.json(SISTEMAS);
});

// Login separado por sistema, com as credenciais que o utilizador já usa
// no respetivo sistema. Cada módulo implementado tem o seu handler.
router.post('/:slug/login', async (req, res) => {
  const sistema = sistemaPorSlug(req.params.slug);
  if (!sistema) return res.status(404).json({ error: 'Sistema não reconhecido.' });

  if (!sistema.implementado) {
    return res.status(501).json({ error: `O sistema ${sistema.nome} ainda não está integrado.` });
  }

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });

  // Superadmin da ferramenta: acesso ilimitado a qualquer sistema
  if (isSuperAdminCredentials(email, password)) {
    return res.json({
      token: assinarSuperAdminToken(),
      usuario: { id: 'superadmin', email, nome: 'Superadmin', tipo_usuario: 'SUPERADMIN' },
      farmacia: { id: null, nome: 'Superadmin (todos os tenants)' }
    });
  }

  try {
    switch (sistema.slug) {
      case 'gestorfarma':
        res.json(await loginFarmacia(email, password));
        break;
      case 'xonguile':
        res.json(await loginXonguile(email, password));
        break;
      case 'cafepoint':
        res.json(await loginCafepoint(email, password));
        break;
      case 'wms':
        res.json(await loginArmazem(email, password));
        break;
      case 'gymar':
      case 'hefelgym':
        res.json(await loginGym(email, password));
        break;
      case 'ddgei':
        res.json(await loginDdgei(email, password));
        break;
      case 'credhub':
        // o campo `email` transporta o nome do tenant
        res.json(await loginCredhub(email, password));
        break;
      case 'adegahub':
        res.json(await loginAdegahub(email, password));
        break;
      case 'machambapro':
        res.json(await loginMachamba(email, password));
        break;
      case 'smartschool':
        res.json(await loginSmartschool(email, password));
        break;
      case 'brokerhub':
        res.json(await loginBrokerhub(email, password));
        break;
      case 'entregasmoz':
        res.json(await loginEntregas(email, password));
        break;
      default:
        res.status(501).json({ error: 'Login deste sistema ainda não implementado.' });
    }
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

export default router;
