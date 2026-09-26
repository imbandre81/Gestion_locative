const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/calc');

const giettaz = { nom: 'La Giettaz', caution: 500, taux_communal: 5, plafond_communal: 2.3, taux_departemental: 10 };

test('nuits et numéro de semaine ISO', () => {
  assert.equal(C.nights('2026-02-07', '2026-02-14'), 7);
  assert.equal(C.isoWeek('2026-02-07'), 6);
  assert.equal(C.isoWeek('2027-01-02'), 53); // samedi 2 janvier 2027 = semaine 53 de 2026
});

test('acompte 30 % et solde arrondis au centime', () => {
  assert.deepEqual(C.payments(1234.55), { acompte: 370.37, solde: 864.18 });
  assert.deepEqual(C.payments(''), { acompte: 0, solde: 0 });
});

test('taxe de séjour : mineurs exonérés + taxe départementale', () => {
  // 1200 € / 7 nuits / 4 pers = 42,857 € ; × 5 % = 2,1428 € ; × 7 × 2 adultes = 30 € ; + 10 % = 33 €
  const t = C.touristTax({ date_arrivee: '2026-02-07', date_depart: '2026-02-14', nb_adultes: 2, nb_enfants: 2, montant_sejour: 1200 }, giettaz);
  assert.equal(t.plafonne, false);
  assert.equal(t.base, 30);
  assert.equal(t.additionnelle, 3);
  assert.equal(t.total, 33);
});

test('taxe de séjour plafonnée', () => {
  // 3000 € / 7 / 2 = 214,29 € ; × 5 % = 10,71 € → plafond 2,30 € ; × 7 × 2 = 32,20 € ; + 10 % = 35,42 €
  const t = C.touristTax({ date_arrivee: '2026-02-07', date_depart: '2026-02-14', nb_adultes: 2, nb_enfants: 0, montant_sejour: 3000 }, giettaz);
  assert.equal(t.plafonne, true);
  assert.equal(t.total, 35.42);
});

test('statuts du dossier', () => {
  const base = { date_arrivee: '2026-12-19', date_depart: '2026-12-26', montant_sejour: 1000 };
  assert.equal(C.status(base, '2026-09-01').code, 'incomplet');
  const pieces = { ...base, cni_recue: 1, contrat_signe: 1, acompte_paye: 1 };
  assert.equal(C.status(pieces, '2026-09-01').code, 'attente');
  assert.equal(C.status(pieces, '2026-11-25').code, 'probleme'); // J-30 dépassé, solde non payé
  assert.equal(C.status({ ...pieces, solde_paye: 1, caution_recue: 1 }, '2026-11-25').code, 'complet');
});

test('alertes automatiques', () => {
  const r = { date_arrivee: '2026-12-19', date_depart: '2026-12-26', montant_sejour: 1000, cni_recue: 1, contrat_signe: 1, acompte_paye: 1 };
  const types = C.alerts(r, giettaz, '2026-11-25').map((a) => a.type);
  assert.deepEqual(types, ['solde', 'caution']);
  assert.match(C.alerts(r, giettaz, '2026-11-25')[1].detail, /500,00 €/);
  const fini = { ...r, solde_paye: 1, caution_recue: 1 };
  assert.deepEqual(C.alerts(fini, giettaz, '2027-01-02').map((a) => a.type), ['caution_rendre']);
});

test('remplissage des modèles de message', () => {
  const r = { nom_locataire: 'Martin Dupont', date_arrivee: '2026-12-19', date_depart: '2026-12-26', montant_sejour: 1000, nb_adultes: 2, nb_enfants: 0 };
  const out = C.fillTemplate('Bonjour {prenom_locataire}, du {date_arrivee} au {date_depart} : {montant_acompte} puis {montant_solde}, caution {montant_caution} 🎉 {inconnue}', r, giettaz);
  assert.equal(out, 'Bonjour Martin, du 19/12/2026 au 26/12/2026 : 300,00 € puis 700,00 €, caution 500,00 € 🎉 {inconnue}');
});
