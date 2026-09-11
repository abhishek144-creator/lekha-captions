ARG BASE_IMAGE
FROM ${BASE_IMAGE}

USER root

ARG APP_RELEASE
ARG RELEASE_VERSION
ARG BUILD_TIME

# This is deliberately a narrowly pinned patch over the currently deployed
# frontend image. It preserves the existing, verified browser configuration
# while changing the false retry-banner condition. A normal source build will
# contain the equivalent source fix in src/pages/Dashboard.jsx.
RUN set -eu; \
    asset="$(grep -rlF 'Captions were not generated. Your video is saved' /usr/share/nginx/html/assets | head -n 1)"; \
    test -n "$asset"; \
    sed -i 's|Bt&&D&&R\.length===0|Bt\&\&D\&\&R.length===0\&\&!ve|' "$asset"; \
    grep -F 'Bt&&D&&R.length===0&&!ve' "$asset"; \
    test -n "${APP_RELEASE}"; \
    test -n "${RELEASE_VERSION}"; \
    test -n "${BUILD_TIME}"; \
    sed -i -E \
      -e "s/(\"release\":\")[a-f0-9]{40}/\\1${APP_RELEASE}/" \
      -e "s/(\"release_version\":\")[^\"]+/\\1${RELEASE_VERSION}/" \
      -e "s/(\"built_at\":\")[^\"]+/\\1${BUILD_TIME}/" \
      /usr/share/nginx/html/release.json; \
    sed -i -E \
      "s/(name=\"lekha-release\" content=\")[a-f0-9]{40}/\\1${APP_RELEASE}/" \
      /usr/share/nginx/html/index.html; \
    grep -F "${APP_RELEASE}" /usr/share/nginx/html/release.json; \
    grep -F "${APP_RELEASE}" /usr/share/nginx/html/index.html

USER 101
