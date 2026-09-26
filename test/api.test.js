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
  const list = (await call('/api/reservations')).data;
  const contrat = (await call(`/api/reservations/${list[0].id}/contrat`)).data.texte;
  assert.match(contrat, /Famille Durand/);
  assert.match(contrat, /450,00 €/);
  assert.equal((await call(`/api/reservations/${list[0].id}/contrat.pdf`)).data.subarray(0, 4).toString(), '%PDF');
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
