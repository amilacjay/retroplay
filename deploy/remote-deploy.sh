#!/usr/bin/env bash
# Runs on the server from CI: pulls the images for IMAGE_TAG and restarts the stack.
# A short-lived registry token arrives on stdin; it is used for one pull and then logged out, never written to disk.
set -euo pipefail
cd "$(dirname "$0")"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
export IMAGE_TAG API_IMAGE WEB_IMAGE

read -r TOKEN
echo "$TOKEN" | docker login ghcr.io -u "${REGISTRY_USER:?}" --password-stdin >/dev/null
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

docker compose pull
docker compose up -d --remove-orphans
docker image prune -f >/dev/null

for _ in $(seq 1 30); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q api)" 2>/dev/null || echo starting)
  if [ "$status" = healthy ]; then echo "API healthy on $IMAGE_TAG"; exit 0; fi
  sleep 4
done
echo "API did not become healthy:" >&2
docker compose logs --tail 80 api >&2
exit 1
