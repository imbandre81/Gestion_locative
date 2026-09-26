/*
 * Calculs métier partagés entre le serveur (Node) et le navigateur.
 * Aucune dépendance : dates au format ISO « AAAA-MM-JJ », montants en euros.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DAY = 86400000;

  function parseDate(iso) {
    if (!iso) return null;
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d));
  }

  function toISO(date) {
    return date.toISOString().slice(0, 10);
  }

  function todayISO() {
    const now = new Date();
    return toISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  }

  function addDays(iso, n) {
    const d = parseDate(iso);
    return d ? toISO(new Date(d.getTime() + n * DAY)) : null;
  }

  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  /** Nombre de nuits entre l'arrivée et le départ. */
  function nights(arrivee, depart) {
    const a = parseDate(arrivee);
    const b = parseDate(depart);
    if (!a || !b) return 0;
    return Math.max(0, Math.round((b - a) / DAY));
  }

  /** Numéro de semaine ISO 8601 de la date d'arrivée. */
  function isoWeek(iso) {
    const d = parseDate(iso);
    if (!d) return null;
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / DAY + 1) / 7);
  }

  /** Acompte 30 % et solde 70 % du montant du séjour. */
  function payments(montant) {
    // Calcul en centimes entiers pour éviter les erreurs d'arrondi flottant (370,365 → 370,37).
    const cents = Math.round((Number(montant) || 0) * 100);
    const acompteCents = Math.round((cents * 30) / 100);
    return { acompte: acompteCents / 100, solde: (cents - acompteCents) / 100 };
  }

  /**
   * Taxe de séjour au réel pour un meublé de tourisme non classé.
   * appart : { taux_communal (%), plafond_communal (€/pers./nuit), taux_departemental (%) }
   */
  function touristTax(resa, appart) {
    const n = nights(resa.date_arrivee, resa.date_depart);
    const adultes = Math.max(0, Number(resa.nb_adultes) || 0);
    const enfants = Math.max(0, Number(resa.nb_enfants) || 0);
    const occupants = adultes + enfants;
    const montant = Number(resa.montant_sejour) || 0;
    const empty = { prixNuiteeParPersonne: 0, taxeParNuitParPersonne: 0, base: 0, additionnelle: 0, total: 0, plafonne: false };
    if (!appart || !n || !occupants || !montant) return empty;

    const prix = montant / n / occupants;
    const brut = prix * (Number(appart.taux_communal) || 0) / 100;
    const plafond = Number(appart.plafond_communal);
    const plafonne = plafond > 0 && brut > plafond;
    const parNuit = plafonne ? plafond : brut;
    const base = parNuit * n * adultes;
    const additionnelle = base * (Number(appart.taux_departemental) || 0) / 100;
    return {
      prixNuiteeParPersonne: round2(prix),
      taxeParNuitParPersonne: round2(parNuit),
      base: round2(base),
      additionnelle: round2(additionnelle),
      total: round2(base + additionnelle),
      plafonne,
    };
  }

  const truthy = (v) => v === true || v === 1 || v === '1';

  /**
   * Statut global du dossier.
   * code : complet (vert) | incomplet (orange) | attente (orange) | probleme (rouge)
   */
  function status(resa, today) {
    today = today || todayISO();
    const piecesOk = truthy(resa.cni_recue) && truthy(resa.contrat_signe) && truthy(resa.acompte_paye);
    const soldeOk = truthy(resa.solde_paye);
    const cautionOk = truthy(resa.caution_recue);
    const echeanceSolde = addDays(resa.date_arrivee, -30);
    const soldeEnRetard = !soldeOk && echeanceSolde && today > echeanceSolde;
    const arrivePassee = resa.date_arrivee && today >= resa.date_arrivee;

    if (piecesOk && soldeOk && cautionOk) return { code: 'complet', label: 'Dossier complet', color: 'green', piecesOk, soldeEnRetard: false };
    if (soldeEnRetard || (!piecesOk && arrivePassee)) {
      return { code: 'probleme', label: soldeEnRetard ? 'Solde en retard' : 'Pièces manquantes', color: 'red', piecesOk, soldeEnRetard: !!soldeEnRetard };
    }
    if (!piecesOk) return { code: 'incomplet', label: 'Dossier incomplet', color: 'orange', piecesOk, soldeEnRetard: false };
    return { code: 'attente', label: 'En attente solde/caution', color: 'orange', piecesOk, soldeEnRetard: false };
  }

  /** Alertes automatiques d'une réservation (tableau vide si rien à signaler). */
  function alerts(resa, appart, today) {
    today = today || todayISO();
    const out = [];
    const termine = resa.date_depart && today > resa.date_depart;
    const echeanceSolde = addDays(resa.date_arrivee, -30);
    const { solde } = payments(resa.montant_sejour);
    const caution = appart ? Number(appart.caution) : 0;

    if (!termine) {
      const manquantes = [];
      if (!truthy(resa.cni_recue)) manquantes.push('CNI');
      if (!truthy(resa.contrat_signe)) manquantes.push('contrat signé');
      if (!truthy(resa.acompte_paye)) manquantes.push('acompte');
      if (manquantes.length) {
        const urgent = echeanceSolde && today >= echeanceSolde;
        out.push({
          type: 'incomplet',
          level: urgent ? 'danger' : 'warning',
          label: 'Dossier incomplet' + (urgent ? ' à moins de 30 jours' : ''),
          detail: 'Manque : ' + manquantes.join(', '),
        });
      }
      if (!truthy(resa.solde_paye) && echeanceSolde && today > echeanceSolde) {
        out.push({ type: 'solde', level: 'danger', label: 'Solde à réclamer', detail: formatEuro(solde) + ' (échéance ' + formatDate(echeanceSolde) + ')' });
      }
      if (!truthy(resa.caution_recue)) {
        out.push({ type: 'caution', level: echeanceSolde && today > echeanceSolde ? 'danger' : 'info', label: 'Caution non reçue', detail: 'Montant attendu : ' + formatEuro(caution) });
      }
    } else if (truthy(resa.caution_recue) && !truthy(resa.caution_rendue) && !truthy(resa.caution_encaissee)) {
      out.push({ type: 'caution_rendre', level: 'info', label: 'Caution à rendre', detail: formatEuro(caution) + ' — séjour terminé le ' + formatDate(resa.date_depart) });
    }
    return out;
  }

  /** Montants encaissés / restant à encaisser (hors caution). */
  function revenue(resa) {
    const { acompte, solde } = payments(resa.montant_sejour);
    const encaisse = round2((truthy(resa.acompte_paye) ? acompte : 0) + (truthy(resa.solde_paye) ? solde : 0));
    return { encaisse, restant: round2((Number(resa.montant_sejour) || 0) - encaisse) };
  }

  function formatEuro(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, ' ') + ' €';
  }

  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  function firstName(resa) {
    if (resa.prenom_locataire) return resa.prenom_locataire.trim();
    return String(resa.nom_locataire || '').trim().split(/\s+/)[0] || '';
  }

  /** Remplace les variables {xxx} d'un modèle par les valeurs de la réservation. */
  function fillTemplate(text, resa, appart) {
    if (!resa) return text;
    const { acompte, solde } = payments(resa.montant_sejour);
    const tax = touristTax(resa, appart);
    const vars = {
      prenom_locataire: firstName(resa),
      nom_locataire: resa.nom_locataire || '',
      date_arrivee: formatDate(resa.date_arrivee),
      date_depart: formatDate(resa.date_depart),
      semaine: String(isoWeek(resa.date_arrivee) || ''),
      nb_nuits: String(nights(resa.date_arrivee, resa.date_depart)),
      nb_personnes: String((Number(resa.nb_adultes) || 0) + (Number(resa.nb_enfants) || 0)),
      montant_sejour: formatEuro(resa.montant_sejour),
      montant_acompte: formatEuro(acompte),
      montant_solde: formatEuro(solde),
      montant_caution: appart ? formatEuro(appart.caution) : '',
      taxe_sejour: formatEuro(tax.total),
      appartement: appart ? appart.nom : '',
      adresse: appart ? appart.adresse || '' : '',
      telephone: resa.telephone || '',
      email: resa.email || '',
    };
    return String(text).replace(/\{([a-z_]+)\}/g, (m, key) => (key in vars ? vars[key] : m));
  }

  const VARIABLES = [
    'prenom_locataire', 'nom_locataire', 'date_arrivee', 'date_depart', 'semaine', 'nb_nuits', 'nb_personnes',
    'montant_sejour', 'montant_acompte', 'montant_solde', 'montant_caution', 'taxe_sejour', 'appartement', 'adresse',
    'telephone', 'email',
  ];

  return {
    parseDate, toISO, todayISO, addDays, round2, nights, isoWeek, payments, touristTax, status, alerts, revenue,
    formatEuro, formatDate, firstName, fillTemplate, VARIABLES, truthy,
  };
});
