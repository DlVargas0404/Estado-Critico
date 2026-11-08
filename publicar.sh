#!/usr/bin/env bash
# Crea el repositorio en GitHub y sube el proyecto.
# Requiere git y GitHub CLI (https://cli.github.com) con sesión iniciada: gh auth login
set -e
NOMBRE="${1:-estado-critico}"
git init -b main
git add .
git commit -m "Estado Crítico: juego de sigilo con enemigos controlados por autómatas"
gh repo create "$NOMBRE" --public --source=. --remote=origin --push --description "Videojuego de sigilo cuyos enemigos son máquinas de Mealy y Moore (Teoría de la Computación, UniPamplona)"
echo "Listo: https://github.com/$(gh api user -q .login)/$NOMBRE"
