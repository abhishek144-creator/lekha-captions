#!/usr/bin/env bash
set -euo pipefail

metadata() {
  curl -fsS -H 'Metadata-Flavor: Google' \
    "http://metadata.google.internal/computeMetadata/v1/instance/attributes/$1"
}

region="$(metadata region)"
api_image="$(metadata api-image-uri)"
render_image="$(metadata render-image-uri)"
transcription_image="$(metadata transcription-image-uri)"

apt-get update
apt-get install -y --no-install-recommends ca-certificates curl docker.io google-cloud-cli
systemctl enable --now docker
gcloud auth configure-docker "${region}-docker.pkg.dev" --quiet

docker pull "$api_image"
docker pull "$render_image"
docker pull "$transcription_image"
docker pull clamav/clamav:1.4_base
docker pull caddy:2.10-alpine

apt-get clean
rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /root/.config/gcloud/logs
sync
shutdown -h now
