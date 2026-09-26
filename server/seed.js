// Données initiales : appartements, modèles de messages et modèle de contrat.

const APPARTEMENTS = [
  {
    nom: 'La Giettaz',
    adresse: 'Chalet Les Airelles, Plan de La Giettaz, 73590 La Giettaz (Savoie)',
    caution: 500,
    taux_communal: 5,
    plafond_communal: 2.3,
    taux_departemental: 10,
    age_exoneration: 18,
    couleur: '#2f7d4f',
  },
  {
    nom: 'Les Deux Alpes',
    adresse: '38860 Les Deux Alpes (Isère)',
    caution: 900,
    taux_communal: 5,
    plafond_communal: 2.3,
    taux_departemental: 10,
    age_exoneration: 18,
    couleur: '#2b7bb9',
  },
];

// appartement : nom de l'appartement, ou null pour « Les deux ».
const MODELES = [
  {
    titre: "Message d'arrivée – La Giettaz",
    appartement: 'La Giettaz',
    categorie: 'arrivee',
    corps: `Bonjour!

🎉Votre arrivée à La Giettaz approche!

🏘️L'appartement est dans le chalet Les Airelles (c'est le plus proche du télésiège au Plan de La Giettaz).

🚪Nous sommes au dernier étage à gauche. Le couloir devant la porte est pour nous, vous pouvez laisser vos affaires, ça évite de vous encombrer l'appartement. 🗝️🗝️🗝️Dans l'entrée il y a 2 clés pour le casier à ski et la télécommande de la barrière.

🔒Les codes sont: Barrière : 79135 Porte: C71960Y Wifi: lesrhodos6

📱N'hésitez pas à me tenir informée de votre installation. N'hésitez pas à me contacter si vous cassez quelque chose, cela évite les mauvaises surprises et permet surtout d'anticiper pour réparer ou remplacer.

🧹🧽Ouvrez tous les placards pour voir les stocks en produits ménagers, mouchoirs, sopalin...

🍾🍷Du génépi est là pour une petite dégustation si vous voulez !

🏔️🥳Je vous souhaite un excellent séjour à la giet, en espérant que l'appartement vous plaise et que vous puissiez profiter pleinement de ce coin de paradis.

Très bon séjour à vous

Isabelle`,
  },
  {
    titre: "Message d'arrivée – Les Deux Alpes",
    appartement: 'Les Deux Alpes',
    categorie: 'arrivee',
    corps: `Bonjour, Votre arrivée approche. 🔒Voici les codes de l'appartement : Chalet : 2520A Appartement : C71960Y Mot de passe wifi : desvacancesaux2alpes

L'appartement sera prêt pour 14h environ.

🏠🏘️Pour accéder à la copropriété (et en sortir) il faut la télécommande de la barrière qui est accrochée dans l'entrée. Il faudra bien la replacer là en fin de séjour.

Le chalet est le tout premier à votre gauche après le passage de la barrière, vous avez une place de stationnement juste devant la porte d'entrée pour décharger, il faut ensuite déplacer le véhicule.

🚪Notre appartement est au dernier étage à gauche. C'est la seule porte à code. Il y a 3 clés dans l'entrée pour le casier à ski, n'oubliez pas de les replacer là en fin de semaine.

👀Sur place, un voisin (Jean Émilien) sera là pour l'état des lieux de sortie et en cas de problème à l'appartement. Pourriez-vous le contacter pour le prévenir de votre arrivée puis en fin de séjour pour convenir d'un moment pour qu'il passe faire l'état des lieux? Son numéro est le : 06 27 24 20 31

👀En ce qui concerne l'état des lieux d'arrivée, les petits points négatifs qui sont connus sont la vitre gauche du salon légèrement fendue en bas, une tache sur le canapé.

📱Je reste à votre écoute si vous avez des questions. N'hésitez pas à me contacter si vous cassez quelque chose, cela évite les mauvaises surprises et permet surtout d'anticiper pour réparer ou remplacer.

✉️N'hésitez pas à me faire un message une fois installés.

🍾🍷Du génépi est dans le placard de l'entrée pour une petite dégustation si vous souhaitez !

🏔️Je vous souhaite un excellent séjour aux deux alpes.

Isabelle`,
  },
  {
    titre: 'Message de fin de séjour – La Giettaz',
    appartement: 'La Giettaz',
    categorie: 'depart',
    corps: `Bonjour chers locataires de la Giet,

La fin du séjour approche malheureusement à grand pas. 😅 J'espère que vous avez passé un agréable séjour dans l'appartement.🤩

N'oubliez pas au moment du départ de :

bien laisser toutes les clés du casiers dans l'entrée sur le crochet 🔑🔑🔑
Reposer le bip du portail 📳
Vider les poubelles 🚮 et remettre un sac dans chaque poubelle
Vider le frigo et le nettoyer 🧊🧽
Replacer les meubles où vous les avez trouvés🪑
Baisser les chauffages 🔥
Envoyer quelques photos pour vérification d'état des lieux.
À votre arrivée vous avez bénéficié d'un appartement rangé et propre, avec un stock pour vous dépanner de papier toilette, lessive, café,… pourriez-vous veiller à ce que les prochains locataires bénéficient des mêmes avantages ? 🧻☕️🧽🧹🙏🙏🙏

Je vous remercie par avance de suivre ces quelques recommandations pour que l'arrivée des prochains locataires soit aussi agréable que la vôtre . 🙏🤩

Pourrez vous me dire approximativement votre heure de départ (avant 11h) pour que je puisse faire un petit message aux prochains locataires ?

Je compte également sur vous pour me signaler si vous avez rencontré un souci avec l'appartement 😬 durant la semaine ou si vous voyez qu'il manque quelque chose pour les prochains locataires. 🙏

Je vous souhaite une belle dernière journée. 🏔️⛰️🥾🌲🛷⛷️🏂🪂🎣🚵‍♀️⛰️🏔️

Isabelle`,
  },
  {
    titre: 'Message de fin de séjour – Les Deux Alpes',
    appartement: 'Les Deux Alpes',
    categorie: 'depart',
    corps: `Bonjour chers locataires des 2 Alpes,

La fin du séjour approche malheureusement à grand pas. 😅 J'espère que vous avez passé un agréable séjour dans l'appartement.🤩

N'oubliez pas au moment du départ (pour rappel avant 10h) de :

bien laisser toutes les clés du casiers dans l'entrée sur le crochet 🔑🔑🔑
Reposer sur le crochet de l'entrée le bip du portail 📳 après votre sortie de la copropriété.
Vider les poubelles 🚮 et remettre un sac dans chaque poubelle
Vider le frigo et le nettoyer 🧊🧽
Replacer les meubles où vous les avez trouvés🪑
Baisser les chauffages 🔥
À votre arrivée vous avez bénéficié d'un appartement en ordre, avec un stock pour vous dépanner de papier toilette, café, lessive,… pourriez-vous veiller à ce que les prochains locataires bénéficient des mêmes avantages ? 🧻☕️🙏🙏🙏

🧹🧽⚠️ POUR FACILITER LE MÉNAGE POURRIEZ-VOUS METTRE LES CHAISES RETOURNÉES SUR LA TABLE? Je vous remercie

Je vous remercie par avance de suivre ces quelques recommandations pour que l'arrivée des prochains locataires soit aussi agréable que la vôtre . 🙏🤩

Je vous laisser contacter Jean Émilien pour qu'il vienne jeter un œil à l'appartement avant votre départ (06 27 24 20 31)

Je vous souhaite une belle dernière journée.

Isabelle`,
  },
  {
    titre: 'Conditions de réservation',
    appartement: null,
    categorie: 'conditions',
    corps: `Pour effectuer la réservation, je souhaite en premier lieu vous avoir par telephone. Cet appel permet de vérifier que notre logement correspond à vos attentes et répondre à vos questions. Ensuite je vous enverrai le contrat de location qu'il faudra me retourner signé avec une photo de votre pièce d'identité et le paiement des 30% d'acompte.

1 mois avant votre arrivée le solde sera à régler et le chèque de caution à envoyer. Bien à vous, Isabelle ANDRÉ`,
  },
  {
    titre: 'Mail de réservation – Les Deux Alpes',
    appartement: 'Les Deux Alpes',
    categorie: 'reservation',
    corps: `Bonjour {prenom_locataire},

Tout d'abord je tiens à vous remercier pour la confiance que vous nous accordez en réservant vos vacances dans notre appartement. Nous espérons qu'il sera à la hauteur de vos attentes.

Comme convenu je vous envoie votre contrat de location pour la semaine du {date_arrivee} au {date_depart} aux deux Alpes.

Je vous laisse le lire puis le signer et me le retourner, accompagné de l'acompte de 30% comme stipulé dans le contrat et de la photo de votre pièce d'identité. Vous pouvez me renvoyer le tout par mail. Pour le règlement, je vous envoie mon RIB pour le virement.

Dès réception de l'ensemble des pièces je vous enverrai notre guide de bienvenue pour préparer votre séjour.

Un mois avant votre arrivée, le solde sera à régler et le chèque de caution de 900 sera à envoyer.

La semaine est bloquée 1 semaine et sans nouvel de votre part je la remettrai en location passé ce délai. Je reste bien entendu à votre écoute si vous avez la moindre question.

Bien à vous,

Isabelle`,
  },
  {
    titre: 'Mail de réservation – La Giettaz',
    appartement: 'La Giettaz',
    categorie: 'reservation',
    corps: `Bonjour {prenom_locataire},

Tout d'abord je tiens à vous remercier pour la confiance que vous nous accordez en réservant vos vacances dans notre appartement. Nous espérons qu'il sera à la hauteur de vos attentes.

Comme convenu je vous envoie votre contrat de location pour la semaine du {date_arrivee} au {date_depart} à la Giettaz.

Je vous laisse le lire puis le signer et me le retourner, accompagné d'une photo de votre pièce d'identité et de l'acompte de 30% comme stipulé dans le contrat. Vous pouvez me renvoyer le tout par mail ou voie postale à votre convenance. Pour le règlement, je vous envoie mon RIB pour le virement.

Dès réception de l'ensemble des pièces je vous enverrai notre guide de bienvenue pour préparer votre séjour.

Un mois avant votre arrivée, le solde sera à régler et le chèque de caution de 500 sera à envoyer.

Je reste bien entendu à votre écoute si vous avez la moindre question.

Bien à vous,

Isabelle`,
  },
];

