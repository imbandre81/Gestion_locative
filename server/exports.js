// Exports Excel (ExcelJS) et PDF (PDFKit).
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Calc = require('../public/calc');

const yesNo = (b) => (b ? 'Oui' : 'Non');
const withDate = (b, d) => (b ? `Oui${d ? ' (' + Calc.formatDate(d) + ')' : ''}` : 'Non');

/** Colonnes du tableau récapitulatif (vue C). */
function recapColumns() {
  return [
    { header: 'Semaine', width: 11, pdf: 48, value: (r) => `S${r.semaine} · ${Calc.formatDate(r.date_arrivee).slice(0, 5)}→${Calc.formatDate(r.date_depart).slice(0, 5)}` },
    { header: 'Appartement', width: 16, pdf: 56, value: (r) => r.appartement_nom },
    { header: 'Locataire', width: 22, pdf: 70, value: (r) => r.nom_locataire },
    { header: 'Téléphone', width: 15, pdf: 58, value: (r) => r.telephone },
    { header: 'CNI reçue', width: 14, pdf: 44, value: (r) => withDate(r.cni_recue, r.cni_date) },
    { header: 'Contrat signé', width: 14, pdf: 44, value: (r) => withDate(r.contrat_signe, r.contrat_date) },
    { header: 'Acompte 30 %', width: 20, pdf: 60, value: (r) => `${Calc.formatEuro(r.montant_acompte)} ${r.acompte_paye ? '✓' : '✗'}`, pdfValue: (r) => `${Calc.formatEuro(r.montant_acompte)} ${r.acompte_paye ? 'payé' : 'dû'}` },
    { header: 'Solde', width: 20, pdf: 60, value: (r) => `${Calc.formatEuro(r.montant_solde)} ${r.solde_paye ? '✓' : '✗'}`, pdfValue: (r) => `${Calc.formatEuro(r.montant_solde)} ${r.solde_paye ? 'payé' : 'dû'}` },
    { header: 'Taxe de séjour', width: 13, pdf: 46, value: (r) => Calc.formatEuro(r.taxe_sejour) },
    { header: 'Pers.', width: 8, pdf: 30, value: (r) => `${r.nb_personnes} (${r.nb_adultes}A+${r.nb_enfants}E)` },
    { header: 'Ménage', width: 9, pdf: 34, value: (r) => yesNo(r.menage_inclus) },
    { header: 'Infos diverses', width: 30, pdf: 70, value: (r) => r.infos },
    { header: 'Statut', width: 20, pdf: 52, value: (r) => r.statut.label },
  ];
}

async function workbookToBuffer(wb) {
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function styleHeader(ws) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };
  row.alignment = { vertical: 'middle', wrapText: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}

const STATUS_FILL = { green: 'FFD5F0DD', orange: 'FFFDEBD0', red: 'FFF9D6D5' };

