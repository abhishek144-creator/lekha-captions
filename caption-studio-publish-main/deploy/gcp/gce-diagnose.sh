#!/usr/bin/env bash
set -euo pipefail

# Read-only recovery diagnostic for a failed first boot. Keeping this separate
# preserves the stopped container and its complete logs across a VM restart.
docker inspect -f 'name={{.Name}} status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}} error={{.State.Error}}' lekha-api || true
docker logs --tail 500 lekha-api || true
