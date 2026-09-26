// Modèles de contrat de location saisonnière (un par appartement), repris des contrats d'Isabelle
// et complétés des mentions usuelles des contrats types (art. L. 324-2 du Code du tourisme :
// contrat écrit, prix, état descriptif des lieux ; numéro d'enregistrement ; taxe de séjour).
//
// Mise en forme :  « # » titre · « ## » intertitre · **gras** · [SIGNATURES] · [SAUT DE PAGE]
// Aucune donnée personnelle ici : l'identité du propriétaire et les adresses se règlent dans l'application.

const ENTETE = `# CONTRAT DE LOCATION SAISONNIÈRE & CONDITIONS GÉNÉRALES
Meublé de tourisme non classé — {appartement} — N° d'enregistrement : {declaloc}

## ENTRE LE PROPRIÉTAIRE
Nom : **{proprietaire_nom}**    Prénom : **{proprietaire_prenom}**
Adresse : {proprietaire_adresse}
Tél. : {proprietaire_telephone} — Mail : {proprietaire_email}

## ET LE(S) LOCATAIRE(S)
Nom prénom : **{locataire_complet}**
Adresse : {adresse_locataire}
Tél. : {telephone} — Mail : {email}
`;

const DUREE = (logement) => `
## OBJET ET DURÉE
Il a été convenu d'une location saisonnière d'${logement} pour **{capacite} personnes maximum**, pour la période du **{date_arrivee}** (arrivée à partir de {heure_arrivee}) au **{date_depart}** (départ avant {heure_depart}), soit {nb_nuits} nuits (semaine {semaine}).
Nombre d'occupants prévus : {nb_personnes} ({detail_occupants}). Ce nombre ne pourra être dépassé sans l'accord écrit du propriétaire.
Adresse de la location : **{adresse}**
La location est consentie à titre saisonnier : elle prend fin de plein droit à la date indiquée ci-dessus, sans que le locataire puisse se prévaloir d'un quelconque droit au maintien dans les lieux.
`;

const CG_COMMUNES = `
d) Les locaux sont loués meublés avec matériel de cuisine, vaisselle, verrerie, couettes et oreillers, tels qu'ils figurent dans l'état descriptif ci-après et dans le livret d'accueil. S'il y a lieu, le propriétaire ou son représentant seront en droit de réclamer au locataire, à son départ, le prix du nettoyage des locaux loués, la valeur totale au prix de remplacement des objets, mobiliers ou matériels cassés, fêlés, ébréchés ou détériorés et ceux dont l'usure dépasserait la normale pour la durée de la location, le prix de nettoyage des couvertures rendues sales, une indemnité pour les détériorations de toute nature concernant les rideaux, papiers peints, plafonds, tapis, moquette, vitres, literie, etc.`;

const CG_FIN = `
h) Le locataire ne peut ni sous-louer, ni céder le bénéfice du présent contrat, ni y héberger un nombre de personnes supérieur à celui indiqué, sauf accord écrit du propriétaire.
i) La taxe de séjour est perçue par le propriétaire pour le compte de la commune, qui en fixe le tarif ; elle est reversée à la collectivité. Les personnes mineures en sont exonérées.
j) En cas de litige, les parties rechercheront d'abord une solution amiable. À défaut, le tribunal compétent est celui du lieu de situation du logement.
`;

