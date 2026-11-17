#!/bin/bash
# Lanceur macOS : double-cliquer pour démarrer l'application et l'ouvrir dans le navigateur.
# Fermer la fenêtre du Terminal (ou Ctrl+C) arrête l'application.

cd "$(dirname "$0")" || exit 1
PORT="${PORT:-3000}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé."
  echo "Installez la version « LTS » depuis https://nodejs.org puis relancez ce fichier."
  open "https://nodejs.org/fr/download" 2>/dev/null
  read -r -p "Appuyez sur Entrée pour fermer…"
  exit 1
fi

if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)'; then
  echo "Node.js $(node -v) est trop ancien : la version 22.13 ou plus récente est nécessaire."
  echo "Installez la version « LTS » depuis https://nodejs.org puis relancez ce fichier."
  open "https://nodejs.org/fr/download" 2>/dev/null
  read -r -p "Appuyez sur Entrée pour fermer…"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Première utilisation : installation des composants (une minute environ)…"
  npm install --no-audit --no-fund || { read -r -p "Échec de l'installation. Entrée pour fermer…"; exit 1; }
fi

if curl -s "http://localhost:$PORT/api/me" >/dev/null 2>&1; then
  echo "L'application tourne déjà : ouverture du navigateur."
  open "http://localhost:$PORT"
  exit 0
fi

echo "Démarrage de Gestion locative sur http://localhost:$PORT"
echo "Gardez cette fenêtre ouverte pendant l'utilisation. Pour arrêter : fermez-la ou faites Ctrl+C."
(sleep 2; open "http://localhost:$PORT") &
PORT="$PORT" npm start
