#!/bin/sh
# Box side of Shaam on Jinx: the state directory and the site block. The app
# itself runs under Coolify (deploy/compose.yaml, image from GHCR), so nothing is
# built or restarted here (FRC/DEPLOY.md). Re-runnable.
set -eu
cd "$(dirname "$0")/.."
HOST=${HOST:-ssh.futile.studio}
NAME=shaam

scp -q deploy/$NAME.caddy "$HOST":/tmp/
ssh "$HOST" "NAME=$NAME sh -s" <<'BOX'
set -eu
# Parties survive a restart here; mounted by the container, which runs as node (1000).
sudo -n install -d -m 700 /var/lib/private/$NAME && sudo -n chown -R 1000:1000 /var/lib/private/$NAME

LIVE=/etc/caddy/conf.d/$NAME.caddy
IN=/tmp/$NAME.caddy
if cmp -s "$IN" "$LIVE"; then
  rm -f "$IN"
else
  # Imported into the config serving every site: validate, and restore on failure.
  sudo -n cp "$LIVE" "$IN.prev" 2>/dev/null || true
  sudo -n install -m 644 "$IN" "$LIVE" && rm -f "$IN"
  if ! caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
    if [ -f "$IN.prev" ]; then sudo -n mv "$IN.prev" "$LIVE"; else sudo -n rm -f "$LIVE"; fi
    echo "$NAME: site block rejected by caddy validate, config unchanged" >&2
    exit 1
  fi
  sudo -n rm -f "$IN.prev"
  sudo -n systemctl reload caddy
fi
BOX
echo "$NAME: box side in place; deploy it from Coolify"
