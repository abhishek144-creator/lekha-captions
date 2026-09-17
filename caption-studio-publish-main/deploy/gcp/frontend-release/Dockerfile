ARG BASE_IMAGE
FROM ${BASE_IMAGE}

USER root

ARG APP_RELEASE
ARG RELEASE_VERSION
ARG BUILD_TIME
ARG SENTRY_DSN

RUN test -n "${APP_RELEASE}" \
    && test -n "${RELEASE_VERSION}" \
    && test -n "${BUILD_TIME}" \
    && sed -i -E \
      -e "s/(\"release\":\")[a-f0-9]{40}/\\1${APP_RELEASE}/" \
      -e "s/(\"release_version\":\")[^\"]+/\\1${RELEASE_VERSION}/" \
      -e "s/(\"built_at\":\")[^\"]+/\\1${BUILD_TIME}/" \
      /usr/share/nginx/html/release.json \
    && sed -i -E \
      "s/(name=\"lekha-release\" content=\")[a-f0-9]{40}/\\1${APP_RELEASE}/" \
      /usr/share/nginx/html/index.html \
    && printf 'window.__LEKHA_RUNTIME_CONFIG__ = Object.freeze({ sentryDsn: %s })\n' \
      "\"${SENTRY_DSN}\"" \
      > /usr/share/nginx/html/runtime-config.js \
    && grep -F "${APP_RELEASE}" /usr/share/nginx/html/release.json \
    && grep -F "${APP_RELEASE}" /usr/share/nginx/html/index.html

USER 101
