ARG APP_RELEASE
ARG APP_BUILD_TIME
# Railway passes service variables to declared build args, so each service picks
# its image with LEKHA_SERVICE_TARGET=api|transcription|render (default render).
ARG LEKHA_SERVICE_TARGET=render

# Seed from the official image, then perform one bounded incremental update.
# The upstream image can be older than the accepted seven-day database age.
# Change this date (or pass the build arg) during the required weekly refresh;
# it invalidates the update layer without starting a runtime updater daemon.
FROM clamav/clamav-debian:stable AS clamav-signatures
ARG CLAMAV_SIGNATURES_REFRESH=2026-10-21
RUN test -n "$CLAMAV_SIGNATURES_REFRESH" \
    && timeout 180 freshclam --stdout --datadir=/var/lib/clamav --user=root \
    && mkdir /prepared-db \
    && find /var/lib/clamav -maxdepth 1 -type f \( -name '*.cvd' -o -name '*.cld' \) -exec cp '{}' /prepared-db/ \;

FROM python:3.11-slim-bookworm AS python-runtime
ARG APP_RELEASE
ARG APP_BUILD_TIME
LABEL org.opencontainers.image.revision=${APP_RELEASE}
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates clamav clamav-daemon dumb-init ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.lock backend/requirements.lock
RUN python3 -m pip install --no-cache-dir --require-hashes -r backend/requirements.lock
# Used with CLAMAV_SCAN_CMD="clamscan --stdout --database=/opt/clamav-db".
COPY --from=clamav-signatures /prepared-db/ /opt/clamav-db/
COPY scripts/verify_clamav_signatures.py /tmp/verify_clamav_signatures.py
# Both API and transcription builds must contain clamscan and its signature DB.
# Transcription workers also run clamd (deploy/clamav/clamd.conf) so the
# database stays loaded between scans.
RUN clamscan --version \
    && clamd --version \
    && (test -s /opt/clamav-db/main.cvd || test -s /opt/clamav-db/main.cld) \
    && python3 /tmp/verify_clamav_signatures.py /opt/clamav-db \
    && rm /tmp/verify_clamav_signatures.py \
    && ls /opt/clamav-db
COPY . .
# Release identity: the app reports this as APP_BUILD_TIME unless it is set.
RUN if [ -n "$APP_BUILD_TIME" ]; then printf '%s\n' "$APP_BUILD_TIME" > .build-time; else date -u +%Y-%m-%dT%H:%M:%SZ > .build-time; fi
RUN useradd --uid 1000 --create-home --shell /usr/sbin/nologin lekha \
    && chown -R lekha:lekha /app
USER lekha
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python3 -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/health/readiness' % os.environ.get('PORT', '8000'), timeout=4)" || exit 1
ENTRYPOINT ["dumb-init", "--"]

FROM python-runtime AS api
CMD ["sh", "-c", "exec python3 -m uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --limit-concurrency ${UVICORN_LIMIT_CONCURRENCY:-64} --backlog ${UVICORN_BACKLOG:-512} --timeout-keep-alive ${UVICORN_KEEP_ALIVE_SECONDS:-10}"]

FROM python-runtime AS transcription
ENV SERVICE_ROLE=worker WORKER_QUEUES=caption_media_scan_jobs,caption_transcription_jobs CLAMAV_HOST=127.0.0.1
CMD ["sh", "-c", "clamd --config-file=/app/deploy/clamav/clamd.conf & exec python3 -m backend.worker"]

FROM node:22-bookworm-slim AS render
ARG APP_RELEASE
ARG APP_BUILD_TIME
LABEL org.opencontainers.image.revision=${APP_RELEASE}
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_CONTAINER_NO_SANDBOX=1 \
    RENDER_BROWSER_REUSE=1 \
    PREFER_PACKAGED_RENDER_FONTS=1 \
    RENDER_FONT_BUNDLE_PATH=/app/.render_fonts/fonts.css \
    RENDER_FONT_BUNDLE_REQUIRED=1 \
    SERVICE_ROLE=worker \
    WORKER_QUEUES=caption_export_fast,caption_export_jobs,caption_export_heavy
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 python3-pip ffmpeg ca-certificates chromium dumb-init fonts-liberation \
        fontconfig fonts-inter fonts-noto-core \
        libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 libdbus-1-3 \
        libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
        libpangocairo-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
        libxdamage1 libxext6 libxfixes3 libxrandr2 xdg-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
RUN node --input-type=module -e "import puppeteer from 'puppeteer'; const browser = await puppeteer.launch({headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox']}); const page = await browser.newPage(); await page.setContent('<p>renderer-ready</p>'); await browser.close();"
COPY backend/requirements.lock backend/requirements.lock
RUN python3 -m pip install --break-system-packages --no-cache-dir --require-hashes -r backend/requirements.lock
COPY . .
RUN (if [ -n "$APP_BUILD_TIME" ]; then printf '%s\n' "$APP_BUILD_TIME"; else date -u +%Y-%m-%dT%H:%M:%SZ; fi) > .build-time \
    && install -d /usr/local/share/fonts/truetype/lekha \
    && cp backend/flat_fonts/*.ttf /usr/local/share/fonts/truetype/lekha/ \
    && fc-cache -f \
    && node scripts/build_render_font_bundle.mjs /app/.render_fonts/fonts.css \
    && chown -R node:node /app
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python3 -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/health/readiness' % os.environ.get('PORT', '8000'), timeout=4)" || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "node scripts/render_browser_daemon.mjs & exec python3 -m backend.worker"]

# Preserve the historical default (render) for local builds while deployments
# select an explicit api, render, or transcription target.
FROM ${LEKHA_SERVICE_TARGET} AS app
