const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server/app');

let server, base, cookie = '';
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gestion-test-'));

async function call(url, { method = 'GET', body, auth = true } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, data: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
}

test.before(async () => {
  const { app } = createApp({ dataDir, adminPassword: 'secret-test' });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('authentification obligatoire', async () => {
  assert.equal((await call('/api/reservations', { auth: false })).status, 401);
  assert.equal((await call('/api/login', { method: 'POST', body: { password: 'faux' } })).status, 401);
  const ok = await call('/api/login', { method: 'POST', body: { password: 'secret-test' } });
  assert.equal(ok.status, 200);
  cookie = ok.headers.get('set-cookie').split(';')[0];
});

test('données initiales : 2 appartements et 7 modèles', async () => {
  const apts = (await call('/api/appartements')).data;
  assert.deepEqual(apts.map((a) => [a.nom, a.caution]), [['La Giettaz', 500], ['Les Deux Alpes', 900]]);
  const modeles = (await call('/api/modeles')).data;
  assert.equal(modeles.length, 7);
  assert.ok(modeles[0].corps.includes('🎉Votre arrivée à La Giettaz approche!'));
});

test('cycle de vie d\'une réservation + vue ménage + partage', async () => {
  const created = await call('/api/reservations', { method: 'POST', body: {
    appartement_id: 2, date_arrivee: '2027-02-13', date_depart: '2027-02-20', nom_locataire: 'Famille Durand', telephone: '06 11 22 33 44',
    nb_adultes: 2, nb_enfants: 1, montant_sejour: 1500, infos: 'Secret : arrive tard', cni_recue: true,
  } });
  assert.equal(created.status, 200);
  const r = created.data;
  assert.equal(r.semaine, 6);
  assert.equal(r.nuits, 7);
  assert.equal(r.nb_personnes, 3);
  assert.equal(r.montant_acompte, 450);
  assert.equal(r.montant_solde, 1050);
  assert.ok(r.cni_date, 'date de réception renseignée automatiquement');
  assert.equal(r.statut.code, 'incomplet');

  const clash = await call('/api/reservations', { method: 'POST', body: { appartement_id: 2, date_arrivee: '2027-02-15', date_depart: '2027-02-22', nom_locataire: 'X', nb_adultes: 1, montant_sejour: 1 } });
  assert.equal(clash.status, 409);
  // Changement de locataires le samedi : pas de chevauchement.
  assert.equal((await call('/api/reservations', { method: 'POST', body: { appartement_id: 2, date_arrivee: '2027-02-20', date_depart: '2027-02-27', nom_locataire: 'Suivant', nb_adultes: 1, montant_sejour: 900 } })).status, 200);

  const upd = await call(`/api/reservations/${r.id}`, { method: 'PUT', body: { contrat_signe: true, acompte_paye: true } });
  assert.equal(upd.data.statut.code, 'attente');

  const menage = (await call('/api/menage')).data;
  assert.deepEqual(Object.keys(menage[0]).sort(), ['appartement', 'couleur', 'date_arrivee', 'date_depart', 'locataire', 'semaine', 'telephone']);

  const share = (await call('/api/partages', { method: 'POST', body: { role: 'menage' } })).data;
  const pub = await call(`/api/public/${share.token}`, { auth: false });
  assert.equal(pub.status, 200);
  const json = JSON.stringify(pub.data);
  assert.ok(json.includes('Famille Durand'));
  for (const secret of ['1500', 'Secret', 'acompte', 'statut', 'solde']) assert.ok(!json.includes(secret), `fuite : ${secret}`);
  // Le lien ménage ne donne accès ni à l'API admin ni aux données comptables.
  assert.equal((await call(`/api/public/${share.token}/comptable.xlsx`, { auth: false })).status, 403);
  await call(`/api/partages/${share.id}`, { method: 'DELETE' });
  assert.equal((await call(`/api/public/${share.token}`, { auth: false })).status, 404);
});

test('exports Excel, PDF, contrat et comptabilité', async () => {
  const xlsx = await call('/api/export/reservations.xlsx?appartement=2');
  assert.equal(xlsx.status, 200);
  assert.equal(xlsx.data.subarray(0, 2).toString(), 'PK');
  const pdf = await call('/api/export/reservations.pdf');
  assert.equal(pdf.data.subarray(0, 4).toString(), '%PDF');
  assert.equal((await call('/api/export/menage.pdf')).data.subarray(0, 4).toString(), '%PDF');
  const annee = new Date().getFullYear();
  const compta = (await call(`/api/comptabilite?annee=${annee}`)).data;
  assert.equal(compta.total, 450); // acompte encaissé aujourd'hui
  assert.equal((await call(`/api/export/comptable.xlsx?annee=${annee}`)).status, 200);
});

test('tableau de bord', async () => {
  const d = (await call('/api/dashboard?annee=2027')).data;
  const da = d.kpis.find((k) => k.nom === 'Les Deux Alpes');
  assert.equal(da.semaines, 2);
  assert.equal(da.encaisse, 450);
  assert.equal(da.restant, 1950);
  assert.ok(d.alertes.length > 0);
});

test('contrat de location : fusion, informations manquantes, PDF, archivage', async () => {
  const r = (await call('/api/reservations', { method: 'POST', body: {
    appartement_id: 1, date_arrivee: '2026-12-26', date_depart: '2027-01-02', nom_locataire: 'PRIMAUD', prenom_locataire: 'Morgan',
    telephone: '06 00 00 00 00', email: 'morgan@example.com', nb_adultes: 4, nb_enfants: 4, montant_sejour: 1150,
  } })).data;

  let c = (await call(`/api/reservations/${r.id}/contrat`)).data;
  assert.ok(c.manquants.some((m) => m.includes('Adresse postale du locataire')));
  assert.ok(c.manquants.some((m) => m.includes('Nom du propriétaire')));
  assert.match(c.texte, /Morgan PRIMAUD/);
  assert.match(c.texte, /Cette somme de \*\*345,00 €\*\*/);        // acompte 30 %
  assert.match(c.texte, /avant le 26\/11\/2026/);                   // arrivée − 1 mois
  assert.match(c.texte, /4 adultes et 4 enfants/);
  assert.match(c.texte, /dépôt de garantie de 500,00 €/);
  assert.doesNotMatch(c.texte, /\{[a-z_]+\}/, 'toutes les variables sont remplacées');
  const taxe = r.taxe_sejour;
  assert.ok(c.texte.includes(`solde du loyer de ${(805 + taxe).toLocaleString('fr-FR', { minimumFractionDigits: 2 }).replace(/ | /g, ' ')} €`));

  await call('/api/reglages/proprietaire', { method: 'PUT', body: { nom: 'Test', prenom: 'Proprio', adresse: '1 rue X', telephone: '01', email: 'p@example.com', lieu_signature: 'Mâcon' } });
  await call(`/api/reservations/${r.id}`, { method: 'PUT', body: { adresse_locataire: '1 rue des Tests 62000 Arras' } });
  await call('/api/appartements/1', { method: 'PUT', body: { declaloc: '73123000001AB' } });
  c = (await call(`/api/reservations/${r.id}/contrat`)).data;
  assert.deepEqual(c.manquants, []);
  assert.match(c.texte, /Nom : \*\*TEST\*\*/);
  assert.match(c.texte, /Fait en deux exemplaires à Mâcon/);
  assert.match(c.texte, /Deux|Giettaz/);

  // Modèle Deux Alpes : ménage inclus en majuscules.
  const r2 = (await call('/api/reservations', { method: 'POST', body: { appartement_id: 2, date_arrivee: '2027-01-09', date_depart: '2027-01-16', nom_locataire: 'HENNART', nb_adultes: 7, montant_sejour: 950, menage_inclus: true } })).data;
  const c2 = (await call(`/api/reservations/${r2.id}/contrat`)).data;
  assert.match(c2.texte, /MÉNAGE INCLUS/);
  assert.match(c2.texte, /pour 7 adultes/);
  assert.match(c2.texte, /dépôt de garantie de 900,00 €/);

  // PDF à partir d'un texte retouché, puis classement dans les documents.
  const res = await fetch(`${base}/api/reservations/${r.id}/contrat.pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ texte: '# Titre\n**Gras** normal\n[SIGNATURES]' }) });
  assert.equal(res.status, 200);
  assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
  assert.equal((await call(`/api/reservations/${r.id}/contrat.pdf`)).data.subarray(0, 4).toString(), '%PDF');
  const docs = (await call(`/api/reservations/${r.id}/contrat/archiver`, { method: 'POST', body: {} })).data;
  assert.equal(docs.length, 1);
  assert.equal(docs[0].type, 'contrat_envoye');

  // Signature (PNG 1×1) intégrée au PDF.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const fd = new FormData();
  fd.append('fichier', new Blob([png], { type: 'image/png' }), 'signature.png');
  assert.equal((await fetch(`${base}/api/reglages/signature`, { method: 'POST', headers: { Cookie: cookie }, body: fd })).status, 200);
  assert.equal((await call('/api/reglages/proprietaire')).data.signature, true);
  assert.equal((await call(`/api/reservations/${r.id}/contrat.pdf`)).status, 200);
});
