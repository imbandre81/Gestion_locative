# Gestion locative — La Giettaz & Les Deux Alpes

Application web d'administration **interne** (non publique) pour gérer la location saisonnière de deux meublés de tourisme.
Une seule administratrice (Isabelle), plus des liens de consultation en lecture seule pour le ménage et, si besoin, le comptable.

## Démarrage

Prérequis : Node.js ≥ 22.13 (la base SQLite est intégrée à Node, rien à compiler).

```bash
npm install
ADMIN_PASSWORD='un-mot-de-passe-solide' npm start   # http://localhost:3000
npm test                                             # tests des calculs et de l'API
```

| Variable | Rôle | Défaut |
|---|---|---|
| `ADMIN_PASSWORD` | mot de passe de connexion (modifiable ensuite dans Réglages) | `isabelle` (provisoire, bannière d'alerte) |
| `PORT` | port HTTP | `3000` |
| `DATA_DIR` | dossier de la base `gestion.sqlite` et des documents joints | `./data` |
| `COOKIE_SECURE` | `1` quand l'application est servie en HTTPS | — |

**Sauvegarde** : il suffit de copier le dossier `data/` (base + pièces jointes).
Pour un accès depuis le téléphone, héberger derrière un reverse proxy HTTPS (Caddy, Nginx…) sur un petit serveur ou un NAS.

## Fonctionnalités

- **Tableau de bord** : par appartement et par année, semaines louées, taux d'occupation, encaissé et reste à encaisser, taxe de séjour ; alertes en cours ; arrivées et départs des 60 prochains jours ; comparatif des revenus d'une année sur l'autre.
- **Calendrier** : vue mensuelle (barres de l'arrivée au départ avec le nom du locataire) et planning annuel (semaines du samedi au samedi). Un appartement ou les deux superposés. La couleur de fond indique le statut, la bordure l'appartement. Un clic ouvre la fiche, un clic sur un jour libre crée une réservation.
- **Dossiers** : le tableau récapitulatif complet. Tri, filtres (appartement, année, statut, recherche) et badges colorés. Un clic sur un badge coche ou décoche la case, après confirmation. Export Excel et PDF du tableau filtré.
- **Fiche réservation** : la semaine, les nuits, le nombre de personnes, l'acompte (30 %), le solde (70 %) et la taxe de séjour se calculent en direct. Cocher une case renseigne la date du jour. On y suit aussi la caution (reçue, encaissée, rendue) et on y joint des documents (CNI, contrat signé ou envoyé, RIB). Deux boutons : « Générer le message » et « Contrat » (pré-rempli, téléchargeable en PDF).
- **Ménage** : vue dérivée automatiquement, avec uniquement la semaine, le nom et le téléphone. Mise à jour en temps réel. Bouton « Partager » : lien en lecture seule, révocable, envoyable par SMS ou WhatsApp. Export PDF.
- **Messages** : les 7 modèles fournis, emojis conservés, avec un bouton « Copier » en un clic. Chaque modèle peut être rempli avec une réservation. On peut modifier les modèles, en créer et insérer des variables `{prenom_locataire}`, `{date_arrivee}`, `{montant_acompte}`, etc.
- **Comptabilité** : recettes rattachées à l'année d'encaissement (utile pour la déclaration micro-entreprise). Export Excel et lien comptable en lecture seule.
- **Réglages** : pour chaque appartement, caution, couleur, adresse, n° Declaloc et barème de taxe de séjour (taux communal, plafond, taux départemental, âge d'exonération). On y trouve aussi le modèle de contrat et le mot de passe.

## Règles de calcul

- Acompte = montant × 30 % (arrondi au centime) ; solde = montant − acompte.
- Taxe de séjour (meublé non classé, au réel) : nuitée/pers. = montant ÷ nuits ÷ occupants.
  Taxe/nuit/adulte = min(nuitée × taux communal, plafond).
  Base = taxe/nuit × nuits × adultes (mineurs exonérés).
  Total = base + base × taux départemental, arrondi au centime.
- Statut : **vert** quand toutes les pièces sont reçues (CNI, contrat, acompte, solde, caution). **Orange** tant qu'une pièce est attendue. **Rouge** si le solde n'est pas payé à J-30 de l'arrivée, ou si des pièces manquent le jour de l'arrivée.
- Alertes : dossier incomplet (urgent à J-30), solde à réclamer, caution non reçue (avec le montant attendu), caution à rendre après le séjour.

> ⚠️ Les barèmes de taxe de séjour préremplis (5 %, plafond 2,30 €, +10 % départemental) sont des valeurs indicatives : vérifiez les délibérations 2026 de La Giettaz et des Deux Alpes dans **Réglages**.

## Architecture

- `server/` : Express, SQLite (`node:sqlite`), exports ExcelJS/PDFKit, authentification par cookie signé, temps réel par Server-Sent Events.
- `public/` : interface monopage sans framework ni étape de build ; `calc.js` contient les calculs, partagés entre le navigateur et le serveur.
- `test/` : tests `node:test`.
