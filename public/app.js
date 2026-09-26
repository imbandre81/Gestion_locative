/* Interface d'administration — application monopage sans framework. */
(() => {
  'use strict';
  const C = window.Calc;

  // ---------------------------------------------------------------- Utilitaires
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const euro = C.formatEuro;
  const fdate = C.formatDate;
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const DAYS_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
  const longDate = (iso) => {
    const d = C.parseDate(iso);
    return d ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
  };
  const qs = (obj) => new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== '' && v != null && v !== false)).toString();

  class ApiError extends Error {}
  async function api(url, { method = 'GET', body, form } = {}) {
    const opts = { method, headers: {} };
    if (form) opts.body = form;
    else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
    const res = await fetch(url, opts);
    if (res.status === 401 && !url.endsWith('/login')) { showLogin(); throw new ApiError('Session expirée.'); }
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    if (!res.ok) throw new ApiError((data && data.error) || `Erreur ${res.status}`);
    return data;
  }

  let toastTimer;
  function toast(msg, isError = false) {
    let el = $('.toast');
    if (!el) { el = document.createElement('div'); document.body.appendChild(el); }
    el.className = 'toast' + (isError ? ' error' : '');
    el.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), isError ? 5000 : 2500);
  }
  const fail = (e) => toast(e.message || String(e), true);

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    toast('📋 Copié dans le presse-papiers');
  }

  // ---------------------------------------------------------------- Modale
  function openModal(html, { narrow = false, onClose } = {}) {
    closeModal();
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal ${narrow ? 'narrow' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
    const backdrop = root.firstElementChild;
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) closeModal(); });
    $$('[data-close]', backdrop).forEach((b) => b.addEventListener('click', closeModal));
    root._onClose = onClose;
    document.body.style.overflow = 'hidden';
    const first = $('input:not([type=hidden]), select, textarea', backdrop);
    if (first && window.innerWidth > 860) first.focus();
    return $('.modal', backdrop);
  }
  function closeModal() {
    const root = $('#modal-root');
    if (!root.firstElementChild) return;
    root.innerHTML = '';
    document.body.style.overflow = '';
    if (root._onClose) { const f = root._onClose; root._onClose = null; f(); }
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  const modalHead = (title, extra = '') => `<div class="modal-head"><h2>${title}</h2>${extra}<button class="ghost" data-close aria-label="Fermer">✕</button></div>`;

  // ---------------------------------------------------------------- État
  const S = {
    apts: [],
    aptById: {},
    modeles: [],
    years: [],
    dash: { annee: new Date().getFullYear() },
    cal: { mode: 'mois', apt: '', month: new Date().getMonth(), year: new Date().getFullYear() },
    dos: { appartement: '', annee: '', statut: '', q: '', sort: 'date_arrivee', dir: 1 },
    men: { appartement: '', tout: false },
    msg: { apt: '', resa: '' },
    compta: { annee: new Date().getFullYear() },
  };

  const aptChip = (id) => {
    const a = S.aptById[id];
    return a ? `<span class="apt-chip"><span class="dot" style="background:${esc(a.couleur)}"></span>${esc(a.nom)}</span>` : '<span class="apt-chip muted">Les deux</span>';
  };
  const aptOptions = (selected, allLabel = 'Les deux appartements') =>
    `<option value="">${allLabel}</option>` + S.apts.map((a) => `<option value="${a.id}" ${String(selected) === String(a.id) ? 'selected' : ''}>${esc(a.nom)}</option>`).join('');
  const yearOptions = (selected, allLabel) =>
    (allLabel ? `<option value="">${allLabel}</option>` : '') + S.years.map((y) => `<option ${String(selected) === String(y) ? 'selected' : ''}>${y}</option>`).join('');
  const statusBadge = (st) => `<span class="badge ${st.color}">${st.color === 'green' ? '✓' : st.color === 'red' ? '⚠' : '⏳'} ${esc(st.label)}</span>`;

  async function loadBase() {
    const [apts, modeles, resas] = await Promise.all([api('/api/appartements'), api('/api/modeles'), api('/api/reservations')]);
    S.apts = apts;
    S.aptById = Object.fromEntries(apts.map((a) => [a.id, a]));
    S.modeles = modeles;
    const now = new Date().getFullYear();
    S.years = [...new Set([...resas.map((r) => r.annee), now, now + 1])].sort((a, b) => b - a);
    $('#apt-legend').innerHTML = apts.map((a) => `<div class="row" style="gap:.4rem"><span class="dot" style="background:${esc(a.couleur)}"></span>${esc(a.nom)}</div>`).join('');
    const n = resas.reduce((s, r) => s + r.alertes.filter((a) => a.level === 'danger').length, 0);
    const badge = $('#alert-count');
    badge.hidden = !n;
    badge.textContent = n;
  }

  // ---------------------------------------------------------------- Routage
  const routes = {
    'tableau-de-bord': renderDashboard,
    calendrier: renderCalendar,
    dossiers: renderDossiers,
    menage: renderMenage,
    messages: renderMessages,
    comptabilite: renderCompta,
    reglages: renderReglages,
  };
  const currentRoute = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'tableau-de-bord');

  async function render() {
    const name = routes[currentRoute()] ? currentRoute() : 'tableau-de-bord';
    $$('.sidebar a.nav[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
    document.body.classList.remove('menu-open');
    try {
      await routes[name]($('#view'));
    } catch (e) {
      if (!(e instanceof ApiError && e.message === 'Session expirée.')) fail(e);
    }
  }

  let refreshTimer;
  function refreshSoon() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => { await loadBase().catch(() => {}); render(); }, 250);
  }

  // ---------------------------------------------------------------- Tableau de bord
  async function renderDashboard(view) {
    const d = await api('/api/dashboard?' + qs({ annee: S.dash.annee }));
    const total = d.kpis.reduce((acc, k) => ({ semaines: acc.semaines + k.semaines, chiffre: acc.chiffre + k.chiffre, encaisse: acc.encaisse + k.encaisse, restant: acc.restant + k.restant }), { semaines: 0, chiffre: 0, encaisse: 0, restant: 0 });

    const kpiCard = (k) => {
      const pct = k.chiffre ? Math.round((k.encaisse / k.chiffre) * 100) : 0;
      return `<div class="card kpi-card" style="--apt:${esc(k.couleur)}">
        <h2><span class="dot" style="background:${esc(k.couleur)}"></span>${esc(k.nom)} <span class="muted small-text" style="font-weight:400">— ${d.annee}</span></h2>
        <div class="kpis">
          <div class="kpi"><div class="value">${k.semaines}</div><div class="label">Semaines louées</div></div>
          <div class="kpi"><div class="value">${String(k.occupation).replace('.', ',')} %</div><div class="label">Occupation (${k.nuits} nuits)</div></div>
          <div class="kpi"><div class="value">${euro(k.encaisse)}</div><div class="label">Encaissé</div></div>
          <div class="kpi"><div class="value">${euro(k.restant)}</div><div class="label">Reste à encaisser</div></div>
        </div>
        <div class="progress" title="${pct} % encaissé"><div style="width:${pct}%"></div></div>
        <div class="row small-text muted" style="margin-top:.4rem;justify-content:space-between">
          <span>Chiffre d'affaires : <b>${euro(k.chiffre)}</b> · ${pct} % encaissé</span>
          <span>Taxe de séjour : ${euro(k.taxe)} · ${k.complets}/${k.semaines} dossiers complets</span>
        </div>
      </div>`;
    };

    const alerts = d.alertes.slice(0, 40).map((a) => `<li class="${a.level}" data-open="${a.reservation_id}">
        <span class="dot" style="background:${esc(a.couleur)}"></span>
        <span class="what"><b>${esc(a.label)}</b> — ${esc(a.locataire)}<small>${esc(a.appartement)} · S${a.semaine} (${fdate(a.date_arrivee)} → ${fdate(a.date_depart)}) · ${esc(a.detail || '')}</small></span>
        <span class="badge ${a.level === 'danger' ? 'red' : a.level === 'warning' ? 'orange' : 'blue'}">${a.level === 'danger' ? 'Urgent' : a.level === 'warning' ? 'À faire' : 'Info'}</span>
      </li>`).join('');

    const moves = d.mouvements.slice(0, 14).map((m) => `<li data-open="${m.reservation_id}">
        <span class="date">${longDate(m.date)}<small>${m.type === 'arrivee' ? '🛬 Arrivée' : '🛫 Départ'}</small></span>
        <span><span class="dot" style="background:${esc(m.couleur)}"></span> <b>${esc(m.locataire)}</b><br><span class="small-text muted">${esc(m.appartement)} · ${esc(m.telephone)}</span></span>
        ${statusBadge(m.statut)}
      </li>`).join('');

    const comp = d.comparatif.map((y, i) => {
      const prev = d.comparatif[i - 1];
      const cells = y.parAppartement.map((p, j) => {
        let delta = '';
        if (prev && prev.parAppartement[j].chiffre) {
          const v = Math.round(((p.chiffre - prev.parAppartement[j].chiffre) / prev.parAppartement[j].chiffre) * 100);
          delta = ` <span class="delta ${v >= 0 ? 'up' : 'down'} small-text">${v >= 0 ? '▲' : '▼'} ${Math.abs(v)} %</span>`;
        }
        return `<td class="right nowrap">${euro(p.chiffre)}${delta}<span class="sub">${p.semaines} sem. · encaissé ${euro(p.encaisse)}</span></td>`;
      }).join('');
      const tot = y.parAppartement.reduce((s, p) => s + p.chiffre, 0);
      return `<tr><td><b>${y.annee}</b>${y.annee < new Date().getFullYear() ? ' <span class="badge grey">archivée</span>' : ''}</td>${cells}<td class="right"><b>${euro(tot)}</b></td></tr>`;
    }).reverse().join('');

    view.innerHTML = `
      <div class="page-head">
        <h1>Tableau de bord</h1>
        <select id="dash-year" style="width:auto">${yearOptions(S.dash.annee)}</select>
      </div>
      <div class="grid cols-2">${d.kpis.map(kpiCard).join('')}</div>
      <p class="muted small-text">Total ${d.annee} : <b>${total.semaines}</b> semaines · CA <b>${euro(total.chiffre)}</b> · encaissé <b>${euro(total.encaisse)}</b> · reste <b>${euro(total.restant)}</b></p>
      <div class="grid cols-2" style="margin-top:1rem">
        <div class="card">
          <h2>🔔 Alertes en cours <span class="muted small-text" style="font-weight:400">(${d.alertes.length})</span></h2>
          ${alerts ? `<ul class="alert-list">${alerts}</ul>` : '<div class="empty">Aucune alerte, tout est à jour 🎉</div>'}
        </div>
        <div class="card">
          <h2>🗓️ Prochaines arrivées & départs <span class="muted small-text" style="font-weight:400">(60 jours)</span></h2>
          ${moves ? `<ul class="moves">${moves}</ul>` : '<div class="empty">Aucun mouvement prévu.</div>'}
        </div>
      </div>
      <div class="card" style="margin-top:1rem">
        <h2>📈 Comparatif des revenus par année</h2>
        <div class="table-wrap" style="box-shadow:none">
          <table class="data"><thead><tr><th>Année</th>${S.apts.map((a) => `<th class="right">${esc(a.nom)}</th>`).join('')}<th class="right">Total</th></tr></thead>
          <tbody>${comp || `<tr><td colspan="${S.apts.length + 2}" class="empty">Pas encore de données.</td></tr>`}</tbody></table>
        </div>
      </div>`;
    $('#dash-year').onchange = (e) => { S.dash.annee = e.target.value; render(); };
    $$('[data-open]', view).forEach((el) => el.addEventListener('click', () => openReservation(Number(el.dataset.open))));
  }

  // ---------------------------------------------------------------- Calendrier
  async function renderCalendar(view) {
    const all = await api('/api/reservations');
    const resas = all.filter((r) => !S.cal.apt || String(r.appartement_id) === String(S.cal.apt));
    const c = S.cal;
    const title = c.mode === 'mois' ? `${MONTHS[c.month]} ${c.year}` : `Année ${c.year}`;

    view.innerHTML = `
      <div class="page-head"><h1 style="text-transform:capitalize">📅 ${title}</h1></div>
      <div class="toolbar">
        <div class="segmented"><button data-mode="mois" class="${c.mode === 'mois' ? 'on' : ''}">Mois</button><button data-mode="annee" class="${c.mode === 'annee' ? 'on' : ''}">Année</button></div>
        <button id="cal-prev" aria-label="Précédent">◀</button><button id="cal-today">Aujourd'hui</button><button id="cal-next" aria-label="Suivant">▶</button>
        <select id="cal-apt">${aptOptions(c.apt, 'Les deux (superposés)')}</select>
      </div>
      <div id="cal-body"></div>
      <div class="cal-legend">
        ${S.apts.map((a) => `<span><span class="sw" style="background:${esc(a.couleur)}"></span>${esc(a.nom)} (bordure)</span>`).join('')}
        <span><span class="sw" style="background:var(--green-bg);border:1px solid var(--green)"></span>Dossier complet</span>
        <span><span class="sw" style="background:var(--orange-bg);border:1px solid var(--orange)"></span>En attente d'une pièce</span>
        <span><span class="sw" style="background:var(--red-bg);border:1px solid var(--red)"></span>Problème / solde en retard</span>
      </div>`;

    $$('[data-mode]', view).forEach((b) => (b.onclick = () => { c.mode = b.dataset.mode; render(); }));
    $('#cal-apt').onchange = (e) => { c.apt = e.target.value; render(); };
    $('#cal-today').onclick = () => { c.month = new Date().getMonth(); c.year = new Date().getFullYear(); render(); };
    const step = (dir) => {
      if (c.mode === 'annee') c.year += dir;
      else { c.month += dir; if (c.month < 0) { c.month = 11; c.year--; } if (c.month > 11) { c.month = 0; c.year++; } }
      render();
    };
    $('#cal-prev').onclick = () => step(-1);
    $('#cal-next').onclick = () => step(1);

    $('#cal-body').innerHTML = c.mode === 'mois' ? monthGrid(resas, c.year, c.month) : yearPlanning(resas, c.year);
    $$('[data-open]', view).forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); openReservation(Number(el.dataset.open)); }));
    $$('[data-new]', view).forEach((el) => el.addEventListener('click', () => openReservation(null, { date_arrivee: el.dataset.new, appartement_id: c.apt || S.apts[0]?.id })));
  }

  const barHtml = (r, extraClass = '', style = '') =>
    `<div class="bar ${r.statut.color} ${extraClass}" style="--apt:${esc(r.appartement_couleur)};${style}" data-open="${r.id}" title="${esc(`${r.nom_locataire} — ${r.appartement_nom}\n${fdate(r.date_arrivee)} → ${fdate(r.date_depart)}\n${r.statut.label}`)}"><span class="name">${esc(r.nom_locataire)}</span></div>`;

  function monthGrid(resas, year, month) {
    const first = new Date(Date.UTC(year, month, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    let cursor = C.addDays(C.toISO(first), -offset);
    const today = C.todayISO();
    let html = `<div class="cal"><div class="cal-head">${DAYS_SHORT.map((d) => `<div>${d}</div>`).join('')}</div>`;
    for (let w = 0; w < 6; w++) {
      const start = cursor;
      const end = C.addDays(start, 7);
      if (w > 3 && C.parseDate(start).getUTCMonth() !== month) break;
      const days = [];
      for (let i = 0; i < 7; i++) {
        const iso = C.addDays(start, i);
        const dt = C.parseDate(iso);
        days.push(`<div class="${dt.getUTCMonth() !== month ? 'out' : ''} ${iso === today ? 'today' : ''}" data-new="${iso}" title="Nouvelle réservation le ${fdate(iso)}"><span>${dt.getUTCDate()}</span></div>`);
      }
      // Barres : de la mi-journée d'arrivée à la mi-journée de départ (14 demi-colonnes).
      const segs = resas.filter((r) => r.date_arrivee < end && r.date_depart >= start).map((r) => {
        const s = r.date_arrivee < start ? 1 : C.nights(start, r.date_arrivee) * 2 + 2;
        const e = r.date_depart >= end ? 15 : C.nights(start, r.date_depart) * 2 + 2;
        return { r, s, e: Math.max(e, s + 1), contL: r.date_arrivee < start, contR: r.date_depart >= end };
      }).sort((a, b) => a.s - b.s);
      const lanes = [];
      for (const sg of segs) {
        let l = lanes.findIndex((endCol) => endCol <= sg.s);
        if (l === -1) { l = lanes.length; lanes.push(0); }
        lanes[l] = sg.e;
        sg.lane = l + 1;
      }
      const bars = segs.map((sg) => barHtml(sg.r, `${sg.contL ? 'cont-left' : ''} ${sg.contR ? 'cont-right' : ''}`, `grid-column:${sg.s}/${sg.e};grid-row:${sg.lane}`)).join('');
      html += `<div class="cal-week"><div class="cal-days">${days.join('')}</div><div class="cal-bars" style="min-height:${Math.max(1, lanes.length) * 30 + 36}px">${bars}</div></div>`;
      cursor = end;
    }
    return html + '</div>';
  }

  function yearPlanning(resas, year) {
    const apts = S.cal.apt ? S.apts.filter((a) => String(a.id) === String(S.cal.apt)) : S.apts;
    const blocks = [];
    for (let m = 0; m < 12; m++) {
      // Semaines (samedi → samedi) dont le samedi tombe dans le mois.
      let d = new Date(Date.UTC(year, m, 1));
      while (d.getUTCDay() !== 6) d = new Date(d.getTime() + 86400000);
      const lines = [];
      for (; d.getUTCMonth() === m; d = new Date(d.getTime() + 7 * 86400000)) {
        const sat = C.toISO(d);
        const next = C.addDays(sat, 7);
        const slots = apts.map((a) => {
          const r = resas.find((x) => x.appartement_id === a.id && x.date_arrivee < next && x.date_depart > sat);
          return r ? barHtml(r, 'slot') : `<div class="slot" data-new-apt="${a.id}" data-new-date="${sat}" style="border-left:5px solid ${esc(a.couleur)}55">libre${apts.length > 1 ? ` · ${esc(a.nom)}` : ''}</div>`;
        }).join('');
        lines.push(`<div class="week-line"><div class="wk"><b>S${C.isoWeek(sat)}</b> ${fdate(sat).slice(0, 5)}</div><div class="slots">${slots}</div></div>`);
      }
      blocks.push(`<div class="card month-block"><h3>${MONTHS[m]}</h3>${lines.join('')}</div>`);
    }
    setTimeout(() => $$('[data-new-apt]').forEach((el) => (el.onclick = () => openReservation(null, { appartement_id: el.dataset.newApt, date_arrivee: el.dataset.newDate, date_depart: C.addDays(el.dataset.newDate, 7) }))));
    return `<p class="muted small-text">Semaines du samedi au samedi. Cliquez sur une semaine libre pour créer une réservation.</p><div class="year-grid">${blocks.join('')}</div>`;
  }

  // ---------------------------------------------------------------- Dossiers (tableau C)
  const CHECKS = [
    { key: 'cni_recue', date: 'cni_date', label: 'CNI' },
    { key: 'contrat_signe', date: 'contrat_date', label: 'Contrat' },
    { key: 'acompte_paye', date: 'acompte_date', label: 'Acompte', amount: 'montant_acompte' },
    { key: 'solde_paye', date: 'solde_date', label: 'Solde', amount: 'montant_solde' },
    { key: 'caution_recue', date: 'caution_recue_date', label: 'Caution', amount: 'caution_montant' },
  ];
  const checkBadge = (r, ck) => {
    const ok = r[ck.key];
    const amount = ck.amount ? euro(r[ck.amount]) + ' ' : '';
    const color = ok ? 'green' : (ck.key === 'solde_paye' && r.statut.soldeEnRetard) ? 'red' : 'orange';
    return `<button class="badge ${color}" data-toggle="${ck.key}" data-id="${r.id}" title="${ok ? 'Reçu le ' + fdate(r[ck.date]) + ' — cliquer pour annuler' : 'Cliquer pour marquer comme reçu aujourd’hui'}">${ok ? '✓' : '✗'} ${amount}${ok ? fdate(r[ck.date]).slice(0, 5) : ck.amount ? '' : 'manquant'}</button>`;
  };

  const SORTERS = {
    date_arrivee: (r) => r.date_arrivee, appartement: (r) => r.appartement_nom, locataire: (r) => r.nom_locataire.toLowerCase(),
    taxe: (r) => r.taxe_sejour, personnes: (r) => r.nb_personnes, statut: (r) => ({ probleme: 0, incomplet: 1, attente: 2, complet: 3 }[r.statut.code]),
    acompte: (r) => r.montant_acompte, solde: (r) => r.montant_solde,
  };

  async function renderDossiers(view) {
    const f = S.dos;
    const rows = await api('/api/reservations?' + qs({ appartement: f.appartement, annee: f.annee, statut: f.statut, q: f.q }));
    const key = SORTERS[f.sort] || SORTERS.date_arrivee;
    rows.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * f.dir; });
    const th = (label, sortKey) => sortKey
      ? `<th class="sortable" data-sort="${sortKey}">${label} <span class="arrow">${f.sort === sortKey ? (f.dir > 0 ? '▲' : '▼') : '↕'}</span></th>`
      : `<th>${label}</th>`;
    const exportQs = qs({ appartement: f.appartement, annee: f.annee, statut: f.statut, q: f.q });
    const totals = rows.reduce((t, r) => ({ montant: t.montant + r.montant_sejour, encaisse: t.encaisse + r.encaisse, taxe: t.taxe + r.taxe_sejour }), { montant: 0, encaisse: 0, taxe: 0 });

    view.innerHTML = `
      <div class="page-head">
        <h1>🗂️ Gestion des dossiers</h1>
        <a class="btn" href="/api/export/reservations.xlsx?${exportQs}">⬇︎ Excel</a>
        <a class="btn" href="/api/export/reservations.pdf?${exportQs}">⬇︎ PDF</a>
      </div>
      <div class="toolbar">
        <select id="f-apt">${aptOptions(f.appartement, 'Tous les appartements')}</select>
        <select id="f-year">${yearOptions(f.annee, 'Toutes les années')}</select>
        <select id="f-status">
          <option value="">Tous les statuts</option>
          <option value="complet" ${f.statut === 'complet' ? 'selected' : ''}>✓ Dossiers complets</option>
          <option value="incomplet" ${f.statut === 'incomplet' ? 'selected' : ''}>✗ Dossiers non complets</option>
          <option value="probleme" ${f.statut === 'probleme' ? 'selected' : ''}>⚠ Problème / solde en retard</option>
        </select>
        <input id="f-q" type="search" placeholder="Nom, téléphone, S12…" value="${esc(f.q)}" style="max-width:220px">
        ${f.appartement || f.annee || f.statut || f.q ? '<button id="f-reset" class="ghost">Réinitialiser</button>' : ''}
      </div>
      <div class="table-wrap">
        <table class="data responsive sticky-first">
          <thead><tr>
            ${th('Semaine', 'date_arrivee')}${th('Appartement', 'appartement')}${th('Locataire', 'locataire')}<th>Téléphone</th>
            <th>CNI reçue</th><th>Contrat signé</th>${th('Acompte 30 %', 'acompte')}${th('Solde', 'solde')}<th>Caution</th>
            ${th('Taxe séjour', 'taxe')}${th('Pers.', 'personnes')}<th>Ménage</th><th>Infos diverses</th>${th('Statut', 'statut')}
          </tr></thead>
          <tbody>${rows.map((r) => `
            <tr class="clickable" data-open="${r.id}">
              <td data-label="Semaine" class="nowrap"><b>S${r.semaine}</b> <span class="muted">${r.annee}</span><span class="sub">${fdate(r.date_arrivee).slice(0, 5)} → ${fdate(r.date_depart).slice(0, 5)}</span></td>
              <td data-label="Appartement" class="apt" style="border-left-color:${esc(r.appartement_couleur)}">${aptChip(r.appartement_id)}</td>
              <td data-label="Locataire"><b>${esc(r.nom_locataire)}</b>${r.prenom_locataire ? `<span class="sub">${esc(r.prenom_locataire)}</span>` : ''}</td>
              <td data-label="Téléphone" class="nowrap">${r.telephone ? `<a href="tel:${esc(r.telephone.replace(/\s/g, ''))}" data-stop>${esc(r.telephone)}</a>` : ''}</td>
              ${CHECKS.map((ck) => `<td data-label="${ck.label}">${checkBadge(r, ck)}</td>`).join('')}
              <td data-label="Taxe de séjour" class="nowrap right">${euro(r.taxe_sejour)}</td>
              <td data-label="Personnes" class="nowrap">${r.nb_personnes} <span class="sub">${r.nb_adultes} A · ${r.nb_enfants} E</span></td>
              <td data-label="Ménage">${r.menage_inclus ? '<span class="badge blue">Inclus</span>' : '<span class="badge grey">Non</span>'}</td>
              <td data-label="Infos" class="infos">${esc(r.infos)}</td>
              <td data-label="Statut">${statusBadge(r.statut)}</td>
            </tr>`).join('') || `<tr><td colspan="14" class="empty">Aucune réservation ne correspond aux filtres.</td></tr>`}
          </tbody>
        </table>
        <div class="table-foot"><span>${rows.length} réservation(s)</span><span>Montant total ${euro(totals.montant)} · encaissé ${euro(totals.encaisse)} · taxe de séjour ${euro(totals.taxe)}</span></div>
      </div>`;

    $('#f-apt').onchange = (e) => { f.appartement = e.target.value; render(); };
    $('#f-year').onchange = (e) => { f.annee = e.target.value; render(); };
    $('#f-status').onchange = (e) => { f.statut = e.target.value; render(); };
    let t;
    $('#f-q').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; render().then(() => { const i = $('#f-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 300); };
    if ($('#f-reset')) $('#f-reset').onclick = () => { Object.assign(f, { appartement: '', annee: '', statut: '', q: '' }); $('#global-search').value = ''; render(); };
    $$('th[data-sort]', view).forEach((thEl) => (thEl.onclick = () => { const k = thEl.dataset.sort; f.dir = f.sort === k ? -f.dir : 1; f.sort = k; render(); }));
    $$('tr[data-open]', view).forEach((tr) => tr.addEventListener('click', () => openReservation(Number(tr.dataset.open))));
    $$('[data-stop]', view).forEach((a) => a.addEventListener('click', (e) => e.stopPropagation()));
    $$('[data-toggle]', view).forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = rows.find((x) => x.id === Number(b.dataset.id));
      const ck = CHECKS.find((c) => c.key === b.dataset.toggle);
      const question = r[ck.key]
        ? `Annuler « ${ck.label} » pour ${r.nom_locataire} ?`
        : `Marquer « ${ck.label} » comme reçu aujourd'hui pour ${r.nom_locataire} ?`;
      if (!confirm(question)) return;
      try {
        await api(`/api/reservations/${r.id}`, { method: 'PUT', body: { [b.dataset.toggle]: !r[b.dataset.toggle] } });
        toast(r[b.dataset.toggle] ? 'Case décochée' : '✓ Marqué comme reçu aujourd’hui');
      } catch (err) { fail(err); }
    }));
  }

  // ---------------------------------------------------------------- Fiche réservation
  const CHECK_ROWS = [
    { key: 'cni_recue', date: 'cni_date', label: 'CNI reçue' },
    { key: 'contrat_signe', date: 'contrat_date', label: 'Contrat signé retourné' },
    { key: 'acompte_paye', date: 'acompte_date', label: 'Acompte 30 % payé', amount: 'acompte' },
    { key: 'solde_paye', date: 'solde_date', label: 'Solde payé', amount: 'solde' },
    { key: 'caution_recue', date: 'caution_recue_date', label: 'Chèque de caution reçu', amount: 'caution' },
    { key: 'caution_encaissee', date: 'caution_encaissee_date', label: 'Caution encaissée', amount: 'caution' },
    { key: 'caution_rendue', date: 'caution_rendue_date', label: 'Caution rendue', amount: 'caution' },
  ];
  const DOC_TYPES = { cni: "Pièce d'identité", contrat_signe: 'Contrat signé', contrat_envoye: 'Contrat envoyé', rib_envoye: 'RIB envoyé', autre: 'Autre' };

  async function openReservation(id, defaults = {}) {
    let r;
    try {
      r = id ? await api(`/api/reservations/${id}`) : {
        appartement_id: Number(defaults.appartement_id) || S.apts[0]?.id, date_arrivee: defaults.date_arrivee || '', date_depart: defaults.date_depart || (defaults.date_arrivee ? C.addDays(defaults.date_arrivee, 7) : ''),
        nom_locataire: '', prenom_locataire: '', adresse_locataire: '', telephone: '', email: '', nb_adultes: 2, nb_enfants: 0, montant_sejour: '', menage_inclus: false, infos: '', documents: [],
      };
    } catch (e) { return fail(e); }

    const v = (k) => esc(r[k] ?? '');
    const modal = openModal(`
      ${modalHead(id ? `Réservation — ${esc(r.nom_locataire)}` : 'Nouvelle réservation', '<span id="f-status-badge"></span>')}
      <form id="resa-form" autocomplete="off">
      <div class="modal-body">
        <fieldset><legend>Séjour</legend>
          <div class="form-grid">
            <label class="field span-2">Appartement<select name="appartement_id">${S.apts.map((a) => `<option value="${a.id}" ${a.id === Number(r.appartement_id) ? 'selected' : ''}>${esc(a.nom)}</option>`).join('')}</select></label>
            <label class="field">Arrivée<input type="date" name="date_arrivee" value="${v('date_arrivee')}" required></label>
            <label class="field">Départ<input type="date" name="date_depart" value="${v('date_depart')}" required></label>
            <label class="field">Semaine n°<div class="computed" id="c-semaine">—</div></label>
            <label class="field">Nuits<div class="computed" id="c-nuits">—</div></label>
            <label class="field span-2">Montant du séjour (€)<input type="number" name="montant_sejour" min="0" step="0.01" inputmode="decimal" value="${v('montant_sejour')}" required></label>
          </div>
        </fieldset>
        <fieldset><legend>Locataire(s)</legend>
          <div class="form-grid">
            <label class="field span-2">Nom du/des locataire(s)<input name="nom_locataire" value="${v('nom_locataire')}" required placeholder="ex. Famille Martin"></label>
            <label class="field span-2">Prénom <span class="hint">(pour les messages — facultatif)</span><input name="prenom_locataire" value="${v('prenom_locataire')}"></label>
            <label class="field span-2">Téléphone<input type="tel" name="telephone" value="${v('telephone')}" inputmode="tel"></label>
            <label class="field span-2">E-mail <span class="hint">(facultatif)</span><input type="email" name="email" value="${v('email')}"></label>
            <label class="field span-4">Adresse postale <span class="hint">(pour le contrat)</span><input name="adresse_locataire" value="${v('adresse_locataire')}" autocomplete="off" placeholder="N°, rue, code postal, ville"></label>
            <label class="field">Adultes<input type="number" name="nb_adultes" min="0" step="1" value="${v('nb_adultes')}"></label>
            <label class="field">Enfants (mineurs)<input type="number" name="nb_enfants" min="0" step="1" value="${v('nb_enfants')}"></label>
            <label class="field">Total personnes<div class="computed" id="c-personnes">—</div></label>
            <label class="field" style="justify-content:flex-end"><span class="row" style="gap:.5rem;color:var(--text);font-size:.9rem;min-height:2.3rem"><input type="checkbox" name="menage_inclus" ${r.menage_inclus ? 'checked' : ''}> Ménage inclus</span></label>
          </div>
        </fieldset>
        <fieldset><legend>Suivi du dossier</legend>
          <div class="checks">${CHECK_ROWS.map((c) => `
            <div class="check-row" data-row="${c.key}">
              <input type="checkbox" id="ck-${c.key}" name="${c.key}" ${r[c.key] ? 'checked' : ''}>
              <label for="ck-${c.key}">${c.label}</label>
              <input type="date" name="${c.date}" value="${v(c.date)}" aria-label="Date — ${c.label}">
              <span class="amount" data-amount="${c.amount || ''}"></span>
            </div>`).join('')}
          </div>
          <div class="status-line" id="c-alerts" style="margin-top:.75rem"></div>
        </fieldset>
        <fieldset><legend>Taxe de séjour (calcul automatique)</legend>
          <div class="row"><div class="computed grow" id="c-taxe">—</div></div>
          <div class="tax-detail" id="c-taxe-detail"></div>
        </fieldset>
        <label class="field">Infos diverses<textarea name="infos" rows="3">${v('infos')}</textarea></label>
        ${id ? `<fieldset><legend>Documents</legend>
          <ul class="docs" id="docs">${docsHtml(r.documents)}</ul>
          <div class="row" style="margin-top:.6rem">
            <select id="doc-type" style="width:auto">${Object.entries(DOC_TYPES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
            <input type="file" id="doc-file" class="grow" accept="image/*,application/pdf,.doc,.docx,.odt">
            <button type="button" id="doc-upload">⬆︎ Joindre</button>
          </div>
        </fieldset>` : ''}
      </div>
      <div class="modal-foot">
        ${id ? '<button type="button" class="danger" id="resa-delete">🗑 Supprimer</button>' : ''}
        <button type="button" id="resa-message">✉️ Générer le message</button>
        ${id ? '<button type="button" id="resa-contrat">📄 Contrat de location</button>' : ''}
        <span class="grow"></span>
        <button type="button" data-close>Annuler</button>
        <button type="submit" class="primary">Enregistrer</button>
      </div>
      </form>`);

    const form = $('#resa-form', modal);
    const readForm = () => {
      const fd = new FormData(form);
      const o = Object.fromEntries(fd.entries());
      for (const c of CHECK_ROWS) o[c.key] = form.elements[c.key].checked;
      o.menage_inclus = form.elements.menage_inclus.checked;
      return o;
    };
    const update = () => {
      const d = readForm();
      const apt = S.aptById[d.appartement_id];
      const n = C.nights(d.date_arrivee, d.date_depart);
      const pay = C.payments(d.montant_sejour);
      const tax = C.touristTax(d, apt);
      $('#c-semaine', modal).textContent = d.date_arrivee ? `S${C.isoWeek(d.date_arrivee)}` : '—';
      $('#c-nuits', modal).textContent = n ? `${n} nuit${n > 1 ? 's' : ''}` : '—';
      $('#c-personnes', modal).textContent = (Number(d.nb_adultes) || 0) + (Number(d.nb_enfants) || 0);
      const amounts = { acompte: pay.acompte, solde: pay.solde, caution: apt ? apt.caution : 0 };
      $$('[data-amount]', modal).forEach((el) => { el.textContent = el.dataset.amount ? euro(amounts[el.dataset.amount]) : ''; });
      for (const c of CHECK_ROWS) $(`[data-row="${c.key}"]`, modal).classList.toggle('done', form.elements[c.key].checked);
      $('#c-taxe', modal).textContent = euro(tax.total);
      $('#c-taxe-detail', modal).innerHTML = apt && tax.total
        ? `Nuitée/pers. ${euro(tax.prixNuiteeParPersonne)} × ${apt.taux_communal} % = ${euro(tax.taxeParNuitParPersonne)}${tax.plafonne ? ` <b>(plafonné à ${euro(apt.plafond_communal)})</b>` : ''} × ${n} nuits × ${d.nb_adultes} adulte(s) = ${euro(tax.base)} + taxe départementale ${apt.taux_departemental} % (${euro(tax.additionnelle)}). Mineurs exonérés.`
        : 'Renseignez dates, montant et occupants pour calculer la taxe.';
      const st = C.status(d);
      $('#f-status-badge', modal).innerHTML = d.date_arrivee ? statusBadge(st) : '';
      const al = d.date_arrivee ? C.alerts(d, apt) : [];
      $('#c-alerts', modal).innerHTML = al.map((a) => `<span class="badge ${a.level === 'danger' ? 'red' : a.level === 'warning' ? 'orange' : 'blue'}" title="${esc(a.detail)}">${esc(a.label)} · ${esc(a.detail)}</span>`).join('');
    };
    form.addEventListener('input', update);
    form.addEventListener('change', (e) => {
      const row = CHECK_ROWS.find((c) => c.key === e.target.name);
      if (row) { const dateEl = form.elements[row.date]; if (e.target.checked && !dateEl.value) dateEl.value = C.todayISO(); if (!e.target.checked) dateEl.value = ''; }
      if (e.target.name === 'date_arrivee' && e.target.value && !form.elements.date_depart.value) form.elements.date_depart.value = C.addDays(e.target.value, 7);
      update();
    });
    update();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', form);
      btn.disabled = true;
      try {
        const saved = await api(id ? `/api/reservations/${id}` : '/api/reservations', { method: id ? 'PUT' : 'POST', body: readForm() });
        toast('✓ Réservation enregistrée');
        closeModal();
        if (!id) openReservation(saved.id);
      } catch (err) { fail(err); btn.disabled = false; }
    });

    $('#resa-message', modal).onclick = () => openMessageGenerator({ ...r, ...readForm(), nb_adultes: Number(form.elements.nb_adultes.value), nb_enfants: Number(form.elements.nb_enfants.value) });
    if (id) {
      $('#resa-delete', modal).onclick = async () => {
        if (!confirm(`Supprimer définitivement la réservation de ${r.nom_locataire} ?`)) return;
        try { await api(`/api/reservations/${id}`, { method: 'DELETE' }); toast('Réservation supprimée'); closeModal(); } catch (err) { fail(err); }
      };
      // Enregistre d'abord la fiche pour que le contrat reprenne les dernières saisies.
      $('#resa-contrat', modal).onclick = async () => {
        if (!form.reportValidity()) return;
        try { await api(`/api/reservations/${id}`, { method: 'PUT', body: readForm() }); openContract(id); } catch (err) { fail(err); }
      };
      const bindDocs = () => $$('[data-del-doc]', modal).forEach((b) => (b.onclick = async () => {
        if (!confirm('Supprimer ce document ?')) return;
        try { await api(`/api/documents/${b.dataset.delDoc}`, { method: 'DELETE' }); b.closest('li').remove(); } catch (err) { fail(err); }
      }));
      bindDocs();
      $('#doc-upload', modal).onclick = async () => {
        const file = $('#doc-file', modal).files[0];
        if (!file) return toast('Choisissez un fichier.', true);
        const fd = new FormData();
        fd.append('type', $('#doc-type', modal).value);
        fd.append('fichier', file);
        try {
          const docs = await api(`/api/reservations/${id}/documents`, { method: 'POST', form: fd });
          $('#docs', modal).innerHTML = docsHtml(docs);
          $('#doc-file', modal).value = '';
          bindDocs();
          toast('📎 Document joint');
        } catch (err) { fail(err); }
      };
    }
  }

  const docsHtml = (docs) => (docs || []).map((d) => `<li><span class="badge grey">${esc(DOC_TYPES[d.type] || d.type)}</span><a href="/api/documents/${d.id}" target="_blank" rel="noopener">${esc(d.original_name)}</a><span class="muted small-text">${fdate(d.created_at)}</span><button type="button" class="small ghost" data-del-doc="${d.id}" aria-label="Supprimer">✕</button></li>`).join('') || '<li class="muted small-text">Aucun document joint (CNI, contrat signé, contrat envoyé, RIB…).</li>';

  /** Rendu HTML du texte balisé d'un contrat (# titre, ## intertitre, **gras**, [SIGNATURES], [SAUT DE PAGE]). */
  function contractHtml(text, signatureUrl, locataire) {
    const inline = (l) => esc(l)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/…{3,}/g, '<mark title="Information manquante">$&</mark>')
      .replace(/\{([a-z_]+)\}/g, '<mark title="Variable inconnue">{$1}</mark>');
    return String(text).split('\n').map((l) => {
      const t = l.trim();
      if (t === '[SAUT DE PAGE]') return '<hr class="page-break">';
      if (t === '[SIGNATURES]') {
        return `<div class="sig"><div><b>Le propriétaire</b>${signatureUrl ? `<img src="${signatureUrl}" alt="Signature">` : ''}</div><div><b>Le locataire (« lu et approuvé »)</b><small>${esc(locataire)}</small></div></div>`;
      }
      if (l.startsWith('# ')) return `<h1>${inline(l.slice(2))}</h1>`;
      if (l.startsWith('## ')) return `<h2>${inline(l.slice(3))}</h2>`;
      if (!t) return '<div class="gap"></div>';
      return `<p>${inline(l)}</p>`;
    }).join('');
  }

  async function downloadPost(url, body, fallbackName) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new ApiError(`Erreur ${res.status}`);
    const name = (res.headers.get('content-disposition') || '').match(/filename="([^"]+)"/)?.[1] || fallbackName;
    const href = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 5000);
  }

  async function openContract(id) {
    let r, c;
    try { [r, c] = await Promise.all([api(`/api/reservations/${id}`), api(`/api/reservations/${id}/contrat`)]); } catch (e) { return fail(e); }
    const sigUrl = c.signature ? `/api/reglages/signature?t=${Date.now()}` : '';
    const locataire = [r.prenom_locataire, r.nom_locataire].filter(Boolean).join(' ');
    const m = openModal(`${modalHead(`📄 Contrat — ${esc(locataire)}`, `<span class="apt-chip">${aptChip(r.appartement_id)}</span>`)}
      <div class="modal-body">
        ${c.manquants.length ? `<div class="banner"><b>À compléter avant l'envoi :</b><ul style="margin:.3rem 0 0;padding-left:1.2rem">${c.manquants.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          <div class="small-text" style="margin-top:.3rem">Les informations manquantes apparaissent en pointillés surlignés. Complétez la fiche ou les <a href="#/reglages" data-close>Réglages</a>, puis rouvrez le contrat.</div></div>` : ''}
        <div class="row">
          <div class="segmented"><button type="button" data-tab="apercu" class="on">Aperçu</button><button type="button" data-tab="texte">Modifier le texte</button></div>
          <span class="muted small-text grow">Les retouches valent pour ce contrat uniquement ; le modèle se modifie dans Réglages.</span>
        </div>
        <div class="contract-paper" id="contract-preview"></div>
        <textarea class="message-editor" id="contract-text" hidden>${esc(c.texte)}</textarea>
      </div>
      <div class="modal-foot">
        <button type="button" id="contract-back">◀ Fiche</button>
        <button type="button" id="contract-reset" title="Repartir du modèle">↻ Régénérer</button>
        <span class="grow"></span>
        <button type="button" id="contract-mail">✉️ Mail d'envoi</button>
        <button type="button" id="contract-archive" title="Ajouter le PDF aux documents de la réservation">🗂 Classer au dossier</button>
        <button type="button" class="primary" id="contract-pdf">⬇︎ PDF</button>
      </div>`);
    const ta = $('#contract-text', m);
    const preview = () => { $('#contract-preview', m).innerHTML = contractHtml(ta.value, sigUrl, locataire); };
    preview();
    $$('[data-tab]', m).forEach((b) => (b.onclick = () => {
      $$('[data-tab]', m).forEach((x) => x.classList.toggle('on', x === b));
      const edit = b.dataset.tab === 'texte';
      ta.hidden = !edit;
      $('#contract-preview', m).hidden = edit;
      if (!edit) preview();
    }));
    $('#contract-back', m).onclick = () => openReservation(id);
    $('#contract-reset', m).onclick = () => { if (confirm('Abandonner les retouches et régénérer le contrat depuis le modèle ?')) openContract(id); };
    $('#contract-pdf', m).onclick = () => downloadPost(`/api/reservations/${id}/contrat.pdf`, { texte: ta.value }, 'contrat.pdf').catch(fail);
    $('#contract-archive', m).onclick = async () => {
      try {
        await api(`/api/reservations/${id}/contrat/archiver`, { method: 'POST', body: { texte: ta.value } });
        toast('🗂 Contrat classé dans les documents (« Contrat envoyé »)');
      } catch (e) { fail(e); }
    };
    $('#contract-mail', m).onclick = () => {
      const mod = S.modeles.find((x) => x.categorie === 'reservation' && String(x.appartement_id) === String(r.appartement_id));
      openMessageGenerator(r, mod && mod.id);
    };
  }

  // ---------------------------------------------------------------- Génération de messages
  function modelesFor(aptId) {
    return S.modeles.slice().sort((a, b) => {
      const sa = String(a.appartement_id) === String(aptId) ? 0 : a.appartement_id ? 2 : 1;
      const sb = String(b.appartement_id) === String(aptId) ? 0 : b.appartement_id ? 2 : 1;
      return sa - sb || a.ordre - b.ordre;
    });
  }

  function openMessageGenerator(resa, modeleId) {
    const apt = S.aptById[resa.appartement_id];
    const list = modelesFor(resa.appartement_id);
    // Modèle proposé selon l'avancement du séjour : réservation → arrivée (J-7) → fin de séjour.
    const today = C.todayISO();
    const phase = !resa.date_arrivee || today < C.addDays(resa.date_arrivee, -7) ? 'reservation' : today < resa.date_arrivee ? 'arrivee' : 'depart';
    const chosen = list.find((m) => m.id === modeleId) || list.find((m) => m.categorie === phase && String(m.appartement_id) === String(resa.appartement_id)) || list[0];
    const m = openModal(`${modalHead('✉️ Générer un message')}
      <div class="modal-body">
        <label class="field">Modèle<select id="gen-model">${list.map((x) => `<option value="${x.id}" ${x.id === chosen?.id ? 'selected' : ''}>${esc(x.titre)}${x.appartement_id && String(x.appartement_id) !== String(resa.appartement_id) ? ' (autre appartement)' : ''}</option>`).join('')}</select></label>
        <label class="field">Message pré-rempli pour ${esc(resa.nom_locataire || 'le locataire')} — modifiable avant copie<textarea class="message-editor" id="gen-text"></textarea></label>
      </div>
      <div class="modal-foot">${resa.id ? '<button type="button" id="gen-back">◀ Retour à la fiche</button>' : ''}<span class="grow"></span>
        <a class="btn" id="gen-mail" ${resa.email ? '' : 'hidden'}>📧 Ouvrir dans la messagerie</a>
        <button type="button" class="primary" id="gen-copy">📋 Copier</button></div>`, { narrow: true });
    const fill = () => {
      const mod = S.modeles.find((x) => x.id === Number($('#gen-model', m).value));
      const text = mod ? C.fillTemplate(mod.corps, resa, apt) : '';
      $('#gen-text', m).value = text;
      if (resa.email) $('#gen-mail', m).href = `mailto:${encodeURIComponent(resa.email)}?subject=${encodeURIComponent(mod ? mod.titre.replace(/\s*–.*$/, '') + ' – ' + (apt ? apt.nom : '') : '')}&body=${encodeURIComponent(text)}`;
    };
    $('#gen-model', m).onchange = fill;
    $('#gen-text', m).oninput = () => { if (resa.email) $('#gen-mail', m).href = $('#gen-mail', m).href.replace(/body=.*$/, 'body=' + encodeURIComponent($('#gen-text', m).value)); };
    $('#gen-copy', m).onclick = () => copyText($('#gen-text', m).value);
    if (resa.id) $('#gen-back', m).onclick = () => openReservation(resa.id);
    fill();
  }

  // ---------------------------------------------------------------- Ménage (tableau D)
  async function renderMenage(view) {
    const f = S.men;
    const rows = await api('/api/menage?' + qs({ appartement: f.appartement, tout: f.tout ? 1 : '' }));
    view.innerHTML = `
      <div class="page-head">
        <h1>🧹 Tableau ménage</h1>
        <a class="btn" href="/api/export/menage.pdf?${qs({ appartement: f.appartement, tout: f.tout ? 1 : '' })}">⬇︎ PDF</a>
        <button class="primary" id="share-menage">🔗 Partager</button>
      </div>
      <p class="muted small-text" style="margin-top:-.5rem">Vue générée automatiquement à partir des réservations : elle se met à jour en temps réel et n'expose jamais les montants, statuts de paiement ni infos diverses.</p>
      <div class="toolbar">
        <select id="m-apt">${aptOptions(f.appartement)}</select>
        <label class="row" style="gap:.4rem;font-size:.9rem"><input type="checkbox" id="m-all" ${f.tout ? 'checked' : ''}> Afficher aussi les semaines passées</label>
      </div>
      <div class="table-wrap">
        <table class="data responsive">
          <thead><tr><th>Semaine</th><th>Nom du locataire</th><th>Numéro de téléphone</th></tr></thead>
          <tbody>${rows.map((r) => `<tr>
            <td data-label="Semaine" class="apt" style="border-left-color:${esc(r.couleur)}"><b>S${r.semaine}</b> · ${fdate(r.date_arrivee)} → ${fdate(r.date_depart)}<span class="sub">${esc(r.appartement)}</span></td>
            <td data-label="Locataire"><b>${esc(r.locataire)}</b></td>
            <td data-label="Téléphone">${r.telephone ? `<a href="tel:${esc(r.telephone.replace(/\s/g, ''))}">${esc(r.telephone)}</a>` : ''}</td>
          </tr>`).join('') || '<tr><td colspan="3" class="empty">Aucune semaine à venir.</td></tr>'}</tbody>
        </table>
      </div>`;
    $('#m-apt').onchange = (e) => { f.appartement = e.target.value; render(); };
    $('#m-all').onchange = (e) => { f.tout = e.target.checked; render(); };
    $('#share-menage').onclick = () => openShares('menage');
  }

  async function openShares(role) {
    const links = (await api('/api/partages')).filter((l) => l.role === role);
    const url = (t) => `${location.origin}/partage/${t}`;
    const who = role === 'menage' ? 'la personne du ménage' : 'le/la comptable';
    const m = openModal(`${modalHead(role === 'menage' ? '🔗 Partager le tableau ménage' : '🔗 Lien comptable')}
      <div class="modal-body">
        <p class="small-text muted" style="margin:0">Lien de consultation <b>en lecture seule</b> pour ${who}, sans mot de passe. ${role === 'menage' ? 'Seuls la semaine, le nom et le téléphone du locataire sont visibles.' : 'Seules les recettes encaissées par appartement sont visibles.'} Vous pouvez révoquer un lien à tout moment.</p>
        ${links.length ? links.map((l) => `<div class="card" style="padding:.7rem">
          <div class="row" style="margin-bottom:.4rem"><b class="grow">${esc(l.libelle)}</b>${aptChip(l.appartement_id)}<span class="muted small-text">créé le ${fdate(l.created_at)}</span></div>
          <div class="share-link"><input readonly value="${esc(url(l.token))}"><button type="button" data-copy="${esc(url(l.token))}">📋</button>
          <a class="btn" href="https://wa.me/?text=${encodeURIComponent(url(l.token))}" target="_blank" rel="noopener" title="Envoyer par WhatsApp">💬</a>
          <a class="btn" href="sms:?&body=${encodeURIComponent(url(l.token))}" title="Envoyer par SMS">✉️</a>
          <button type="button" class="danger" data-revoke="${l.id}" title="Révoquer">✕</button></div></div>`).join('') : '<div class="empty">Aucun lien actif.</div>'}
        <fieldset><legend>Nouveau lien</legend>
          <div class="row">
            <input id="sh-label" class="grow" placeholder="Libellé (ex. ${role === 'menage' ? 'Ménage — Marie' : 'Cabinet comptable'})" style="min-width:12rem">
            <select id="sh-apt" style="width:auto">${aptOptions('')}</select>
            <button type="button" class="primary" id="sh-create">Créer le lien</button>
          </div>
        </fieldset>
      </div>`, { narrow: true });
    $$('[data-copy]', m).forEach((b) => (b.onclick = () => copyText(b.dataset.copy)));
    $$('[data-revoke]', m).forEach((b) => (b.onclick = async () => {
      if (!confirm('Révoquer ce lien ? Il ne fonctionnera plus.')) return;
      await api(`/api/partages/${b.dataset.revoke}`, { method: 'DELETE' }).catch(fail);
      openShares(role);
    }));
    $('#sh-create', m).onclick = async () => {
      try {
        const l = await api('/api/partages', { method: 'POST', body: { role, appartement_id: $('#sh-apt', m).value, libelle: $('#sh-label', m).value } });
        await copyText(url(l.token));
        openShares(role);
      } catch (e) { fail(e); }
    };
  }

  // ---------------------------------------------------------------- Bibliothèque de messages
  async function renderMessages(view) {
    S.modeles = await api('/api/modeles');
    const resas = await api('/api/reservations');
    const today = C.todayISO();
    const upcoming = resas.filter((r) => r.date_depart >= today).concat(resas.filter((r) => r.date_depart < today).reverse());
    const resa = resas.find((r) => String(r.id) === String(S.msg.resa));
    const list = S.modeles.filter((m) => !S.msg.apt || !m.appartement_id || String(m.appartement_id) === String(S.msg.apt));
    const preview = (m) => {
      const text = resa ? C.fillTemplate(m.corps, resa, S.aptById[resa.appartement_id]) : m.corps;
      return esc(text).replace(/\{([a-z_]+)\}/g, '<span class="var">{$1}</span>');
    };

    view.innerHTML = `
      <div class="page-head"><h1>✉️ Bibliothèque de messages</h1><button class="primary" id="new-model">＋ Nouveau modèle</button></div>
      <div class="toolbar">
        <select id="msg-apt">${aptOptions(S.msg.apt, 'Tous les modèles')}</select>
        <select id="msg-resa" style="max-width:340px"><option value="">— Remplir avec une réservation… —</option>${upcoming.map((r) => `<option value="${r.id}" ${String(r.id) === String(S.msg.resa) ? 'selected' : ''}>${esc(r.nom_locataire)} · ${esc(r.appartement_nom)} · S${r.semaine} ${r.annee}</option>`).join('')}</select>
      </div>
      ${resa ? `<div class="banner">Variables remplies avec la réservation de <b>${esc(resa.nom_locataire)}</b> (${fdate(resa.date_arrivee)} → ${fdate(resa.date_depart)}).</div>` : ''}
      <div class="msg-grid">${list.map((m) => `
        <div class="card msg-card" style="--apt:${esc(S.aptById[m.appartement_id]?.couleur || '#34495e')}">
          <div class="msg-title"><h3>${esc(m.titre)}</h3>${aptChip(m.appartement_id)}</div>
          <div class="msg-body" data-body="${m.id}">${preview(m)}</div>
          <div class="msg-actions">
            <button class="primary" data-copy-model="${m.id}">📋 Copier</button>
            <button data-expand="${m.id}">Tout afficher</button>
            <span class="grow"></span>
            <button class="small ghost" data-edit-model="${m.id}" title="Modifier">✏️</button>
            <button class="small ghost" data-del-model="${m.id}" title="Supprimer">🗑</button>
          </div>
        </div>`).join('') || '<div class="empty">Aucun modèle.</div>'}
      </div>`;

    $('#msg-apt').onchange = (e) => { S.msg.apt = e.target.value; render(); };
    $('#msg-resa').onchange = (e) => { S.msg.resa = e.target.value; render(); };
    $('#new-model').onclick = () => editModel();
    $$('[data-copy-model]', view).forEach((b) => (b.onclick = () => {
      const m = S.modeles.find((x) => x.id === Number(b.dataset.copyModel));
      // Sans réservation, les variables non remplies sont retirées (le texte d'origine est restitué tel quel).
      const text = resa ? C.fillTemplate(m.corps, resa, S.aptById[resa.appartement_id]) : m.corps.replace(/\{[a-z_]+\}/g, '');
      copyText(text);
    }));
    $$('[data-expand]', view).forEach((b) => (b.onclick = () => { const el = $(`[data-body="${b.dataset.expand}"]`, view); el.classList.toggle('expanded'); b.textContent = el.classList.contains('expanded') ? 'Réduire' : 'Tout afficher'; }));
    $$('[data-edit-model]', view).forEach((b) => (b.onclick = () => editModel(S.modeles.find((x) => x.id === Number(b.dataset.editModel)))));
    $$('[data-del-model]', view).forEach((b) => (b.onclick = async () => {
      const m = S.modeles.find((x) => x.id === Number(b.dataset.delModel));
      if (!confirm(`Supprimer le modèle « ${m.titre} » ?`)) return;
      await api(`/api/modeles/${m.id}`, { method: 'DELETE' }).catch(fail);
    }));
  }

  function editModel(m = { titre: '', appartement_id: null, categorie: 'autre', corps: '' }) {
    const modal = openModal(`${modalHead(m.id ? 'Modifier le modèle' : 'Nouveau modèle')}
      <form id="model-form"><div class="modal-body">
        <div class="form-grid">
          <label class="field span-2">Titre<input name="titre" value="${esc(m.titre)}" required></label>
          <label class="field span-2">Appartement associé<select name="appartement_id">${aptOptions(m.appartement_id || '', 'Les deux')}</select></label>
        </div>
        <div><div class="small-text muted" style="margin-bottom:.3rem">Insérer une variable :</div><div class="var-list">${C.VARIABLES.map((x) => `<button type="button" data-var="${x}">{${x}}</button>`).join('')}</div></div>
        <label class="field">Texte (emojis et retours à la ligne conservés)<textarea class="message-editor" name="corps" required>${esc(m.corps)}</textarea></label>
      </div>
      <div class="modal-foot"><span class="grow"></span><button type="button" data-close>Annuler</button><button class="primary" type="submit">Enregistrer</button></div></form>`, { narrow: true });
    const form = $('#model-form', modal);
    $$('[data-var]', modal).forEach((b) => (b.onclick = () => {
      const ta = form.elements.corps;
      const ins = `{${b.dataset.var}}`;
      const s = ta.selectionStart;
      ta.value = ta.value.slice(0, s) + ins + ta.value.slice(ta.selectionEnd);
      ta.focus(); ta.setSelectionRange(s + ins.length, s + ins.length);
    }));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const body = { ...Object.fromEntries(new FormData(form).entries()), categorie: m.categorie };
      try {
        await api(m.id ? `/api/modeles/${m.id}` : '/api/modeles', { method: m.id ? 'PUT' : 'POST', body });
        toast('✓ Modèle enregistré');
        closeModal();
      } catch (err) { fail(err); }
    };
  }

  // ---------------------------------------------------------------- Comptabilité
  async function renderCompta(view) {
    const c = await api('/api/comptabilite?' + qs({ annee: S.compta.annee }));
    view.innerHTML = `
      <div class="page-head">
        <h1>💶 Comptabilité</h1>
        <select id="c-year" style="width:auto">${yearOptions(S.compta.annee)}</select>
        <a class="btn" href="/api/export/comptable.xlsx?annee=${c.annee}">⬇︎ Export comptable ${c.annee}</a>
        <button id="share-compta">🔗 Lien comptable</button>
      </div>
      <p class="muted small-text" style="margin-top:-.5rem">Recettes rattachées à l'année de <b>leur encaissement</b> (date de paiement de l'acompte et du solde), pour la déclaration en micro-entreprise. Cautions et taxe de séjour exclues.</p>
      <div class="grid cols-3">
        ${c.totaux.map((t) => { const a = S.apts.find((x) => x.nom === t.appartement); return `<div class="card kpi-card" style="--apt:${esc(a?.couleur)}"><div class="kpi"><div class="label">${esc(t.appartement)}</div><div class="value">${euro(t.total)}</div></div></div>`; }).join('')}
        <div class="card kpi-card"><div class="kpi"><div class="label">Total encaissé ${c.annee}</div><div class="value">${euro(c.total)}</div></div></div>
      </div>
      <div class="table-wrap" style="margin-top:1rem">
        <table class="data responsive"><thead><tr><th>Date</th><th>Appartement</th><th>Locataire</th><th>Séjour</th><th>Nature</th><th class="right">Montant</th></tr></thead>
        <tbody>${c.lignes.map((l) => `<tr><td data-label="Date">${fdate(l.date)}</td><td data-label="Appartement">${esc(l.appartement)}</td><td data-label="Locataire">${esc(l.locataire)}</td><td data-label="Séjour">S${l.semaine} · ${esc(l.sejour)}</td><td data-label="Nature">${esc(l.nature)}</td><td data-label="Montant" class="right nowrap">${euro(l.montant)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Aucun encaissement sur cette année.</td></tr>'}</tbody></table>
      </div>`;
    $('#c-year').onchange = (e) => { S.compta.annee = e.target.value; render(); };
    $('#share-compta').onclick = () => openShares('comptable');
  }

  // ---------------------------------------------------------------- Réglages
  async function renderReglages(view) {
    const [proprio, me] = await Promise.all([api('/api/reglages/proprietaire'), api('/api/me')]);
    S.contratApt = S.contratApt || S.apts[0]?.id;
    const example = (a) => {
      const t = C.touristTax({ date_arrivee: '2026-02-07', date_depart: '2026-02-14', nb_adultes: 2, nb_enfants: 2, montant_sejour: 1200 }, a);
      return `Exemple : séjour de 1 200 € · 7 nuits · 2 adultes + 2 enfants → nuitée ${euro(t.prixNuiteeParPersonne)}/pers., taxe ${euro(t.taxeParNuitParPersonne)}/nuit/adulte${t.plafonne ? ' (plafonnée)' : ''} → <b>${euro(t.total)}</b>`;
    };
    view.innerHTML = `
      <div class="page-head"><h1>⚙️ Réglages</h1></div>
      ${me.defaultPassword ? '<div class="banner">⚠️ Vous utilisez le mot de passe provisoire. Changez-le ci-dessous.</div>' : ''}
      <div class="grid cols-2">${S.apts.map((a) => `
        <form class="card kpi-card apt-form" data-apt="${a.id}" style="--apt:${esc(a.couleur)}">
          <h2><span class="dot" style="background:${esc(a.couleur)}"></span>${esc(a.nom)}</h2>
          <div class="form-grid">
            <label class="field span-2">Nom<input name="nom" value="${esc(a.nom)}" required></label>
            <label class="field">Caution (€)<input type="number" step="1" min="0" name="caution" value="${a.caution}"></label>
            <label class="field">Couleur<input type="color" name="couleur" value="${esc(a.couleur)}"></label>
            <label class="field span-4">Adresse complète du logement <span class="hint">(reprise dans le contrat)</span><input name="adresse" value="${esc(a.adresse)}"></label>
            <label class="field span-2">N° d'enregistrement Declaloc<input name="declaloc" value="${esc(a.declaloc)}" placeholder="ex. 73123000001AB"></label>
            <label class="field">Capacité (pers.)<input type="number" min="1" step="1" name="capacite" value="${a.capacite}"></label>
            <label class="field">Arrivée / départ<span class="row" style="gap:.3rem;flex-wrap:nowrap"><input name="heure_arrivee" value="${esc(a.heure_arrivee)}" aria-label="Heure d'arrivée"><input name="heure_depart" value="${esc(a.heure_depart)}" aria-label="Heure de départ"></span></label>
          </div>
          <h3 style="margin-top:1rem">Taxe de séjour (meublé non classé, au réel)</h3>
          <div class="form-grid">
            <label class="field">Taux communal (%)<input type="number" step="0.01" min="0" max="5" name="taux_communal" value="${a.taux_communal}"><span class="hint">entre 1 et 5 %</span></label>
            <label class="field">Plafond (€/pers./nuit)<input type="number" step="0.01" min="0" name="plafond_communal" value="${a.plafond_communal}"><span class="hint">tarif max voté</span></label>
            <label class="field">Taxe départ. (%)<input type="number" step="0.01" min="0" name="taux_departemental" value="${a.taux_departemental}"><span class="hint">additionnelle</span></label>
            <label class="field">Âge d'exonération<input type="number" step="1" min="0" name="age_exoneration" value="${a.age_exoneration}"><span class="hint">mineurs exonérés</span></label>
          </div>
          <p class="small-text muted">${example(a)}</p>
          <p class="small-text muted">⚠️ Barèmes réévalués chaque année : vérifiez les délibérations de la commune et du département.</p>
          <div class="row"><span class="grow"></span><button class="primary" type="submit">Enregistrer</button></div>
        </form>`).join('')}
      </div>
      <div class="grid cols-2" style="margin-top:1rem">
        <form class="card" id="owner-form">
          <h2>👤 Propriétaire (en-tête des contrats)</h2>
          <div class="form-grid">
            <label class="field span-2">Nom<input name="nom" value="${esc(proprio.nom)}" autocomplete="family-name"></label>
            <label class="field span-2">Prénom<input name="prenom" value="${esc(proprio.prenom)}" autocomplete="given-name"></label>
            <label class="field span-4">Adresse<input name="adresse" value="${esc(proprio.adresse)}" autocomplete="street-address"></label>
            <label class="field span-2">Téléphone<input type="tel" name="telephone" value="${esc(proprio.telephone)}"></label>
            <label class="field span-2">E-mail<input type="email" name="email" value="${esc(proprio.email)}"></label>
            <label class="field span-2">Lieu de signature<input name="lieu_signature" value="${esc(proprio.lieu_signature)}" placeholder="« Fait à … »"></label>
          </div>
          <div class="row" style="margin-top:.6rem"><span class="grow"></span><button class="primary" type="submit">Enregistrer</button></div>
          <p class="small-text muted">Ces informations restent dans la base de l'application (jamais dans le code source).</p>
        </form>
        <div class="card">
          <h2>✍️ Signature</h2>
          <p class="small-text muted" style="margin-top:0">Image de votre signature (PNG sur fond transparent ou blanc), apposée automatiquement dans les PDF de contrat.</p>
          <div class="signature-box">${proprio.signature ? `<img src="/api/reglages/signature?t=${Date.now()}" alt="Signature enregistrée">` : '<span class="muted small-text">Aucune signature enregistrée</span>'}</div>
          <div class="row" style="margin-top:.6rem">
            <input type="file" id="sig-file" accept="image/png,image/jpeg" class="grow">
            <button type="button" id="sig-upload">⬆︎ Enregistrer</button>
            ${proprio.signature ? '<button type="button" class="danger" id="sig-delete">Retirer</button>' : ''}
          </div>
        </div>
      </div>
      <form class="card" id="contract-form" style="margin-top:1rem">
        <div class="row" style="margin-bottom:.5rem"><h2 class="grow" style="margin:0">📄 Modèle de contrat de location</h2>
          <select id="contract-apt" style="width:auto">${S.apts.map((a) => `<option value="${a.id}" ${String(a.id) === String(S.contratApt) ? 'selected' : ''}>${esc(a.nom)}</option>`).join('')}</select></div>
        <p class="small-text muted">Un modèle par appartement, utilisé par le bouton « Contrat » de chaque réservation. Mise en forme : <code># Titre</code>, <code>## Intertitre</code>, <code>**gras**</code>, <code>[SIGNATURES]</code>, <code>[SAUT DE PAGE]</code>. Cliquez sur une variable pour l'insérer :</p>
        <div class="var-list" style="margin-bottom:.6rem">${proprio.variables.map((x) => `<button type="button" data-var="${x}">{${x}}</button>`).join('')}</div>
        <textarea name="texte" class="message-editor" style="min-height:28rem">${esc(S.aptById[S.contratApt]?.contrat || '')}</textarea>
        <div class="row" style="margin-top:.6rem"><button type="button" id="contract-default" class="ghost">↺ Restaurer le modèle d'origine</button><span class="grow"></span><button class="primary" type="submit">Enregistrer le modèle</button></div>
      </form>
      <div class="grid cols-2" style="margin-top:1rem">
        <form class="card" id="pw-form">
          <h2>🔒 Mot de passe</h2>
          <div class="grid">
            <label class="field">Mot de passe actuel<input type="password" name="actuel" autocomplete="current-password" required></label>
            <label class="field">Nouveau mot de passe (8 caractères min.)<input type="password" name="nouveau" autocomplete="new-password" minlength="8" required></label>
          </div>
          <div class="row" style="margin-top:.6rem"><span class="grow"></span><button class="primary" type="submit">Changer</button></div>
        </form>
        <div class="card">
          <h2>🔗 Liens de partage</h2>
          <p class="small-text muted">Liens en lecture seule, révocables à tout moment.</p>
          <div class="row"><button id="rg-share-menage">🧹 Liens ménage</button><button id="rg-share-compta">💶 Liens comptable</button></div>
        </div>
      </div>`;

    $$('.apt-form', view).forEach((f) => (f.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/api/appartements/${f.dataset.apt}`, { method: 'PUT', body: Object.fromEntries(new FormData(f).entries()) });
        toast('✓ Appartement enregistré');
      } catch (err) { fail(err); }
    }));
    const cf = $('#contract-form');
    $$('[data-var]', cf).forEach((b) => (b.onclick = () => {
      const ta = cf.elements.texte; const ins = `{${b.dataset.var}}`; const s = ta.selectionStart;
      ta.value = ta.value.slice(0, s) + ins + ta.value.slice(ta.selectionEnd); ta.focus(); ta.setSelectionRange(s + ins.length, s + ins.length);
    }));
    $('#contract-apt').onchange = (e) => { S.contratApt = e.target.value; cf.elements.texte.value = S.aptById[S.contratApt].contrat || ''; };
    $('#contract-default').onclick = async () => {
      if (!confirm("Remplacer le texte par le modèle d'origine ? (il ne sera enregistré qu'en cliquant sur « Enregistrer le modèle »)")) return;
      cf.elements.texte.value = (await api(`/api/contrats/modele-defaut/${S.contratApt}`)).texte;
    };
    cf.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const a = await api(`/api/appartements/${S.contratApt}`, { method: 'PUT', body: { contrat: cf.elements.texte.value } });
        S.aptById[a.id].contrat = a.contrat;
        toast('✓ Modèle de contrat enregistré');
      } catch (err) { fail(err); }
    };
    $('#owner-form').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('/api/reglages/proprietaire', { method: 'PUT', body: Object.fromEntries(new FormData(e.target).entries()) }); toast('✓ Propriétaire enregistré'); } catch (err) { fail(err); }
    };
    $('#sig-upload').onclick = async () => {
      const file = $('#sig-file').files[0];
      if (!file) return toast('Choisissez une image.', true);
      const fd = new FormData();
      fd.append('fichier', file);
      try { await api('/api/reglages/signature', { method: 'POST', form: fd }); toast('✓ Signature enregistrée'); render(); } catch (err) { fail(err); }
    };
    if ($('#sig-delete')) $('#sig-delete').onclick = async () => { await api('/api/reglages/signature', { method: 'DELETE' }).catch(fail); render(); };
    $('#pw-form').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('/api/reglages/mot-de-passe', { method: 'PUT', body: Object.fromEntries(new FormData(e.target).entries()) }); toast('✓ Mot de passe modifié'); e.target.reset(); } catch (err) { fail(err); }
    };
    $('#rg-share-menage').onclick = () => openShares('menage');
    $('#rg-share-compta').onclick = () => openShares('comptable');
  }

  // ---------------------------------------------------------------- Démarrage
  let events;
  function showLogin() {
    $('#shell').hidden = true;
    $('#login').hidden = false;
    if (events) { events.close(); events = null; }
  }
  async function start() {
    $('#login').hidden = true;
    $('#shell').hidden = false;
    await loadBase();
    if (!events) {
      events = new EventSource('/api/events');
      events.addEventListener('change', refreshSoon);
    }
    render();
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#login-error').textContent = '';
    try {
      await api('/api/login', { method: 'POST', body: { password: e.target.password.value } });
      e.target.reset();
      start();
    } catch (err) { $('#login-error').textContent = err.message; }
  });
  $('#logout').addEventListener('click', async (e) => { e.preventDefault(); await api('/api/logout', { method: 'POST' }).catch(() => {}); showLogin(); });
  $('#menu-toggle').addEventListener('click', () => document.body.classList.toggle('menu-open'));
  $('#new-resa').addEventListener('click', () => openReservation(null));
  let searchTimer;
  $('#global-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      S.dos.q = e.target.value;
      if (currentRoute() !== 'dossiers') location.hash = '#/dossiers';
      else render();
    }, 300);
  });
  window.addEventListener('hashchange', render);

  api('/api/me').then((me) => (me.authenticated ? start() : showLogin())).catch(showLogin);
})();
