#!/usr/bin/env bash
# Runs from pre-baked Compute Engine image metadata. It is intentionally safe to
# rerun and never installs packages or pulls mutable runtime dependencies.
set -euo pipefail

metadata_value() {
  curl -fsS -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/attributes/$1"
}

service_role="$(metadata_value service-role)"
legacy_image_uri="$(metadata_value image-uri 2>/dev/null || true)"
api_image_uri="$(metadata_value api-image-uri 2>/dev/null || true)"
render_image_uri="$(metadata_value render-image-uri 2>/dev/null || true)"
transcription_image_uri="$(metadata_value transcription-image-uri 2>/dev/null || true)"
runtime_secret="$(metadata_value runtime-secret)"
runtime_secret_version="$(metadata_value runtime-secret-version)"
region="$(metadata_value region)"
worker_mig_name="$(metadata_value worker-mig-name 2>/dev/null || true)"
boot_epoch="$(date +%s)"

if [[ ! "$service_role" =~ ^(api|worker|transcription)$ ]]; then
  echo "SERVICE_ROLE must be api, worker, or transcription" >&2
  exit 64
fi

command -v docker >/dev/null || { echo "Baked image is missing Docker" >&2; exit 70; }
command -v gcloud >/dev/null || { echo "Baked image is missing Google Cloud CLI" >&2; exit 70; }
systemctl enable --now docker

registry_host="${region}-docker.pkg.dev"
gcloud auth configure-docker "$registry_host" --quiet

install -d -m 0750 -o 1000 -g 1000 /var/lib/lekha/scratch
install -d -m 0750 /etc/lekha
if [[ ! "$runtime_secret_version" =~ ^[0-9]+$ ]]; then
  echo "runtime-secret-version must pin a numeric Secret Manager version" >&2
  exit 64
fi
gcloud secrets versions access "$runtime_secret_version" --secret="$runtime_secret" > /etc/lekha/runtime.env
chmod 0600 /etc/lekha/runtime.env

docker network inspect lekha-internal >/dev/null 2>&1 || docker network create lekha-internal

case "$service_role" in
  api) image_uri="${api_image_uri:-$legacy_image_uri}" ;;
  worker) image_uri="${render_image_uri:-$legacy_image_uri}" ;;
  transcription) image_uri="${transcription_image_uri:-$legacy_image_uri}" ;;
esac
[[ -n "$image_uri" ]] || { echo "Role image URI is required" >&2; exit 64; }
docker image inspect "$image_uri" >/dev/null 2>&1 || {
  echo "Pre-baked VM image is missing $image_uri" >&2
  exit 70
}
# RQ handles SIGTERM by finishing its current job. Never SIGKILL an active
# render during a routine deployment; allow its 30-minute job timeout plus
# cleanup before Docker's final stop deadline. Drain before restarting ClamAV.
if docker container inspect "lekha-${service_role}" >/dev/null 2>&1; then
  docker stop --time 1860 "lekha-${service_role}"
  docker rm "lekha-${service_role}"
fi
# The production API refuses uploads when no malware scanner is configured.
# A scanner is local to each VM so the app container never publishes its port.
docker rm -f lekha-clamav >/dev/null 2>&1 || true
docker image inspect clamav/clamav:1.4_base >/dev/null 2>&1 || {
  echo "Pre-baked VM image is missing ClamAV" >&2
  exit 70
}
docker run -d --name lekha-clamav --restart unless-stopped \
  --network lekha-internal clamav/clamav:1.4_base

role_options=()
case "$service_role" in
  worker)
    worker_queues="$(metadata_value worker-queues 2>/dev/null || true)"
    [[ -n "$worker_queues" ]] || worker_queues="caption_export_fast,caption_export_jobs"
    if [[ "$worker_queues" == *"caption_export_gpu"* ]]; then
      role_options=(--gpus all --cpus 4 --memory 14g -e "WORKER_QUEUES=${worker_queues}")
    else
      role_options=(--cpus 3 --memory 9g -e "WORKER_QUEUES=${worker_queues}")
    fi
    ;;
  transcription)
    role_options=(--cpus 2 --memory 6g -e WORKER_QUEUES=caption_transcription_jobs_staging -e ENABLE_CHROMIUM_POOL=0)
    ;;
esac
docker run -d --name "lekha-${service_role}" --restart no \
  "${role_options[@]}" \
  --stop-timeout 1860 \
  --network lekha-internal \
  --env-file /etc/lekha/runtime.env \
  -e "SERVICE_ROLE=${service_role}" \
  -e "PORT=8000" \
  -e "MEDIA_SCRATCH_DIR=/scratch" \
  -e "CLAMAV_HOST=lekha-clamav" \
  -e "VM_BOOT_EPOCH=${boot_epoch}" \
  -e "WORKER_MIG_NAME=${worker_mig_name}" \
  -e "WORKER_MIG_REGION=${region}" \
  -v /var/lib/lekha/scratch:/scratch \
  -p 8000:8000 \
  "$image_uri"

# Give staging browsers a real HTTPS origin without changing production DNS.
# The hostname is supplied only on the API VM and resolves directly to its
# reserved address. Caddy persists ACME state across instance restarts.
if [[ "$service_role" == "api" ]]; then
  public_host="$(metadata_value public-host 2>/dev/null || true)"
  if [[ -n "$public_host" ]]; then
    docker image inspect caddy:2.10-alpine >/dev/null 2>&1 || {
      echo "Pre-baked VM image is missing Caddy" >&2
      exit 70
    }
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
