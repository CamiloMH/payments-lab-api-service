#!/usr/bin/env bash
# Crea un tag anotado, lo publica y genera el GitHub Release con el bloque
# correspondiente de CHANGELOG.md.
# Uso: pnpm release <version>   (ej. pnpm release 1.2.0)
#
# Requiere: git, gh (GitHub CLI — https://cli.github.com/)
#   Windows: winget install --id GitHub.cli
#   Luego:   gh auth login
set -euo pipefail

VERSION="${1:-}"

# ── Validaciones previas ────────────────────────────────────────────────────

if [[ -z "$VERSION" ]]; then
  echo "Error: debes indicar la versión. Uso: pnpm release <version>" >&2
  exit 1
fi

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9._-]+)?$'; then
  echo "Error: versión inválida '$VERSION'. Formato esperado: x.y.z o x.y.z-prerelease" >&2
  exit 1
fi

if ! command -v gh &>/dev/null; then
  echo "Error: GitHub CLI (gh) no está instalado." >&2
  echo "  Windows : winget install --id GitHub.cli" >&2
  echo "  macOS   : brew install gh" >&2
  echo "  Linux   : https://github.com/cli/cli/blob/trunk/docs/install_linux.md" >&2
  echo "Después ejecuta: gh auth login" >&2
  exit 1
fi

TAG="v${VERSION}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Error: debes estar en la rama 'main' para publicar (rama actual: $CURRENT_BRANCH)" >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: hay cambios sin commitear. Haz commit o stash antes de publicar." >&2
  exit 1
fi

if git tag --list | grep -qx "$TAG"; then
  echo "Error: el tag '$TAG' ya existe localmente. Elimínalo con: git tag -d $TAG" >&2
  exit 1
fi

# ── Extraer bloque del CHANGELOG ────────────────────────────────────────────

CHANGELOG_BLOCK=$(awk "/^## \[${VERSION}\]/{found=1; next} found && /^## \[/{exit} found{print}" CHANGELOG.md)

if [[ -z "$CHANGELOG_BLOCK" ]]; then
  echo "Error: no se encontró la sección [${VERSION}] en CHANGELOG.md." >&2
  echo "Añade '## [${VERSION}] - YYYY-MM-DD' antes de publicar." >&2
  exit 1
fi

# ── Crear tag anotado ───────────────────────────────────────────────────────

echo "→ Creando tag anotado ${TAG}..."
git tag -a "$TAG" -m "Release ${TAG}

${CHANGELOG_BLOCK}"

# ── Publicar tag ────────────────────────────────────────────────────────────

echo "→ Publicando ${TAG} en origin..."
git push origin "$TAG"

# ── Crear GitHub Release ────────────────────────────────────────────────────

echo "→ Creando GitHub Release ${TAG}..."
gh release create "$TAG" \
  --title "payments-lab-api-service ${TAG}" \
  --notes "${CHANGELOG_BLOCK}"

echo ""
echo "✓ ${TAG} publicado y release creado."
echo "  $(gh release view "$TAG" --json url --jq '.url')"