async function reservationsXlsx(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestion locative';
  const ws = wb.addWorksheet('Réservations');
  const cols = recapColumns();
  ws.columns = [
    ...cols.map((c) => ({ header: c.header, width: c.width })),
    { header: 'Arrivée', width: 12 }, { header: 'Départ', width: 12 }, { header: 'Nuits', width: 7 },
    { header: 'Montant séjour', width: 14 }, { header: 'Caution reçue', width: 14 }, { header: 'Caution rendue', width: 14 }, { header: 'E-mail', width: 26 },
  ];
  for (const r of rows) {
    const row = ws.addRow([
      ...cols.map((c) => c.value(r)),
      Calc.parseDate(r.date_arrivee), Calc.parseDate(r.date_depart), r.nuits, r.montant_sejour,
      withDate(r.caution_recue, r.caution_recue_date), withDate(r.caution_rendue, r.caution_rendue_date), r.email,
    ]);
    row.getCell(cols.length).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL[r.statut.color] } };
  }
  ws.getColumn(cols.length + 1).numFmt = 'dd/mm/yyyy';
  ws.getColumn(cols.length + 2).numFmt = 'dd/mm/yyyy';
  ws.getColumn(cols.length + 4).numFmt = '#,##0.00 €';
  styleHeader(ws);
  ws.eachRow((row, i) => { if (i > 1 && i % 2 === 0) row.eachCell((c) => { if (!c.fill || c.fill.type !== 'pattern') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F6F8' } }; }); });
  return workbookToBuffer(wb);
}

async function comptableXlsx(compta) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Recettes ${compta.annee}`);
  ws.columns = [
    { header: 'Date encaissement', width: 18 }, { header: 'Appartement', width: 16 }, { header: 'Locataire', width: 24 },
    { header: 'Semaine', width: 9 }, { header: 'Séjour', width: 24 }, { header: 'Nature', width: 14 }, { header: 'Montant', width: 13 },
  ];
  for (const l of compta.lignes) ws.addRow([Calc.parseDate(l.date), l.appartement, l.locataire, l.semaine, l.sejour, l.nature, l.montant]);
  ws.getColumn(1).numFmt = 'dd/mm/yyyy';
  ws.getColumn(7).numFmt = '#,##0.00 €';
  styleHeader(ws);

  const sum = wb.addWorksheet('Synthèse');
  sum.columns = [{ header: 'Appartement', width: 22 }, { header: `Total encaissé ${compta.annee}`, width: 22 }];
  for (const t of compta.totaux) sum.addRow([t.appartement, t.total]);
  const tot = sum.addRow(['TOTAL', compta.total]);
  tot.font = { bold: true };
  sum.getColumn(2).numFmt = '#,##0.00 €';
  styleHeader(sum);
  sum.autoFilter = undefined;
  return workbookToBuffer(wb);
}

/** Dessine un tableau paginé dans un PDF. */
function pdfTable(doc, columns, rows, { rowFill } = {}) {
  const left = doc.page.margins.left;
  const bottom = doc.page.height - doc.page.margins.bottom;
  const avail = doc.page.width - left - doc.page.margins.right;
  const total = columns.reduce((s, c) => s + c.pdf, 0);
  const widths = columns.map((c) => (c.pdf / total) * avail);
  const pad = 3;

  const drawHeader = () => {
    doc.font('Helvetica-Bold').fontSize(7.5);
    const h = Math.max(...columns.map((c, i) => doc.heightOfString(c.header, { width: widths[i] - 2 * pad }))) + 2 * pad;
    doc.rect(left, doc.y, avail, h).fill('#34495e');
    let x = left;
    const y = doc.y;
    columns.forEach((c, i) => { doc.fillColor('#fff').text(c.header, x + pad, y + pad, { width: widths[i] - 2 * pad }); x += widths[i]; });
    doc.y = y + h;
    doc.font('Helvetica').fontSize(7.5).fillColor('#222');
  };

  drawHeader();
  rows.forEach((r, idx) => {
    const values = columns.map((c) => String((c.pdfValue || c.value)(r) ?? ''));
    const h = Math.max(...values.map((v, i) => doc.heightOfString(v, { width: widths[i] - 2 * pad }))) + 2 * pad;
    if (doc.y + h > bottom) { doc.addPage(); drawHeader(); }
    const y = doc.y;
    const fill = rowFill ? rowFill(r, idx) : (idx % 2 ? '#f4f6f8' : null);
    if (fill) doc.rect(left, y, avail, h).fill(fill);
    let x = left;
    values.forEach((v, i) => { doc.fillColor('#222').text(v, x + pad, y + pad, { width: widths[i] - 2 * pad }); x += widths[i]; });
    doc.moveTo(left, y + h).lineTo(left + avail, y + h).lineWidth(0.3).strokeColor('#d0d5da').stroke();
    doc.y = y + h;
  });
  if (!rows.length) doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666').text('Aucune ligne.', left, doc.y + 8);
}

function pdfBuffer(build, options = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 30, ...options });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    build(doc);
    doc.end();
  });
}

function title(doc, text, sub) {
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#222').text(text);
  if (sub) doc.font('Helvetica').fontSize(9).fillColor('#666').text(sub);
  doc.moveDown(0.6);
}

const STATUS_PDF = { green: '#e3f5e8', orange: '#fdf1dd', red: '#fbe2e1' };

function reservationsPdf(rows, subtitle) {
  return pdfBuffer((doc) => {
    title(doc, 'Tableau récapitulatif des réservations', subtitle);
    pdfTable(doc, recapColumns(), rows, { rowFill: (r) => STATUS_PDF[r.statut.color] });
  }, { layout: 'landscape' });
}

function menagePdf(rows, subtitle) {
  const cols = [
    { header: 'Semaine', pdf: 70, value: (r) => `S${r.semaine} · ${Calc.formatDate(r.date_arrivee)} → ${Calc.formatDate(r.date_depart)}` },
    { header: 'Appartement', pdf: 45, value: (r) => r.appartement },
    { header: 'Nom du locataire', pdf: 60, value: (r) => r.locataire },
    { header: 'Téléphone', pdf: 45, value: (r) => r.telephone },
  ];
  return pdfBuffer((doc) => {
    title(doc, 'Planning ménage', subtitle);
    pdfTable(doc, cols, rows);
  });
}

/** Écrit une ligne en gérant le **gras** en ligne. */
function richLine(doc, line, opts = {}) {
  const parts = line.split(/(\*\*[^*]+\*\*)/).filter((p) => p !== '');
  if (!parts.length) return doc.text(' ', opts);
  // Mélange gras/normal : PDFKit perd les espaces aux jonctions et justifie mal les segments « continued ».
  const o = parts.length > 1 ? { ...opts, align: 'left' } : opts;
  parts.forEach((p, i) => {
    const bold = /^\*\*[^*]+\*\*$/.test(p);
    const txt = (bold ? p.slice(2, -2) : p).replace(/^ /, '\u00a0').replace(/ $/, '\u00a0');
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(txt, { ...o, continued: i < parts.length - 1 });
  });
  doc.font('Helvetica');
}

/**
 * Contrat en PDF à partir du texte balisé :
 * « # » titre, « ## » intertitre, **gras**, [SIGNATURES], [SAUT DE PAGE].
 */
function contratPdf(text, { titre, locataire, signature } = {}) {
  return pdfBuffer((doc) => {
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const signatures = () => {
      const h = 95;
      if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
      doc.moveDown(0.8);
      const y = doc.y;
      const col = width / 2;
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#222');
      doc.text('Le propriétaire', left, y, { width: col - 10 });
      doc.text('Le locataire (« lu et approuvé »)', left + col, y, { width: col - 10 });
      if (signature) {
        try { doc.image(signature, left, y + 16, { fit: [150, 60] }); } catch { /* image illisible : on l'ignore */ }
      }
      doc.font('Helvetica').fontSize(8.5).fillColor('#666').text(locataire || '', left + col, y + 70, { width: col - 10 });
      doc.fillColor('#222').fontSize(10);
      doc.x = left;
      doc.y = y + h;
    };

    doc.fontSize(10).fillColor('#222');
    for (const raw of String(text).split('\n')) {
      const line = raw.replace(/\s+$/, '');
      if (line.trim() === '[SAUT DE PAGE]') { doc.addPage(); continue; }
      if (line.trim() === '[SIGNATURES]') { signatures(); continue; }
      if (line.startsWith('# ')) {
        doc.font('Helvetica-Bold').fontSize(14).text(line.slice(2), left, doc.y, { width, align: 'center' });
        doc.fontSize(10).moveDown(0.3);
        continue;
      }
      if (line.startsWith('## ')) {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
        doc.moveDown(0.5).font('Helvetica-Bold').fontSize(10.5).fillColor('#1f3b57').text(line.slice(3), left, doc.y, { width, underline: true });
        doc.fillColor('#222').fontSize(10).font('Helvetica').moveDown(0.25);
        continue;
      }
      if (!line.trim()) { doc.moveDown(0.45); continue; }
      doc.x = left;
      richLine(doc, line, { width, align: 'justify', paragraphGap: 2, lineGap: 1 });
    }
  }, { margin: 50, info: { Title: titre || 'Contrat de location saisonnière' } });
}

module.exports = { reservationsXlsx, reservationsPdf, menagePdf, comptableXlsx, contratPdf };
