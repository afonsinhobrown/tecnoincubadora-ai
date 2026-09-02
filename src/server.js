import 'dotenv/config';
import app from './app.js';

// Entrada local: `npm start`
app.listen(process.env.PORT || 3000, () =>
  console.log('TECNOINCUBADORA AI a correr')
);
