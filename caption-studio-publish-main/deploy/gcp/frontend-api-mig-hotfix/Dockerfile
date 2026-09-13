ARG BASE_IMAGE
FROM ${BASE_IMAGE}

USER root

ARG OLD_API_URL
ARG NEW_API_URL
ARG APP_RELEASE
ARG RELEASE_VERSION
ARG BUILD_TIME

# Preserve the already accepted Firebase/App Check/legal browser configuration
# while moving only the staging API origin to the redundant load balancer.
RUN set -eu; \
    test -n "${OLD_API_URL}"; \
    test -n "${NEW_API_URL}"; \
    matches="$(grep -rlF "${OLD_API_URL}" /usr/share/nginx/html | wc -l)"; \
    test "${matches}" -ge 1; \
    grep -rlF "${OLD_API_URL}" /usr/share/nginx/html | \
      xargs sed -i "s|${OLD_API_URL}|${NEW_API_URL}|g"; \
    ! grep -rF "${OLD_API_URL}" /usr/share/nginx/html; \
    grep -rF "${NEW_API_URL}" /usr/share/nginx/html >/dev/null; \
    test -n "${APP_RELEASE}"; \
    test -n "${RELEASE_VERSION}"; \
    test -n "${BUILD_TIME}"; \
    printf '%s\n' \
      "{\"schema_version\":1,\"component\":\"editor\",\"release\":\"${APP_RELEASE}\",\"release_version\":\"${RELEASE_VERSION}\",\"built_at\":\"${BUILD_TIME}\",\"environment\":\"staging\"}" \
      > /usr/share/nginx/html/release.json
