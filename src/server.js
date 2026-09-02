import express from 'express';
import 'dotenv/config';
import farmaciaRouter from './modules/farmacia/routes.js';

// TECNOINCUBADORA AI — motor central, um módulo por SaaS
const app = express();
app.use(express.json());

// Módulo GestorFarma
app.use('/api/farmacia', farmaciaRouter);

// Próximos módulos (Gymar, Xonguile, etc) montam-se aqui do mesmo modo:
// app.use('/api/gymar', gymarRouter);
// app.use('/api/xonguile', xonguileRouter);

app.get('/health', (req, res) => res.json({ status: 'ok', sistema: 'TECNOINCUBADORA AI' }));

app.listen(process.env.PORT || 3000, () =>
  console.log('TECNOINCUBADORA AI a correr')
);
