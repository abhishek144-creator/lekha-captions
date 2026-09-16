#!/usr/bin/env bash
set -euo pipefail

docker inspect -f 'name={{.Name}} status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}} error={{.State.Error}}' lekha-api || true
docker logs --tail 40 lekha-api || true
