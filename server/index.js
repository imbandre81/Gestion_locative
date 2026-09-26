// Point d'entrée : node server/index.js  (PORT, ADMIN_PASSWORD, DATA_DIR, COOKIE_SECURE)
const path = require('path');
const { createApp } = require('./app');

const port = Number(process.env.PORT) || 3000;
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const { app } = createApp({ dataDir });

if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠️  ADMIN_PASSWORD non défini : mot de passe provisoire « isabelle » (à changer dans Réglages).');
}
app.listen(port, () => console.log(`Gestion locative démarrée sur http://localhost:${port}`));
