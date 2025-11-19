#!/usr/bin/env bash
set -euo pipefail

print_usage() {
  cat <<'USAGE'
Usage: scripts/release.sh [patch|minor|major|prerelease|<version>] [--push] [--build]

Creates a release by bumping `package.json` version, committing and tagging via
`npm version`. By default it only updates files locally; pass `--push` to push
commit and tag to `origin`.

Options:
  patch|minor|major|prerelease  Version bump type (default: patch)
  <version>                    Specific semver version (e.g. 1.2.3)
  --push                       Push the commit and tag to origin
  --build                      Run `npm run build` before bumping/versioning
  -h, --help                   Show this help

Examples:
  # bump patch, create git commit and tag locally
  ./scripts/release.sh patch

  # bump minor and push commit+tag
  ./scripts/release.sh minor --push

  # release specific version, build first, and push
  ./scripts/release.sh 1.2.0 --build --push
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  print_usage
  exit 0
fi

# Parse flags
PUSH=0
BUILD=0
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --push)
      PUSH=1; shift ;;
    --build)
      BUILD=1; shift ;;
    -h|--help)
      print_usage; exit 0 ;;
    *)
      POSITIONAL+=("$1") ; shift ;;
  esac
done
set -- "${POSITIONAL[@]}"

BUMP=${1:-patch}

# Validate bump/version token (allow common npm version specifiers and raw semver)
if ! [[ "$BUMP" =~ ^(patch|minor|major|prerelease|[0-9]+(\.[0-9]+){1,2})$ ]]; then
  echo "Invalid bump/version: $BUMP"
  print_usage
  exit 1
fi

# Ensure we're in repo root with package.json
if [[ ! -f package.json ]]; then
  echo "package.json not found in current directory; run this from repo root"
  exit 1
fi

# Ensure working tree is clean
if ! git diff --quiet --exit-code || ! git diff --cached --quiet --exit-code; then
  echo "Working tree is not clean. Commit or stash changes before releasing."
  exit 1
fi

# Optional build step
if [[ $BUILD -eq 1 ]]; then
  echo "Running build..."
  npm run build
fi

# Run npm version which updates package.json, creates a commit and a tag by default
echo "Bumping version: $BUMP"
npm version "$BUMP" -m "chore(release): %s"

NEW_VERSION=$(node -p "require('./package.json').version")
echo "Created release: v${NEW_VERSION}"

if [[ $PUSH -eq 1 ]]; then
  # Allow overriding remote via REMOTE env var, default to 'origin'
  REMOTE=${REMOTE:-origin}
  echo "Pushing commit and tags to ${REMOTE}..."
  # Push the new commit and any annotated tags
  git push "${REMOTE}" --follow-tags
  # Ensure all tags (including lightweight tags) are pushed
  git push "${REMOTE}" --tags
  echo "Pushed to ${REMOTE}."
fi

echo "Done."
