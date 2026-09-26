// Accès aux données + enrichissement des réservations avec les champs calculés.
const Calc = require('../public/calc');

const BOOL_FIELDS = ['menage_inclus', 'cni_recue', 'contrat_signe', 'acompte_paye', 'solde_paye', 'caution_recue', 'caution_encaissee', 'caution_rendue'];
const DATE_FIELDS = ['cni_date', 'contrat_date', 'acompte_date', 'solde_date', 'caution_recue_date', 'caution_encaissee_date', 'caution_rendue_date'];
const TEXT_FIELDS = ['nom_locataire', 'prenom_locataire', 'adresse_locataire', 'telephone', 'email', 'infos'];
const RESA_FIELDS = ['appartement_id', 'date_arrivee', 'date_depart', 'nb_adultes', 'nb_enfants', 'montant_sejour', ...TEXT_FIELDS, ...BOOL_FIELDS, ...DATE_FIELDS];

const APT_FIELDS = ['nom', 'adresse', 'caution', 'taux_communal', 'plafond_communal', 'taux_departemental', 'age_exoneration', 'couleur', 'declaloc', 'capacite', 'heure_arrivee', 'heure_depart', 'contrat'];

class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && Calc.parseDate(v);

function createModel(db) {
  const appartements = () => db.prepare('SELECT * FROM appartements ORDER BY id').all();
  const appartement = (id) => db.prepare('SELECT * FROM appartements WHERE id = ?').get(id);
  const aptMap = () => Object.fromEntries(appartements().map((a) => [a.id, a]));

  function enrich(r, apt, today) {
    const pay = Calc.payments(r.montant_sejour);
    const tax = Calc.touristTax(r, apt);
    const st = Calc.status(r, today);
    const rev = Calc.revenue(r);
    const out = { ...r };
    for (const f of BOOL_FIELDS) out[f] = !!r[f];
    return Object.assign(out, {
      appartement_nom: apt ? apt.nom : '',
      appartement_couleur: apt ? apt.couleur : '#888',
      caution_montant: apt ? apt.caution : 0,
      annee: Number(String(r.date_arrivee).slice(0, 4)),
      semaine: Calc.isoWeek(r.date_arrivee),
      nuits: Calc.nights(r.date_arrivee, r.date_depart),
      nb_personnes: (Number(r.nb_adultes) || 0) + (Number(r.nb_enfants) || 0),
      montant_acompte: pay.acompte,
      montant_solde: pay.solde,
      taxe: tax,
      taxe_sejour: tax.total,
      statut: st,
      alertes: Calc.alerts(r, apt, today),
      encaisse: rev.encaisse,
      restant: rev.restant,
    });
  }

  /** Liste enrichie et filtrée des réservations. */
  function reservations(filters = {}) {
    const apts = aptMap();
    const today = filters.today || Calc.todayISO();
    let rows = db.prepare('SELECT * FROM reservations ORDER BY date_arrivee, appartement_id').all()
      .map((r) => enrich(r, apts[r.appartement_id], today));
    if (filters.appartement) rows = rows.filter((r) => String(r.appartement_id) === String(filters.appartement));
    if (filters.annee) rows = rows.filter((r) => String(r.annee) === String(filters.annee));
    if (filters.statut === 'complet') rows = rows.filter((r) => r.statut.code === 'complet');
    else if (filters.statut === 'incomplet') rows = rows.filter((r) => r.statut.code !== 'complet');
    else if (filters.statut) rows = rows.filter((r) => r.statut.code === filters.statut);
    if (filters.q) {
      const q = String(filters.q).toLowerCase().trim();
      const qDigits = q.replace(/\D/g, '');
      rows = rows.filter((r) =>
        `${r.nom_locataire} ${r.prenom_locataire} ${r.email}`.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && String(r.telephone).replace(/\D/g, '').includes(qDigits)) ||
        String(r.semaine) === q.replace(/^s(em(aine)?)?\s*/, '') ||
        Calc.formatDate(r.date_arrivee).includes(q));
    }
    return rows;
  }

  function reservation(id) {
    const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
    if (!r) return null;
    const out = enrich(r, appartement(r.appartement_id));
    out.documents = db.prepare('SELECT id, type, original_name, mime, size, created_at FROM documents WHERE reservation_id = ? ORDER BY created_at').all(id);
    return out;
  }

  function normalize(input, existing = {}) {
    const d = { ...existing };
    for (const f of RESA_FIELDS) if (f in input) d[f] = input[f];
    for (const f of TEXT_FIELDS) d[f] = String(d[f] ?? '').trim();
    for (const f of BOOL_FIELDS) d[f] = Calc.truthy(d[f]) || d[f] === 'true' ? 1 : 0;
    for (const f of DATE_FIELDS) d[f] = isDate(d[f]) ? d[f] : null;
    d.nb_adultes = Math.max(0, parseInt(d.nb_adultes, 10) || 0);
    d.nb_enfants = Math.max(0, parseInt(d.nb_enfants, 10) || 0);
    d.montant_sejour = Calc.round2(Math.max(0, Number(String(d.montant_sejour ?? 0).replace(',', '.')) || 0));
    d.appartement_id = parseInt(d.appartement_id, 10);

    // Une case cochée sans date prend la date du jour ; décochée, la date est effacée.
    const pairs = [['cni_recue', 'cni_date'], ['contrat_signe', 'contrat_date'], ['acompte_paye', 'acompte_date'], ['solde_paye', 'solde_date'],
      ['caution_recue', 'caution_recue_date'], ['caution_encaissee', 'caution_encaissee_date'], ['caution_rendue', 'caution_rendue_date']];
    for (const [flag, date] of pairs) {
      if (d[flag] && !d[date]) d[date] = Calc.todayISO();
      if (!d[flag]) d[date] = null;
    }

    if (!appartement(d.appartement_id)) throw new ValidationError('Appartement inconnu.');
    if (!isDate(d.date_arrivee) || !isDate(d.date_depart)) throw new ValidationError("Dates d'arrivée et de départ obligatoires.");
    if (d.date_depart <= d.date_arrivee) throw new ValidationError("La date de départ doit être postérieure à la date d'arrivée.");
    if (!d.nom_locataire) throw new ValidationError('Le nom du locataire est obligatoire.');
    if (d.nb_adultes + d.nb_enfants < 1) throw new ValidationError('Il faut au moins une personne.');
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw new ValidationError('Adresse e-mail invalide.');
    return d;
  }

  function checkOverlap(d, ignoreId) {
    const clash = db.prepare(`SELECT id, nom_locataire, date_arrivee, date_depart FROM reservations
      WHERE appartement_id = ? AND id != ? AND date_arrivee < ? AND date_depart > ?`)
      .get(d.appartement_id, ignoreId || 0, d.date_depart, d.date_arrivee);
    if (clash) {
      throw new ValidationError(`Chevauchement avec la réservation de ${clash.nom_locataire} (${Calc.formatDate(clash.date_arrivee)} → ${Calc.formatDate(clash.date_depart)}).`, 409);
    }
  }

  function createReservation(input) {
    const d = normalize(input);
    checkOverlap(d);
    const cols = RESA_FIELDS;
    const r = db.prepare(`INSERT INTO reservations (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...cols.map((c) => d[c]));
    return reservation(Number(r.lastInsertRowid));
  }

  function updateReservation(id, input) {
    const existing = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
    if (!existing) throw new ValidationError('Réservation introuvable.', 404);
    const d = normalize(input, existing);
    checkOverlap(d, id);
    db.prepare(`UPDATE reservations SET ${RESA_FIELDS.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .run(...RESA_FIELDS.map((c) => d[c]), id);
    return reservation(id);
  }

  function updateAppartement(id, input) {
    const a = appartement(id);
    if (!a) throw new ValidationError('Appartement introuvable.', 404);
    const d = { ...a };
    for (const f of APT_FIELDS) if (f in input) d[f] = input[f];
    for (const f of ['caution', 'taux_communal', 'plafond_communal', 'taux_departemental']) d[f] = Math.max(0, Number(String(d[f]).replace(',', '.')) || 0);
    d.age_exoneration = parseInt(d.age_exoneration, 10) || 18;
    d.capacite = Math.max(1, parseInt(d.capacite, 10) || 8);
    for (const f of ['adresse', 'declaloc', 'heure_arrivee', 'heure_depart']) d[f] = String(d[f] ?? '').trim();
    if (!String(d.contrat || '').trim()) throw new ValidationError('Le modèle de contrat ne peut pas être vide.');
    d.nom = String(d.nom || '').trim();
    if (!d.nom) throw new ValidationError('Le nom est obligatoire.');
    if (!/^#[0-9a-f]{6}$/i.test(d.couleur)) throw new ValidationError('Couleur invalide.');
    if (d.taux_communal > 5 || d.taux_communal < 0) throw new ValidationError('Le taux communal doit être compris entre 0 et 5 %.');
    db.prepare(`UPDATE appartements SET ${APT_FIELDS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...APT_FIELDS.map((c) => d[c] ?? ''), id);
    return appartement(id);
  }

  /**
   * Vue ménage : UNIQUEMENT semaine, nom et téléphone (+ dates/appartement pour s'organiser).
   * Aucun montant, statut ou info diverse ne sort de cette fonction.
   */
  function menage({ appartement: aptId, depuis } = {}) {
    const apts = aptMap();
    const params = [];
    let sql = 'SELECT appartement_id, date_arrivee, date_depart, nom_locataire, prenom_locataire, telephone FROM reservations WHERE 1 = 1';
    if (aptId) { sql += ' AND appartement_id = ?'; params.push(aptId); }
    if (depuis) { sql += ' AND date_depart >= ?'; params.push(depuis); }
    sql += ' ORDER BY date_arrivee';
    return db.prepare(sql).all(...params).map((r) => ({
      semaine: Calc.isoWeek(r.date_arrivee),
      date_arrivee: r.date_arrivee,
      date_depart: r.date_depart,
      appartement: apts[r.appartement_id] ? apts[r.appartement_id].nom : '',
      couleur: apts[r.appartement_id] ? apts[r.appartement_id].couleur : '#888',
      locataire: [r.prenom_locataire, r.nom_locataire].filter(Boolean).join(' '),
      telephone: r.telephone,
    }));
  }

  /**
   * Recettes encaissées par année civile de paiement (utile pour la déclaration micro-entreprise).
   * L'acompte est rattaché à l'année de son encaissement, de même pour le solde.
   */
  function comptabilite(annee) {
    const lignes = [];
    for (const r of reservations()) {
      const add = (flag, date, montant, nature) => {
        if (!r[flag]) return;
        const d = r[date] || r.date_arrivee;
        if (annee && String(d).slice(0, 4) !== String(annee)) return;
        lignes.push({ date: d, appartement: r.appartement_nom, appartement_id: r.appartement_id, locataire: r.nom_locataire, semaine: r.semaine, sejour: `${Calc.formatDate(r.date_arrivee)} → ${Calc.formatDate(r.date_depart)}`, nature, montant, taxe_sejour: nature === 'Solde' ? r.taxe_sejour : 0 });
      };
      add('acompte_paye', 'acompte_date', r.montant_acompte, 'Acompte 30 %');
      add('solde_paye', 'solde_date', r.montant_solde, 'Solde');
    }
    lignes.sort((a, b) => a.date.localeCompare(b.date));
    const totaux = appartements().map((a) => ({
      appartement: a.nom,
      total: Calc.round2(lignes.filter((l) => l.appartement_id === a.id).reduce((s, l) => s + l.montant, 0)),
    }));
    return { annee, lignes, totaux, total: Calc.round2(totaux.reduce((s, t) => s + t.total, 0)) };
  }

  function dashboard(annee) {
    annee = Number(annee) || new Date().getFullYear();
    const today = Calc.todayISO();
    const all = reservations({ today });
    const joursAnnee = (Date.UTC(annee + 1, 0, 1) - Date.UTC(annee, 0, 1)) / 86400000;
    const debut = `${annee}-01-01`;
    const fin = `${annee + 1}-01-01`;

    const kpis = appartements().map((a) => {
      const rs = all.filter((r) => r.appartement_id === a.id && r.annee === annee);
      // Nuits réellement situées dans l'année (un séjour à cheval sur deux années est réparti).
      const nuits = all.filter((r) => r.appartement_id === a.id).reduce((s, r) => {
        const from = r.date_arrivee > debut ? r.date_arrivee : debut;
        const to = r.date_depart < fin ? r.date_depart : fin;
        return s + Math.max(0, Calc.nights(from, to));
      }, 0);
      return {
        appartement_id: a.id, nom: a.nom, couleur: a.couleur,
        semaines: rs.length,
        nuits,
        occupation: Calc.round2((nuits / joursAnnee) * 100),
        chiffre: Calc.round2(rs.reduce((s, r) => s + r.montant_sejour, 0)),
        encaisse: Calc.round2(rs.reduce((s, r) => s + r.encaisse, 0)),
        restant: Calc.round2(rs.reduce((s, r) => s + r.restant, 0)),
        taxe: Calc.round2(rs.reduce((s, r) => s + r.taxe_sejour, 0)),
        complets: rs.filter((r) => r.statut.code === 'complet').length,
      };
    });

    const alertes = [];
    for (const r of all) for (const al of r.alertes) {
      alertes.push({ ...al, reservation_id: r.id, locataire: r.nom_locataire, appartement: r.appartement_nom, couleur: r.appartement_couleur, date_arrivee: r.date_arrivee, date_depart: r.date_depart, semaine: r.semaine });
    }
    const rank = { danger: 0, warning: 1, info: 2 };
    alertes.sort((a, b) => rank[a.level] - rank[b.level] || a.date_arrivee.localeCompare(b.date_arrivee));

    const horizon = Calc.addDays(today, 60);
    const mouvements = [];
    for (const r of all) {
      const base = { reservation_id: r.id, locataire: r.nom_locataire, telephone: r.telephone, appartement: r.appartement_nom, couleur: r.appartement_couleur, statut: r.statut };
      if (r.date_arrivee >= today && r.date_arrivee <= horizon) mouvements.push({ ...base, type: 'arrivee', date: r.date_arrivee });
      if (r.date_depart >= today && r.date_depart <= horizon) mouvements.push({ ...base, type: 'depart', date: r.date_depart });
    }
    mouvements.sort((a, b) => a.date.localeCompare(b.date) || (a.type === 'depart' ? -1 : 1));

    // Comparatif multi-années des revenus par appartement.
    const annees = [...new Set(all.map((r) => r.annee))].sort();
    const comparatif = annees.map((y) => ({
      annee: y,
      parAppartement: appartements().map((a) => {
        const rs = all.filter((r) => r.annee === y && r.appartement_id === a.id);
        return { appartement_id: a.id, nom: a.nom, couleur: a.couleur, semaines: rs.length, chiffre: Calc.round2(rs.reduce((s, r) => s + r.montant_sejour, 0)), encaisse: Calc.round2(rs.reduce((s, r) => s + r.encaisse, 0)) };
      }),
    }));

    return { annee, today, kpis, alertes, mouvements, comparatif, annees };
  }

  return {
    appartements, appartement, updateAppartement, reservations, reservation, createReservation, updateReservation,
    deleteReservation: (id) => db.prepare('DELETE FROM reservations WHERE id = ?').run(id),
    menage, comptabilite, dashboard,
  };
}

module.exports = { createModel, ValidationError };
