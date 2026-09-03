import express from 'express';
import 'dotenv/config';
import { LANDING_HTML } from './landing.js';
import farmaciaRouter from './modules/farmacia/routes.js';
import sistemasRouter from './modules/sistemas/routes.js';
import xonguileRouter from './modules/xonguile/routes.js';
import cafepointRouter from './modules/cafepoint/routes.js';
import armazemRouter from './modules/armazem/routes.js';
import gymRouter from './modules/gym/routes.js';
import ddgeiRouter from './modules/ddgei/routes.js';
import credhubRouter from './modules/credhub/routes.js';
import adegahubRouter from './modules/adegahub/routes.js';
import machambaRouter from './modules/machamba/routes.js';
import smartschoolRouter from './modules/smartschool/routes.js';
import brokerhubRouter from './modules/brokerhub/routes.js';
import entregasRouter from './modules/entregas/routes.js';
import statseRouter from './modules/statse/routes.js';
import licencaRouter from './licencas/routes.js';
import auditoriaRouter from './auditoria/routes.js';
import feedbackRouter from './feedback/routes.js';

// TECNOINCUBADORA AI — motor central, um módulo por SaaS
// Este ficheiro monta o app Express e exporta-o (sem listen) para poder
// correr tanto localmente como em serverless (Vercel).
const app = express();
app.use(express.json());

// Interface de teste pública
app.use(express.static('public'));

// Catálogo de sistemas + login separado por sistema
app.use('/api/sistemas', sistemasRouter);
app.use('/api/licencas', licencaRouter);
app.use('/api/auditoria', auditoriaRouter);
app.use('/api/feedback', feedbackRouter);

// Módulo GestorFarma
app.use('/api/farmacia', farmaciaRouter);

// Módulo Xonguile App
app.use('/api/xonguile', xonguileRouter);

// Módulo CaféPoint
app.use('/api/cafepoint', cafepointRouter);

// Módulo Smart Warehouse WMS
app.use('/api/armazem', armazemRouter);

// Módulo GYMAR / HefelGym (ginásios)
app.use('/api/gym', gymRouter);

// Módulo DDGEI (equipamentos)
app.use('/api/ddgei', ddgeiRouter);

// Módulo CredHubMZ (microcrédito)
app.use('/api/credhub', credhubRouter);

// Módulo AdegaHub (bottle stores)
app.use('/api/adegahub', adegahubRouter);

// Módulo MachambaPro (agricultura)
app.use('/api/machamba', machambaRouter);

// Módulo SmartschoolMZ (escola)
app.use('/api/smartschool', smartschoolRouter);

// Módulo BrokerHubMZ (corretoras)
app.use('/api/brokerhub', brokerhubRouter);

// Módulo EntregasMOZ (delivery)
app.use('/api/entregas', entregasRouter);

// Módulo StatsE (análise de processos eleitorais)
app.use('/api/statse', statseRouter);

app.get('/health', (req, res) => res.json({ status: 'ok', sistema: 'TECNOINCUBADORA AI' }));

// Landing: serve o HTML embutido (funciona no Vercel, onde a pasta
// public/ não é acessível por caminho no bundle da função).
// Qualquer GET que não seja API devolve a interface de teste.
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.type('html').send(LANDING_HTML);
});

export default app;
