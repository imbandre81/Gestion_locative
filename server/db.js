// Base de données relationnelle SQLite (module natif node:sqlite, aucun binaire à compiler).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const seed = require('./seed');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS appartements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL UNIQUE,
  adresse TEXT DEFAULT '',
  caution REAL NOT NULL DEFAULT 0,
  taux_communal REAL NOT NULL DEFAULT 5,
  plafond_communal REAL NOT NULL DEFAULT 2.3,
  taux_departemental REAL NOT NULL DEFAULT 10,
  age_exoneration INTEGER NOT NULL DEFAULT 18,
  couleur TEXT NOT NULL DEFAULT '#2f7d4f',
  declaloc TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appartement_id INTEGER NOT NULL REFERENCES appartements(id) ON DELETE RESTRICT,
  date_arrivee TEXT NOT NULL,
  date_depart TEXT NOT NULL,
  nom_locataire TEXT NOT NULL,
  prenom_locataire TEXT DEFAULT '',
  telephone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  nb_adultes INTEGER NOT NULL DEFAULT 1,
  nb_enfants INTEGER NOT NULL DEFAULT 0,
  montant_sejour REAL NOT NULL DEFAULT 0,
  menage_inclus INTEGER NOT NULL DEFAULT 0,
  cni_recue INTEGER NOT NULL DEFAULT 0,
  cni_date TEXT,
  contrat_signe INTEGER NOT NULL DEFAULT 0,
  contrat_date TEXT,
  acompte_paye INTEGER NOT NULL DEFAULT 0,
  acompte_date TEXT,
  solde_paye INTEGER NOT NULL DEFAULT 0,
  solde_date TEXT,
  caution_recue INTEGER NOT NULL DEFAULT 0,
  caution_recue_date TEXT,
  caution_encaissee INTEGER NOT NULL DEFAULT 0,
  caution_encaissee_date TEXT,
  caution_rendue INTEGER NOT NULL DEFAULT 0,
  caution_rendue_date TEXT,
  infos TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_resa_arrivee ON reservations(date_arrivee);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS modeles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titre TEXT NOT NULL,
  appartement_id INTEGER REFERENCES appartements(id) ON DELETE SET NULL,
  categorie TEXT DEFAULT 'autre',
  corps TEXT NOT NULL,
  ordre INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS partages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('menage', 'comptable')),
  appartement_id INTEGER REFERENCES appartements(id) ON DELETE CASCADE,
  libelle TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoque INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reglages (
  cle TEXT PRIMARY KEY,
  valeur TEXT
);
`;

function open(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'gestion.sqlite'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  seedIfEmpty(db);
  return db;
}

function seedIfEmpty(db) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM appartements').get().n;
  if (count > 0) return;
  const insApt = db.prepare(`INSERT INTO appartements (nom, adresse, caution, taux_communal, plafond_communal, taux_departemental, age_exoneration, couleur)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const ids = {};
  for (const a of seed.APPARTEMENTS) {
    const r = insApt.run(a.nom, a.adresse, a.caution, a.taux_communal, a.plafond_communal, a.taux_departemental, a.age_exoneration, a.couleur);
    ids[a.nom] = Number(r.lastInsertRowid);
  }
  const insMod = db.prepare('INSERT INTO modeles (titre, appartement_id, categorie, corps, ordre) VALUES (?, ?, ?, ?, ?)');
  seed.MODELES.forEach((m, i) => insMod.run(m.titre, m.appartement ? ids[m.appartement] : null, m.categorie, m.corps, i));
  setSetting(db, 'contrat', seed.CONTRAT);
}

function getSetting(db, key) {
  const row = db.prepare('SELECT valeur FROM reglages WHERE cle = ?').get(key);
  return row ? row.valeur : null;
}

function setSetting(db, key, value) {
  db.prepare('INSERT INTO reglages (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur').run(key, value);
}

/** Secret de signature des sessions, généré une fois et conservé en base. */
function sessionSecret(db) {
  let s = process.env.SESSION_SECRET || getSetting(db, 'session_secret');
  if (!s) {
    s = crypto.randomBytes(32).toString('hex');
    setSetting(db, 'session_secret', s);
  }
  return s;
}

module.exports = { open, getSetting, setSetting, sessionSecret };
