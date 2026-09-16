#!/usr/bin/env bash
# Runs from Compute Engine instance metadata. It is intentionally safe to rerun:
# the previous application container is replaced only after the new image pulls.
set -euo pipefail

metadata_value() {
  curl -fsS -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/attributes/$1"
}

service_role="$(metadata_value service-role)"
image_uri="$(metadata_value image-uri)"
runtime_secret="$(metadata_value runtime-secret)"
region="$(metadata_value region)"

if [[ "$service_role" != "api" && "$service_role" != "worker" ]]; then
  echo "SERVICE_ROLE must be api or worker" >&2
  exit 64
fi

apt-get update
apt-get install -y --no-install-recommends ca-certificates curl docker.io google-cloud-cli
systemctl enable --now docker

registry_host="${region}-docker.pkg.dev"
gcloud auth configure-docker "$registry_host" --quiet

install -d -m 0750 -o 1000 -g 1000 /var/lib/lekha/scratch
install -d -m 0750 /etc/lekha
gcloud secrets versions access latest --secret="$runtime_secret" > /etc/lekha/runtime.env
chmod 0600 /etc/lekha/runtime.env

docker network inspect lekha-internal >/dev/null 2>&1 || docker network create lekha-internal

docker pull "$image_uri"
# RQ handles SIGTERM by finishing its current job. Never SIGKILL an active
# render during a routine deployment; allow its 30-minute job timeout plus
# cleanup before Docker's final stop deadline. Drain before restarting ClamAV.
if docker container inspect "lekha-${service_role}" >/dev/null 2>&1; then
  docker stop --time 1860 "lekha-${service_role}"
  docker rm "lekha-${service_role}"
fi
if [[ "$service_role" == "worker" ]] && docker container inspect lekha-transcription >/dev/null 2>&1; then
  docker stop --time 1860 lekha-transcription
  docker rm lekha-transcription
fi

# The production API refuses uploads when no malware scanner is configured.
# A scanner is local to each VM so the app container never publishes its port.
docker rm -f lekha-clamav >/dev/null 2>&1 || true
docker pull clamav/clamav:1.4_base
docker run -d --name lekha-clamav --restart unless-stopped \
  --network lekha-internal clamav/clamav:1.4_base

role_options=()
if [[ "$service_role" == "worker" ]]; then
  # Three render CPUs keep FFmpeg throughput high. An 8 GiB ceiling leaves
  # 4 GiB on the 12 GiB host for transcription, ClamAV, Docker, and the OS.
  role_options=(--cpus 3 --memory 8g -e WORKER_QUEUES=caption_export_jobs)
fi
docker run -d --name "lekha-${service_role}" --restart no \
  "${role_options[@]}" \
  --stop-timeout 1860 \
  --network lekha-internal \
  --env-file /etc/lekha/runtime.env \
  -e "SERVICE_ROLE=${service_role}" \
  -e "PORT=8000" \
  -e "MEDIA_SCRATCH_DIR=/scratch" \
  -e "CLAMAV_HOST=lekha-clamav" \
  -v /var/lib/lekha/scratch:/scratch \
  -p 8000:8000 \
  "$image_uri"

if [[ "$service_role" == "worker" ]]; then
  install -d -m 0750 -o 1000 -g 1000 /var/lib/lekha/transcription-scratch
  docker run -d --name lekha-transcription --restart unless-stopped \
    --stop-timeout 1860 --network lekha-internal --cpus 1 --memory 2g \
    --env-file /etc/lekha/runtime.env \
    -e SERVICE_ROLE=worker -e PORT=8000 -e MEDIA_SCRATCH_DIR=/scratch \
    -e CLAMAV_HOST=lekha-clamav -e WORKER_QUEUES=caption_transcription_jobs_staging \
    -v /var/lib/lekha/transcription-scratch:/scratch "$image_uri"
fi

# Give staging browsers a real HTTPS origin without changing production DNS.
# The hostname is supplied only on the API VM and resolves directly to its
# reserved address. Caddy persists ACME state across instance restarts.
if [[ "$service_role" == "api" ]]; then
  public_host="$(metadata_value public-host 2>/dev/null || true)"
  if [[ -n "$public_host" ]]; then
    docker pull caddy:2.10-alpine
    docker volume create lekha-caddy-data >/dev/null
    docker volume create lekha-caddy-config >/dev/null
    docker rm -f lekha-edge >/dev/null 2>&1 || true
    docker run -d --name lekha-edge --restart unless-stopped \
      --network lekha-internal \
      -p 80:80 -p 443:443 -p 443:443/udp \
      -v lekha-caddy-data:/data \
      -v lekha-caddy-config:/config \
      caddy:2.10-alpine \
      caddy reverse-proxy --from "https://${public_host}" --to lekha-api:8000
  fi
fi

# Surface startup failures in the Compute Engine serial console so a fresh VM
# can be diagnosed without granting interactive SSH access. Keep automatic
# restart disabled until this first process proves it can stay up.
sleep 20
if [[ "$(docker inspect -f '{{.State.Running}}' "lekha-${service_role}" 2>/dev/null || true)" != "true" ]]; then
  docker logs --tail 300 "lekha-${service_role}" >&2 || true
  exit 1
fi
docker update --restart unless-stopped "lekha-${service_role}"
docker logs --tail 80 "lekha-${service_role}" || true