const CONTRAT = `CONTRAT DE LOCATION SAISONNIÈRE
Meublé de tourisme — {appartement}

ENTRE LES SOUSSIGNÉS

Le bailleur : Isabelle ANDRÉ
ci-après « le propriétaire »,

ET

Le locataire : {nom_locataire}
Téléphone : {telephone} — E-mail : {email}
ci-après « le locataire ».

1. OBJET
Le propriétaire loue au locataire, qui l'accepte, le meublé de tourisme situé :
{adresse}
N° d'enregistrement : {declaloc}

2. DURÉE
La location est consentie pour la semaine n° {semaine}, du {date_arrivee} (arrivée à partir de 16h) au {date_depart} (départ avant 10h), soit {nb_nuits} nuits.
Nombre d'occupants : {nb_personnes} personne(s) ({nb_adultes} adulte(s), {nb_enfants} enfant(s)).

3. PRIX ET CONDITIONS DE PAIEMENT
Le prix du séjour est fixé à {montant_sejour}, charges comprises. Ménage de fin de séjour : {menage}.
- Un acompte de 30 %, soit {montant_acompte}, est versé à la signature du présent contrat.
- Le solde, soit {montant_solde}, est à régler au plus tard un mois avant l'arrivée.
Taxe de séjour : {taxe_sejour}, à régler en supplément.

4. DÉPÔT DE GARANTIE
Un chèque de caution de {montant_caution} sera envoyé un mois avant l'arrivée. Il sera restitué dans un délai maximal d'un mois après le départ, déduction faite, le cas échéant, des sommes justifiées dues au titre des dégradations constatées.

5. ÉTAT DES LIEUX ET INVENTAIRE
Un état des lieux et un inventaire sont établis à l'arrivée et au départ. Le locataire s'engage à signaler toute anomalie dans les 24 heures suivant son arrivée.

6. OBLIGATIONS DU LOCATAIRE
Le locataire s'engage à occuper les lieux paisiblement, à les rendre dans l'état où il les a trouvés, à ne pas dépasser le nombre d'occupants prévu et à respecter le règlement de la copropriété.

7. ANNULATION
En cas d'annulation par le locataire, l'acompte reste acquis au propriétaire.

Fait en deux exemplaires, le {date_du_jour}.

Le propriétaire                                   Le locataire
(« lu et approuvé »)                              (« lu et approuvé »)
`;

module.exports = { APPARTEMENTS, MODELES, CONTRAT };