const GIETTAZ = `${ENTETE}${DUREE('un logement')}
## PRIX ET CONDITIONS DE PAIEMENT
Prix du séjour : **{montant_sejour}** charges comprises ({menage}), à l'exclusion de la taxe de séjour reversée à la mairie de la commune (d'un montant de **{taxe_sejour}** pour {detail_occupants}, mineurs exonérés).
**Un acompte de 30 %** est versé par le locataire pour valider la réservation. Cette somme de **{montant_acompte}** est perdue en cas de désistement.
**La photocopie de la carte d'identité** du titulaire du contrat est demandée lors de la réservation de l'appartement.
**Le solde du loyer de {solde_avec_taxe}** (taxe de séjour incluse) ainsi qu'un **dépôt de garantie de {montant_caution}** devront être versés au plus tard 1 mois avant votre arrivée, soit **avant le {date_limite_solde}**. Le dépôt de garantie ne sera pas encaissé sauf en cas de détérioration dans l'appartement ou de ménage non fait.

Ci-joint les conditions générales de location (dont un exemplaire est à retourner signé) et l'état descriptif des lieux loués.

Fait en deux exemplaires à {lieu_signature}, le {date_du_jour}.
[SIGNATURES]
[SAUT DE PAGE]
## CONDITIONS GÉNÉRALES DE LOCATION
La présente location est faite aux conditions listées ci-dessous. Le locataire s'engage par sa signature à respecter ces conditions, sous peine de résiliation du contrat sans remboursement des sommes versées.
a) L'heure de départ est prévue à {heure_depart} au plus tard le samedi matin et celle d'arrivée est normalement prévue le samedi à partir de {heure_arrivee} (selon l'heure de passage de la personne chargée du ménage lorsque cette option a été choisie).
b) Il est convenu qu'en cas de désistement :
- à plus d'un mois avant la prise d'effet de la location, le locataire perd l'acompte versé ;
- à moins d'un mois avant la prise d'effet de la location, le locataire versera en outre la différence entre l'acompte et l'équivalent du loyer total, à titre de clause pénale, sauf en cas de relocation.
c) Obligation d'occuper les lieux personnellement, de les habiter en « bon père de famille » et de les entretenir. Toutes les installations sont en bon état de marche et toute réclamation les concernant survenant plus de 24 h après l'entrée en jouissance des lieux ne pourra être admise. Les réparations rendues nécessaires par la négligence ou le mauvais entretien en cours de location seront à la charge du locataire.${CG_COMMUNES}
e) Le locataire s'engage à s'assurer contre les risques locatifs (incendie, dégât des eaux). Le défaut d'assurance, en cas de sinistre, donnera lieu à des dommages et intérêts. Le propriétaire s'engage à assurer le logement contre les risques locatifs pour le compte du locataire, ce dernier ayant l'obligation de lui signaler, dans les 24 h, tout sinistre survenu dans le logement, ses dépendances ou accessoires.
f) Le dépôt de garantie est versé par chèque. Il sera restitué ou détruit au plus tard 1 mois après le départ du locataire, sauf en cas de retenue justifiée.
g) Obligation de veiller à ce que la tranquillité du voisinage ne soit pas troublée par le fait du locataire ou de sa famille, ce qui implique l'interdiction de jeter quoi que ce soit par la fenêtre ou le balcon.${CG_FIN}
[SIGNATURES]
[SAUT DE PAGE]
## ÉTAT DESCRIPTIF DE LA LOCATION
Adresse de la location : {adresse}
**Type de location :** appartement au 3e étage d'un chalet, copropriété fermée par une barrière.
**Capacité :** {capacite} personnes.
**Surface habitable :** 36 m² loi Carrez — 58 m² au sol + balcon.
**Détail des pièces :** 1 chambre séparée 2 couchages, 1 chambre 2 couchages, 1 mezzanine 2 couchages, 1 coin salon 2 couchages, 1 cuisine équipée pour 8 personnes, 1 WC, 1 salle de bain avec douche.
**Équipements :** 2 télévisions écran plat, 1 clé Google Chromecast, 1 lecteur DVD, un lot de DVD, 1 décodeur TNT, 1 lave-vaisselle, 1 réfrigérateur, 1 plaque de cuisson, 1 grille-pain, 2 cafetières (Nespresso et Tassimo), 1 bouilloire, vaisselle pour 8 personnes, 1 lave et sèche-linge, 4 appareils à raclette 2 personnes, 2 appareils à fondue, 1 crêpière, 1 batteur électrique, 1 aspirateur, 1 sèche-cheveux, 8 chaises de bar, 1 buffet, 1 commode, 1 lit parapluie, 1 chaise haute, 1 réducteur de WC, 8 paires de bâtons de randonnée, 7 paires de raquettes, 5 luges, 1 barbecue, 1 enceinte BOSE. Tout l'équipement est en très bon état de fonctionnement.
**Annexes :** local à ski au rez-de-chaussée de l'immeuble (3 jeux de clés fournis dans l'appartement, à laisser obligatoirement en fin de séjour ; valeur de remplacement : 30 €).
**Linge de maison fourni :** non — **Produits de ménage :** fournis — **Chauffage :** oui — **Wifi :** oui.
**Accès :** porte d'entrée fermée par un verrou à code (pas de remise de clé), code communiqué avant l'arrivée. La copropriété est fermée par une barrière dont le bip doit être rendu en fin de séjour (valeur 60 €) sur le crochet dans l'entrée.

## ÉTAT DES LIEUX
Seul un état des lieux de sortie sans anomalie permet la restitution complète du dépôt de garantie. Une photo de chaque pièce, des clés reposées sur le crochet et de l'intérieur du réfrigérateur est demandée au moment du départ.
[SIGNATURES]
`;

