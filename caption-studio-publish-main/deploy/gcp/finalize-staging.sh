#!/usr/bin/env bash
# Finalize the already-created GCP staging stack from an authenticated Cloud Shell.
# Safe to rerun: it adds a new Secret Manager version, reapplies metadata, and
# resets only the two explicitly named staging VMs.
set -euo pipefail

project_id="${PROJECT_ID:-project-0cc7c839-b9c7-4734-ad0}"
region="${REGION:-asia-south1}"
zone="${ZONE:-asia-south1-a}"
redis_name="${REDIS_NAME:-lekha-redis-staging}"
runtime_secret="${RUNTIME_SECRET:-lekha-runtime-env}"
api_vm="${API_VM:-lekha-api-staging}"
worker_vm="${WORKER_VM:-lekha-worker-staging}"
startup_script="${STARTUP_SCRIPT:-$HOME/gce-startup-https.sh}"
public_host="${PUBLIC_HOST:-34-93-113-193.sslip.io}"
admin_email="${ADMIN_EMAIL:-abhisheknaidu369@gmail.com}"
release_sha="${APP_RELEASE:-838b28c8e10ee402fa1c1716418302a991cfee1f}"
release_version="${RELEASE_VERSION:-gcp-staging-838b28c}"
build_time="${APP_BUILD_TIME:-2026-09-07T12:23:54Z}"

if [[ ! -f "$startup_script" ]]; then
  echo "Startup script not found: $startup_script" >&2
  exit 66
fi

gcloud config set project "$project_id" >/dev/null

redis_state="$(gcloud redis instances describe "$redis_name" \
  --region="$region" --format='value(state)')"
if [[ "$redis_state" != "READY" ]]; then
  echo "Redis is not ready (state: ${redis_state:-unknown})." >&2
  exit 75
fi
redis_host="$(gcloud redis instances describe "$redis_name" \
  --region="$region" --format='value(host)')"
redis_port="$(gcloud redis instances describe "$redis_name" \
  --region="$region" --format='value(port)')"
if [[ -z "$redis_host" || -z "$redis_port" ]]; then
  echo "Redis endpoint was not returned." >&2
  exit 70
fi

runtime_file="$(mktemp)"
next_file="${runtime_file}.next"
cleanup() {
  rm -f -- "$runtime_file" "$next_file"
}
trap cleanup EXIT
umask 077
gcloud secrets versions access latest --secret="$runtime_secret" > "$runtime_file"

# Docker's --env-file parser keeps surrounding quotes as part of the value.
# Normalize values copied from developer-style .env files before publishing a
# new Secret Manager version (for example, "20" must become 20).
awk '
  /^[A-Za-z_][A-Za-z0-9_]*=/ {
    equals = index($0, "=")
    key = substr($0, 1, equals)
    value = substr($0, equals + 1)
    first = substr(value, 1, 1)
    last = substr(value, length(value), 1)
    if (length(value) >= 2 && ((first == "\"" && last == "\"") || (first == "\047" && last == "\047"))) {
      value = substr(value, 2, length(value) - 2)
    }
    print key value
    next
  }
  { print }
' "$runtime_file" > "$next_file"
mv -f -- "$next_file" "$runtime_file"

get_env() {
  local key="$1"
  sed -n "s/^${key}=//p" "$runtime_file" | tail -n 1
}

set_env() {
  local key="$1"
  local value="$2"
  awk -v key="$key" 'index($0, key "=") != 1 { print }' "$runtime_file" > "$next_file"
  printf '%s=%s\n' "$key" "$value" >> "$next_file"
  mv -f -- "$next_file" "$runtime_file"
}

ensure_random_secret() {
  local key="$1"
  local current
  current="$(get_env "$key")"
  if [[ -z "$current" || "$current" == '""' || "$current" == "''" ]]; then
    set_env "$key" "$(openssl rand -hex 32)"
  fi
}

set_env APP_ENV production
set_env REDIS_URL "redis://${redis_host}:${redis_port}/0"
set_env APP_RELEASE "$release_sha"
set_env RELEASE_VERSION "$release_version"
set_env APP_BUILD_TIME "$build_time"
set_env ADMIN_EMAILS "$admin_email"
set_env SECURITY_CONTACT_EMAIL "$admin_email"
set_env PRIVACY_CONTACT_EMAIL "$admin_email"
set_env ENABLE_DURABLE_QUEUE 1
set_env MAX_CONCURRENT_RENDERS 1
set_env DISABLE_EXPORT_DAILY_LIMIT 0
set_env DISABLE_EXPORT_CREDIT_LIMIT 0
set_env ALLOW_INMEMORY_STATE 0
set_env ALLOW_UNSCANNED_UPLOADS 0
set_env DEBUG_MODE false
set_env LOCAL_DEV_AUTH_BYPASS 0
set_env FIREBASE_SERVICE_ACCOUNT_PATH ''
set_env ALLOW_FIREBASE_SERVICE_ACCOUNT_PATH false
ensure_random_secret RAZORPAY_WEBHOOK_SECRET
ensure_random_secret PAYMENT_RECONCILE_SECRET
ensure_random_secret MEDIA_URL_SIGNING_SECRET

gcloud secrets versions add "$runtime_secret" --data-file="$runtime_file" >/dev/null

gcloud compute instances add-metadata "$api_vm" --zone="$zone" \
  --metadata="public-host=${public_host}" \
  --metadata-from-file="startup-script=${startup_script}" >/dev/null
gcloud compute instances add-metadata "$worker_vm" --zone="$zone" \
  --metadata-from-file="startup-script=${startup_script}" >/dev/null
for vm in "$api_vm" "$worker_vm"; do
  gcloud compute instances reset "$vm" --zone="$zone" --quiet >/dev/null
done

api_ip="$(gcloud compute instances describe "$api_vm" --zone="$zone" \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)')"
if [[ -z "$api_ip" ]]; then
  echo "The API VM has no external staging address." >&2
  exit 70
fi

health_url="https://${public_host}/health"
ready_url="https://${public_host}/ready"
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 10 "$health_url" >/dev/null; then
    echo "API health check passed: $health_url"
    curl -fsS --max-time 15 "$ready_url" || true
    echo
    echo "GCP staging finalization completed."
    exit 0
  fi
  sleep 10
done

echo "API did not become healthy; recent startup diagnostics follow." >&2
for vm in "$api_vm" "$worker_vm"; do
  echo "--- ${vm} ---" >&2
  gcloud compute instances get-serial-port-output "$vm" --zone="$zone" \
    --port=1 --start=0 2>/dev/null | grep 'google_metadata_script_runner' | tail -n 120 >&2 || true
done
exit 1
