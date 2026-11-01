#!/bin/bash
# Deploy mxtape to mxtape.celox.io
#
#   ./scripts/deployment/deploy.sh          # API, then web app
#   ./scripts/deployment/deploy.sh api      # only the FastAPI backend
#   ./scripts/deployment/deploy.sh web      # only the PWA
#
# The API's secrets live only in /opt/mxtape-api/.env on the VPS (see
# server/.env.example); this script never writes them. nginx changes are a
# one-time manual step (server/deploy/nginx-locations.conf).

set -euo pipefail

APP_NAME="mxtape"
VPS_HOST="root@69.62.121.168"
VPS_ROOT="/var/www/html/$APP_NAME"
API_ROOT="/opt/mxtape-api"
TARGET="${1:-all}"

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PWA_DIR="$PROJECT_ROOT/pwa"
SERVER_DIR="$PROJECT_ROOT/server"

deploy_api() {
  echo "🧪 Backend-Tests …"
  (cd "$SERVER_DIR" && .venv/bin/python -m pytest -q)

  echo "📤 Backend hochladen …"
  rsync -a --delete \
    --exclude='.venv/' --exclude='data/' --exclude='.env' --exclude='__pycache__/' \
    --exclude='.pytest_cache/' --exclude='tests/' \
    "$SERVER_DIR/" "$VPS_HOST:$API_ROOT/"

  ssh "$VPS_HOST" "set -e
    id mxtape >/dev/null 2>&1 || useradd --system --home-dir $API_ROOT --shell /usr/sbin/nologin mxtape
    mkdir -p $API_ROOT/data
    chown -R root:mxtape $API_ROOT && chmod -R g-w,o-rwx $API_ROOT
    # The recursive chown above also reached data/: hand the database back to the
    # service, or the next restart fails with 'attempt to write a readonly database'
    chown -R mxtape:mxtape $API_ROOT/data && chmod 750 $API_ROOT/data
    test -f $API_ROOT/.env || { echo '❌ $API_ROOT/.env fehlt (siehe server/.env.example)'; exit 1; }
    chown root:mxtape $API_ROOT/.env && chmod 640 $API_ROOT/.env
    test -x $API_ROOT/.venv/bin/python || python3 -m venv $API_ROOT/.venv
    $API_ROOT/.venv/bin/pip install -q --upgrade pip
    $API_ROOT/.venv/bin/pip install -q -r $API_ROOT/requirements.txt
    chown -R root:mxtape $API_ROOT/.venv && chmod -R o-rwx $API_ROOT/.venv
    install -m 644 $API_ROOT/deploy/mxtape-api.service /etc/systemd/system/mxtape-api.service
    systemctl daemon-reload
    systemctl enable --quiet mxtape-api
    systemctl restart mxtape-api
    for i in 1 2 3 4 5 6 7 8 9 10; do curl -sf http://127.0.0.1:4274/api/health >/dev/null && break; sleep 1; done
    curl -sf http://127.0.0.1:4274/api/health && echo
  "
  echo "✅ API läuft"
}

# The changelog is written from the release commits (scripts/changelog.mjs),
# never by hand. When a release added an entry, commit and push it here, so
# the repository and the page in the app always agree.
update_changelog() {
  echo "📝 Changelog …"
  (cd "$PROJECT_ROOT" && node scripts/changelog.mjs)
  if [ -n "$(cd "$PROJECT_ROOT" && git status --porcelain -- CHANGELOG.md pwa/src/data/changelog.json)" ]; then
    (cd "$PROJECT_ROOT" && git commit -q -m "docs: changelog for v$(node -p "require('./pwa/package.json').version")" -- CHANGELOG.md pwa/src/data/changelog.json \
      && git push -q && echo "✅ Changelog committed and pushed")
  fi
}

deploy_web() {
  update_changelog

  echo "🧪 PWA-Tests …"
  (cd "$PWA_DIR" && npx tsc --noEmit && npx vitest run --reporter=dot)

  echo "📦 Production-Build …"
  (cd "$PWA_DIR" && npm run build)

  echo "📤 Web-App hochladen (audio/ bleibt unangetastet) …"
  ssh "$VPS_HOST" "mkdir -p /tmp/$APP_NAME-deploy"
  rsync -a --delete --exclude='audio/' "$PWA_DIR/dist/" "$VPS_HOST:/tmp/$APP_NAME-deploy/"
  ssh "$VPS_HOST" "set -e
    mkdir -p $VPS_ROOT
    # Swap everything except the MP3s
    find $VPS_ROOT -mindepth 1 -maxdepth 1 ! -name audio -exec rm -rf {} +
    cp -r /tmp/$APP_NAME-deploy/. $VPS_ROOT/
    chown -R www-data:www-data $VPS_ROOT
    find $VPS_ROOT -path $VPS_ROOT/audio -prune -o -type d -exec chmod 755 {} + -o -type f -exec chmod 644 {} +
    rm -rf /tmp/$APP_NAME-deploy
  "
  echo "✅ Web-App live"
}

case "$TARGET" in
  api) deploy_api ;;
  web) deploy_web ;;
  all) deploy_api; deploy_web ;;
  *) echo "Usage: $0 [all|api|web]"; exit 1 ;;
esac

echo "🌐 https://mxtape.celox.io"