const DEUX_ALPES = `${ENTETE}${DUREE('un logement en duplex')}
## PRIX ET CONDITIONS DE PAIEMENT
Prix du séjour : **{montant_sejour}** charges comprises et **{menage_majuscules}**, à l'exclusion de la taxe de séjour qui est calculée en fonction du nombre d'occupants (**{taxe_sejour}** pour {detail_assujettis}) puis reversée à la mairie.
**Un acompte de 30 %** est versé par le locataire pour la réservation. Cette somme de **{montant_acompte}** est perdue en cas de désistement.
**La photocopie de la carte d'identité** au nom du titulaire du contrat est demandée lors de la réservation de l'appartement. L'acompte et la photocopie de la carte d'identité valent validation de la réservation.
**Le solde du loyer de {solde_avec_taxe}** (comprenant la taxe de séjour de {taxe_sejour}) ainsi que le **dépôt de garantie de {montant_caution}** devront être envoyés au plus tard 1 mois avant votre arrivée, soit **avant le {date_limite_solde}**. Le dépôt de garantie ne sera pas encaissé sauf en cas de détérioration dans l'appartement ou de perte d'un bien, de ménage non fait (si pas de forfait ménage) ou de perte des clés de casier ou du bip du portail.

Ci-joint les conditions générales de location (dont un exemplaire est à retourner signé) et l'état descriptif des lieux loués.

Fait en deux exemplaires à {lieu_signature}, le {date_du_jour}.
[SIGNATURES]
[SAUT DE PAGE]
## CONDITIONS GÉNÉRALES DE LOCATION
La présente location est faite aux conditions ordinaires et de droit en pareille matière, et notamment à celles ci-après que le locataire s'oblige à exécuter, sous peine de tous dommages et intérêts et même de résiliation des présentes, si bon semble au propriétaire, et sans pouvoir réclamer la diminution du loyer.
a) Les arrivées sont prévues le samedi après-midi à partir de {heure_arrivee}. Les départs sont prévus le samedi matin avant {heure_depart} (laps de temps nécessaire au ménage).
b) Il est convenu qu'en cas de désistement :
- à plus d'un mois avant la prise d'effet de la location, le locataire perd l'acompte versé ;
- à moins d'un mois avant la prise d'effet de la location, le locataire versera en outre la différence entre l'acompte et l'équivalent du loyer total, à titre de clause pénale, sauf en cas de relocation.
c) Obligation d'occuper les lieux personnellement, de les habiter en « bon père de famille » et de les entretenir. Toutes les installations sont en état de marche et toute réclamation les concernant survenant plus de 24 h après l'entrée en jouissance des lieux ne pourra être admise. Les réparations rendues nécessaires par la négligence ou le mauvais entretien en cours de location seront à la charge du locataire.${CG_COMMUNES}
e) Le propriétaire s'engage à assurer le logement contre les risques locatifs pour le compte du locataire, ce dernier ayant l'obligation de lui signaler, dans les 24 h, tout sinistre survenu dans le logement, ses dépendances ou accessoires.
f) Le dépôt de garantie est versé par chèque. Il sera restitué ou détruit au plus tard 1 mois après le départ du locataire, sauf en cas de retenue justifiée.
g) Obligation de veiller à ce que la tranquillité du voisinage ne soit pas troublée par le fait du locataire ou de sa famille.${CG_FIN}
[SIGNATURES]
[SAUT DE PAGE]
## ÉTAT DESCRIPTIF DE LA LOCATION
Adresse de la location : {adresse}
**Type de location :** appartement en duplex situé aux 3e et 4e étages.
**Capacité :** {capacite} personnes.
**Surface habitable :** 36,6 m² loi Carrez — 51 m² au sol + un balcon de 9 m².
**Détail des pièces :** étage 1 : 1 chambre séparée avec lit double, une salle d'eau/WC, une cuisine ouverte sur salon avec un clic-clac double. Étage 2 : 1 chambre séparée avec lit double, un coin nuit sous pente avec 3 couchages, une salle de bain et un WC séparé.
**Équipements :** 1 cheminée électrique, 2 télévisions écran plat, 1 lecteur DVD, des DVD, 1 lave-vaisselle, 1 réfrigérateur, 1 plaque de cuisson, 1 grille-pain, 1 cafetière Nespresso, 1 bouilloire, vaisselle pour 9 personnes, 4 appareils à raclette doubles, 1 appareil à fondue, 1 crêpière, 1 aspirateur, 2 sèche-cheveux, 1 table et ses 2 rallonges avec 8 chaises, 2 lits parapluie, 1 chaise haute, 1 réducteur WC, 6 paires de raquettes, 8 paires de bâtons de randonnée, 7 luges, 1 plancha. Tout l'équipement est en très bon état de fonctionnement.
**Annexes :** un casier à ski situé au sous-sol de la résidence (3 jeux de clés).
**Linge de maison fourni :** non — **Produits de ménage :** fournis (ménage systématiquement compris dans le prix l'hiver) — **Chauffage :** oui — **Wifi :** oui.
**Accès :** la porte est fermée par un verrou à code (pas de remise de clé), code communiqué avant l'arrivée. La copropriété est fermée par une barrière dont le bip doit être rendu en fin de séjour (valeur 60 €) sur le crochet dans l'entrée.

## ÉTAT DES LIEUX
État des lieux réalisé à la sortie. Seul un état des lieux de sortie sans anomalie (pas de casse, pas de manque et appartement restitué propre) permet la restitution complète du dépôt de garantie. Caution ménage (si le ménage n'est pas compris dans le tarif) : 200 € retenus si le ménage n'a pas été réalisé correctement dans toutes les pièces.
[SIGNATURES]
`;

