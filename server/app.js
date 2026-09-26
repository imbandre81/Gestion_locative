// Serveur HTTP : API REST, authentification administratrice, liens de partage en lecture seule.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const Calc = require('../public/calc');
const DB = require('./db');
const { createModel, ValidationError } = require('./model');
const X = require('./exports');

function createApp({ dataDir = path.join(__dirname, '..', 'data'), adminPassword = process.env.ADMIN_PASSWORD } = {}) {
  const db = DB.open(dataDir);
  const model = createModel(db);
  const secret = DB.sessionSecret(db);
  const uploadDir = path.join(dataDir, 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' });
    next();
  });

  // ---------- Temps réel (Server-Sent Events) ----------
  const clients = new Set();
  const broadcast = () => { for (const res of clients) res.write('event: change\ndata: {}\n\n'); };
  const sse = (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    res.write('retry: 5000\n\n');
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
  };

  // ---------- Authentification ----------
  const SESSION_DAYS = 30;
  const sign = (v) => crypto.createHmac('sha256', secret).update(v).digest('hex');
  const cookieOf = (req, name) => {
    const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
    return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
  };
  const isAuthed = (req) => {
    const v = cookieOf(req, 'sid');
    if (!v) return false;
    const [exp, sig] = v.split('.');
    if (!exp || !sig || Number(exp) < Date.now()) return false;
    const expected = sign(exp);
    return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  };
  const hashPassword = (pw, salt = crypto.randomBytes(16).toString('hex')) => `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
  const checkPassword = (pw) => {
    const stored = DB.getSetting(db, 'admin_password');
    if (stored) {
      const [salt, hash] = stored.split(':');
      const got = crypto.scryptSync(String(pw), salt, 32).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(hash));
    }
    const ref = adminPassword || 'isabelle';
    const a = crypto.createHash('sha256').update(String(pw)).digest();
    const b = crypto.createHash('sha256').update(ref).digest();
    return crypto.timingSafeEqual(a, b);
  };
  const secureCookie = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  let failures = 0;

  app.post('/api/login', async (req, res) => {
    if (failures > 5) await new Promise((r) => setTimeout(r, Math.min(failures, 20) * 500));
    if (!checkPassword(req.body && req.body.password)) {
      failures++;
      return res.status(401).json({ error: 'Mot de passe incorrect.' });
    }
    failures = 0;
    const exp = String(Date.now() + SESSION_DAYS * 86400000);
    res.set('Set-Cookie', `sid=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secureCookie}`);
    res.json({ ok: true });
  });
  app.post('/api/logout', (req, res) => {
    res.set('Set-Cookie', `sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie}`);
    res.json({ ok: true });
  });
  app.get('/api/me', (req, res) => res.json({ authenticated: isAuthed(req), defaultPassword: !DB.getSetting(db, 'admin_password') && !adminPassword }));

  // ---------- Accès public en lecture seule (liens de partage) ----------
  const shareOf = (token) => db.prepare('SELECT * FROM partages WHERE token = ? AND revoque = 0').get(String(token || ''));
  const pub = express.Router();
  pub.use('/:token', (req, res, next) => {
    const share = shareOf(req.params.token);
    if (!share) return res.status(404).json({ error: 'Lien de partage invalide ou révoqué.' });
    req.share = share;
    next();
  });
  const menageSince = () => Calc.addDays(Calc.todayISO(), -7);
  pub.get('/:token', (req, res) => {
    const s = req.share;
    const apt = s.appartement_id ? model.appartement(s.appartement_id) : null;
    const base = { role: s.role, libelle: s.libelle, appartement: apt ? apt.nom : 'Les deux appartements', misAJour: new Date().toISOString() };
    if (s.role === 'menage') return res.json({ ...base, lignes: model.menage({ appartement: s.appartement_id, depuis: menageSince() }) });
    const annee = Number(req.query.annee) || new Date().getFullYear();
    const c = model.comptabilite(annee);
    return res.json({ ...base, annee, totaux: c.totaux, total: c.total, lignes: c.lignes.map(({ appartement_id, taxe_sejour, ...l }) => l) });
  });
  pub.get('/:token/events', (req, res) => sse(req, res));
  pub.get('/:token/menage.pdf', async (req, res) => {
    if (req.share.role !== 'menage') return res.status(403).end();
    const rows = model.menage({ appartement: req.share.appartement_id, depuis: menageSince() });
    sendFile(res, await X.menagePdf(rows, `Mis à jour le ${Calc.formatDate(Calc.todayISO())}`), 'planning-menage.pdf', 'application/pdf');
  });
  pub.get('/:token/comptable.xlsx', async (req, res) => {
    if (req.share.role !== 'comptable') return res.status(403).end();
    const annee = Number(req.query.annee) || new Date().getFullYear();
    sendFile(res, await X.comptableXlsx(model.comptabilite(annee)), `recettes-${annee}.xlsx`, XLSX);
  });
  app.use('/api/public', pub);

  // ---------- Tout le reste de l'API exige la session administratrice ----------
  app.use('/api', (req, res, next) => (isAuthed(req) ? next() : res.status(401).json({ error: 'Non authentifié.' })));

  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  function sendFile(res, buf, name, type) {
    res.set({ 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name}"` });
    res.send(buf);
  }
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const mutate = (fn) => wrap(async (req, res) => { const out = await fn(req, res); broadcast(); res.json(out); });

  app.get('/api/events', sse);

  app.get('/api/appartements', (req, res) => res.json(model.appartements()));
  app.put('/api/appartements/:id', mutate((req) => model.updateAppartement(Number(req.params.id), req.body)));

  app.get('/api/reservations', (req, res) => res.json(model.reservations(req.query)));
  app.get('/api/reservations/:id', (req, res) => {
    const r = model.reservation(Number(req.params.id));
    return r ? res.json(r) : res.status(404).json({ error: 'Réservation introuvable.' });
  });
  app.post('/api/reservations', mutate((req) => model.createReservation(req.body)));
  app.put('/api/reservations/:id', mutate((req) => model.updateReservation(Number(req.params.id), req.body)));
  app.delete('/api/reservations/:id', mutate((req) => {
    const docs = db.prepare('SELECT filename FROM documents WHERE reservation_id = ?').all(Number(req.params.id));
    model.deleteReservation(Number(req.params.id));
    for (const d of docs) fs.rm(path.join(uploadDir, d.filename), { force: true }, () => {});
    return { ok: true };
  }));

  app.get('/api/dashboard', (req, res) => res.json(model.dashboard(req.query.annee)));
  app.get('/api/menage', (req, res) => res.json(model.menage({ appartement: req.query.appartement, depuis: req.query.tout ? null : menageSince() })));
  app.get('/api/comptabilite', (req, res) => res.json(model.comptabilite(Number(req.query.annee) || new Date().getFullYear())));

  // ---------- Documents joints ----------
  const DOC_TYPES = ['cni', 'contrat_signe', 'contrat_envoye', 'rib_envoye', 'autre'];
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '')),
    }),
    limits: { fileSize: 15 * 1024 * 1024 },
  });
  app.post('/api/reservations/:id/documents', upload.single('fichier'), mutate((req) => {
    const id = Number(req.params.id);
    if (!req.file) throw new ValidationError('Aucun fichier reçu.');
    if (!model.reservation(id)) { fs.rmSync(req.file.path, { force: true }); throw new ValidationError('Réservation introuvable.', 404); }
    const type = DOC_TYPES.includes(req.body.type) ? req.body.type : 'autre';
    const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    db.prepare('INSERT INTO documents (reservation_id, type, filename, original_name, mime, size) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, type, req.file.filename, name, req.file.mimetype, req.file.size);
    return model.reservation(id).documents;
  }));
  app.get('/api/documents/:id', (req, res) => {
    const d = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(req.params.id));
    if (!d) return res.status(404).end();
    const inline = /^(image\/|application\/pdf)/.test(d.mime || '');
    res.set('Content-Type', d.mime || 'application/octet-stream');
    res.set('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(d.original_name)}`);
    res.sendFile(path.join(uploadDir, d.filename));
  });
  app.delete('/api/documents/:id', mutate((req) => {
    const d = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(req.params.id));
    if (!d) throw new ValidationError('Document introuvable.', 404);
    db.prepare('DELETE FROM documents WHERE id = ?').run(d.id);
    fs.rmSync(path.join(uploadDir, d.filename), { force: true });
    return { ok: true };
  }));

  // ---------- Modèles de messages ----------
  const modeleIn = (b) => {
    const titre = String(b.titre || '').trim();
    const corps = String(b.corps || '');
    if (!titre || !corps.trim()) throw new ValidationError('Titre et texte obligatoires.');
    const apt = b.appartement_id ? Number(b.appartement_id) : null;
    return [titre, apt, String(b.categorie || 'autre'), corps];
  };
  app.get('/api/modeles', (req, res) => res.json(db.prepare('SELECT * FROM modeles ORDER BY ordre, id').all()));
  app.post('/api/modeles', mutate((req) => {
    const ordre = db.prepare('SELECT COALESCE(MAX(ordre), 0) + 1 AS o FROM modeles').get().o;
    const r = db.prepare('INSERT INTO modeles (titre, appartement_id, categorie, corps, ordre) VALUES (?, ?, ?, ?, ?)').run(...modeleIn(req.body), ordre);
    return db.prepare('SELECT * FROM modeles WHERE id = ?').get(Number(r.lastInsertRowid));
  }));
  app.put('/api/modeles/:id', mutate((req) => {
    db.prepare('UPDATE modeles SET titre = ?, appartement_id = ?, categorie = ?, corps = ? WHERE id = ?').run(...modeleIn(req.body), Number(req.params.id));
    return db.prepare('SELECT * FROM modeles WHERE id = ?').get(Number(req.params.id));
  }));
  app.delete('/api/modeles/:id', mutate((req) => { db.prepare('DELETE FROM modeles WHERE id = ?').run(Number(req.params.id)); return { ok: true }; }));

  // ---------- Contrat de location ----------
  const contratText = (r) => {
    const apt = model.appartement(r.appartement_id);
    const pre = DB.getSetting(db, 'contrat')
      .replace(/\{declaloc\}/g, apt.declaloc || '—')
      .replace(/\{nb_adultes\}/g, String(r.nb_adultes))
      .replace(/\{nb_enfants\}/g, String(r.nb_enfants))
      .replace(/\{menage\}/g, r.menage_inclus ? 'inclus' : 'non inclus')
      .replace(/\{date_du_jour\}/g, Calc.formatDate(Calc.todayISO()));
    return Calc.fillTemplate(pre, r, apt);
  };
  app.get('/api/reglages/contrat', (req, res) => res.json({ texte: DB.getSetting(db, 'contrat') }));
  app.put('/api/reglages/contrat', (req, res) => {
    const texte = String((req.body && req.body.texte) || '');
    if (!texte.trim()) return res.status(400).json({ error: 'Le modèle de contrat ne peut pas être vide.' });
    DB.setSetting(db, 'contrat', texte);
    res.json({ texte });
  });
  app.get('/api/reservations/:id/contrat', (req, res) => {
    const r = model.reservation(Number(req.params.id));
    return r ? res.json({ texte: contratText(r) }) : res.status(404).end();
  });
  app.get('/api/reservations/:id/contrat.pdf', wrap(async (req, res) => {
    const r = model.reservation(Number(req.params.id));
    if (!r) return res.status(404).end();
    const slug = r.nom_locataire.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    sendFile(res, await X.contratPdf(contratText(r), `Contrat ${r.nom_locataire}`), `contrat-${slug}-S${r.semaine}-${r.annee}.pdf`, 'application/pdf');
  }));

  app.put('/api/reglages/mot-de-passe', (req, res) => {
    const { actuel, nouveau } = req.body || {};
    if (!checkPassword(actuel)) return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
    if (!nouveau || String(nouveau).length < 8) return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères.' });
    DB.setSetting(db, 'admin_password', hashPassword(String(nouveau)));
    res.json({ ok: true });
  });

  // ---------- Liens de partage ----------
  app.get('/api/partages', (req, res) => res.json(db.prepare('SELECT * FROM partages WHERE revoque = 0 ORDER BY created_at DESC').all()));
  app.post('/api/partages', (req, res) => {
    const role = req.body.role === 'comptable' ? 'comptable' : 'menage';
    const apt = req.body.appartement_id ? Number(req.body.appartement_id) : null;
    const token = crypto.randomBytes(18).toString('base64url');
    const libelle = String(req.body.libelle || (role === 'menage' ? 'Ménage' : 'Comptable')).slice(0, 80);
    db.prepare('INSERT INTO partages (token, role, appartement_id, libelle) VALUES (?, ?, ?, ?)').run(token, role, apt, libelle);
    res.json(db.prepare('SELECT * FROM partages WHERE token = ?').get(token));
  });
  app.delete('/api/partages/:id', (req, res) => {
    db.prepare('UPDATE partages SET revoque = 1 WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------- Exports ----------
  const filterLabel = (q) => {
    const parts = [];
    if (q.appartement) { const a = model.appartement(Number(q.appartement)); if (a) parts.push(a.nom); }
    if (q.annee) parts.push(`Année ${q.annee}`);
    if (q.statut) parts.push(q.statut === 'complet' ? 'Dossiers complets' : 'Dossiers incomplets');
    if (q.q) parts.push(`Recherche « ${q.q} »`);
    return `${parts.join(' · ') || 'Toutes les réservations'} — édité le ${Calc.formatDate(Calc.todayISO())}`;
  };
  app.get('/api/export/reservations.xlsx', wrap(async (req, res) => sendFile(res, await X.reservationsXlsx(model.reservations(req.query)), 'reservations.xlsx', XLSX)));
  app.get('/api/export/reservations.pdf', wrap(async (req, res) => sendFile(res, await X.reservationsPdf(model.reservations(req.query), filterLabel(req.query)), 'reservations.pdf', 'application/pdf')));
  app.get('/api/export/menage.pdf', wrap(async (req, res) => {
    const rows = model.menage({ appartement: req.query.appartement, depuis: req.query.tout ? null : menageSince() });
    sendFile(res, await X.menagePdf(rows, `Mis à jour le ${Calc.formatDate(Calc.todayISO())}`), 'planning-menage.pdf', 'application/pdf');
  }));
  app.get('/api/export/comptable.xlsx', wrap(async (req, res) => {
    const annee = Number(req.query.annee) || new Date().getFullYear();
    sendFile(res, await X.comptableXlsx(model.comptabilite(annee)), `recettes-${annee}.xlsx`, XLSX);
  }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Ressource inconnue.' }));

  // ---------- Fichiers statiques ----------
  const pub_dir = path.join(__dirname, '..', 'public');
  app.get('/partage/:token', (req, res) => res.sendFile(path.join(pub_dir, 'partage.html')));
  app.use(express.static(pub_dir, { index: 'index.html' }));

  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    const status = err.status || (err instanceof multer.MulterError ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Erreur interne du serveur.' : err.message });
  });

  return { app, db, model };
}

module.exports = { createApp };
