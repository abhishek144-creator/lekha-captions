ARG BASE_IMAGE
FROM ${BASE_IMAGE}

USER root

ARG APP_RELEASE
ARG RELEASE_VERSION
ARG BUILD_TIME

# This is deliberately a narrowly pinned patch over the currently deployed
# frontend image. It preserves the existing, verified browser configuration
# while changing the retry-banner behavior. A normal source build contains the
# equivalent source fix in src/pages/Dashboard.jsx.
RUN set -eu; \
    asset="$(grep -rlF 'Captions were not generated. Your video is saved' /usr/share/nginx/html/assets | head -n 1)"; \
    test -n "$asset"; \
    sed -i 's|Bt&&D&&R\.length===0|Bt\&\&D\&\&R.length===0\&\&!ve|' "$asset"; \
    sed -i 's|,(0,C.useEffect)(()=>{if(!Bt)return;let e=window.setTimeout(()=>Vt(!1),1e4);return()=>window.clearTimeout(e)},\[Bt\])||' "$asset"; \
    sed -i 's|D&&R\.length===0?Vt(!0):Vt(!1)},\[D,R\.length\]|D\&\&R.length===0\&\&!ve?Vt(!0):Vt(!1)},[D,R.length,ve]|' "$asset"; \
    grep -F 'Bt&&D&&R.length===0&&!ve' "$asset"; \
    grep -F 'D&&R.length===0&&!ve?Vt(!0):Vt(!1)},[D,R.length,ve]' "$asset"; \
    ! grep -F 'if(!Bt)return;let e=window.setTimeout(()=>Vt(!1),1e4)' "$asset"; \
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