// Modèle par nom d'appartement ; GIETTAZ sert de base pour tout autre appartement.
const PAR_APPARTEMENT = { 'La Giettaz': GIETTAZ, 'Les Deux Alpes': DEUX_ALPES };
const modelePour = (nom) => PAR_APPARTEMENT[nom] || GIETTAZ;

const VARIABLES_CONTRAT = [
  'proprietaire_nom', 'proprietaire_prenom', 'proprietaire_adresse', 'proprietaire_telephone', 'proprietaire_email', 'lieu_signature',
  'locataire_complet', 'nom_locataire', 'prenom_locataire', 'adresse_locataire', 'telephone', 'email',
  'appartement', 'adresse', 'declaloc', 'capacite', 'heure_arrivee', 'heure_depart',
  'date_arrivee', 'date_depart', 'nb_nuits', 'semaine', 'nb_personnes', 'nb_adultes', 'nb_enfants', 'detail_occupants', 'detail_assujettis',
  'montant_sejour', 'montant_acompte', 'montant_solde', 'solde_avec_taxe', 'taxe_sejour', 'montant_caution', 'date_limite_solde',
  'menage', 'menage_majuscules', 'date_du_jour',
];

const Calc = require('../public/calc');
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const TROU = '………………';

const dateLongue = (iso) => {
  const d = Calc.parseDate(iso);
  return d ? `${d.getUTCDate() === 1 ? '1er' : d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : '';
};

/** Date d'arrivée moins un mois calendaire (26/12 → 26/11 ; 31/03 → 28/02). */
function unMoisAvant(iso) {
  const d = Calc.parseDate(iso);
  if (!d) return '';
  const y = d.getUTCFullYear(), m = d.getUTCMonth() - 1;
  const dernierJour = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Calc.toISO(new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), dernierJour))));
}

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/**
 * Fusionne un modèle de contrat avec une réservation.
 * Retourne le texte et la liste des informations manquantes (laissées en pointillés).
 */
function fusionner(modele, resa, apt, proprio = {}, today = Calc.todayISO()) {
  const pay = Calc.payments(resa.montant_sejour);
  const taxe = Calc.touristTax(resa, apt).total;
  const adultes = Number(resa.nb_adultes) || 0;
  const enfants = Number(resa.nb_enfants) || 0;
  const menage = Calc.truthy(resa.menage_inclus) || resa.menage_inclus === true;
  const manquants = [];
  const requis = (valeur, libelle) => {
    const v = String(valeur ?? '').trim();
    if (!v) { if (!manquants.includes(libelle)) manquants.push(libelle); return TROU; }
    return v;
  };
  const vars = {
    proprietaire_nom: requis(proprio.nom && proprio.nom.toUpperCase(), 'Nom du propriétaire (Réglages)'),
    proprietaire_prenom: requis(proprio.prenom, 'Prénom du propriétaire (Réglages)'),
    proprietaire_adresse: requis(proprio.adresse, 'Adresse du propriétaire (Réglages)'),
    proprietaire_telephone: requis(proprio.telephone, 'Téléphone du propriétaire (Réglages)'),
    proprietaire_email: requis(proprio.email, 'E-mail du propriétaire (Réglages)'),
    lieu_signature: requis(proprio.lieu_signature, 'Lieu de signature (Réglages)'),
    locataire_complet: [resa.prenom_locataire, resa.nom_locataire].filter(Boolean).join(' '),
    nom_locataire: resa.nom_locataire || '',
    prenom_locataire: resa.prenom_locataire || '',
    adresse_locataire: requis(resa.adresse_locataire, 'Adresse postale du locataire (fiche réservation)'),
    telephone: requis(resa.telephone, 'Téléphone du locataire'),
    email: requis(resa.email, 'E-mail du locataire'),
    appartement: apt.nom,
    adresse: requis(apt.adresse, "Adresse de l'appartement (Réglages)"),
    declaloc: requis(apt.declaloc, "N° d'enregistrement Declaloc (Réglages)"),
    capacite: String(apt.capacite || ''),
    heure_arrivee: apt.heure_arrivee || '14h',
    heure_depart: apt.heure_depart || '10h',
    date_arrivee: Calc.formatDate(resa.date_arrivee),
    date_depart: Calc.formatDate(resa.date_depart),
    nb_nuits: String(Calc.nights(resa.date_arrivee, resa.date_depart)),
    semaine: String(Calc.isoWeek(resa.date_arrivee) || ''),
    nb_personnes: String(adultes + enfants),
    nb_adultes: String(adultes),
    nb_enfants: String(enfants),
    detail_occupants: enfants ? `${pluriel(adultes, 'adulte')} et ${pluriel(enfants, 'enfant')}` : pluriel(adultes, 'adulte'),
    detail_assujettis: pluriel(adultes, 'adulte'),
    montant_sejour: Calc.formatEuro(resa.montant_sejour),
    montant_acompte: Calc.formatEuro(pay.acompte),
    montant_solde: Calc.formatEuro(pay.solde),
    solde_avec_taxe: Calc.formatEuro(pay.solde + taxe),
    taxe_sejour: Calc.formatEuro(taxe),
    montant_caution: Calc.formatEuro(apt.caution),
    date_limite_solde: Calc.formatDate(unMoisAvant(resa.date_arrivee)),
    menage: menage ? 'ménage inclus' : 'ménage de fin de séjour à la charge du locataire',
    menage_majuscules: menage ? 'MÉNAGE INCLUS' : 'MÉNAGE NON INCLUS',
    date_du_jour: dateLongue(today),
  };
  if (Number(apt.capacite) && adultes + enfants > Number(apt.capacite)) manquants.push(`Attention : ${adultes + enfants} occupants pour une capacité de ${apt.capacite}`);
  const texte = String(modele).replace(/\{([a-z_]+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return { texte, manquants };
}

module.exports = { modelePour, fusionner, unMoisAvant, VARIABLES_CONTRAT };
