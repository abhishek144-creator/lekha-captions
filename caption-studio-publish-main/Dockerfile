ARG APP_RELEASE

FROM python:3.11-slim-bookworm AS python-runtime
ARG APP_RELEASE
LABEL org.opencontainers.image.revision=${APP_RELEASE}
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates dumb-init ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.lock backend/requirements.lock
RUN python3 -m pip install --no-cache-dir --require-hashes -r backend/requirements.lock
COPY . .
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
ENV SERVICE_ROLE=worker WORKER_QUEUES=caption_transcription_jobs_staging
CMD ["python3", "-m", "backend.worker"]

FROM node:22-bookworm-slim AS render
ARG APP_RELEASE
LABEL org.opencontainers.image.revision=${APP_RELEASE}
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_CONTAINER_NO_SANDBOX=1 \
    PREBAKED_FONTS_ONLY=1 \
    ENABLE_CHROMIUM_POOL=1 \
    SERVICE_ROLE=worker \
    WORKER_QUEUES=caption_export_jobs
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 python3-pip ffmpeg ca-certificates chromium dumb-init fontconfig fonts-liberation \
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
RUN python3 -m backend.prebake_fonts --fonts-dir /app/fonts --system-fonts-dir /usr/local/share/fonts/lekha \
    && fc-cache -f
RUN chown -R node:node /app
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python3 -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/health/readiness' % os.environ.get('PORT', '8000'), timeout=4)" || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["python3", "-m", "backend.worker"]

# Preserve the historical default for local builds while deployments select an
# explicit api, render, or transcription target.
FROM render AS app
