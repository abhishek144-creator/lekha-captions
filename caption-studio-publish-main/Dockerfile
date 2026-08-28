FROM node:20-bookworm-slim

# Railway's container runtime blocks Chromium's user-namespace sandbox. This
# bypass is intentionally image-scoped, never a customer-controlled option.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer \
    PUPPETEER_CONTAINER_NO_SANDBOX=1

# Puppeteer renders the authored caption templates during export. Keep the
# Chrome runtime libraries in the production image; without these the worker
# fails before a render begins (for example: libnss3.so missing).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        ffmpeg \
        ca-certificates \
        dumb-init \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libgbm1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxrandr2 \
        xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY backend/requirements.txt backend/requirements.txt
RUN python3 -m pip install --break-system-packages --no-cache-dir -r backend/requirements.txt

COPY . .
RUN chown -R node:node /app
USER node

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD if [ "$SERVICE_ROLE" = "worker" ]; then python3 -c "import os, redis; redis.Redis.from_url(os.environ['REDIS_URL']).ping()"; else python3 -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/health/readiness' % os.environ.get('PORT', '8000'), timeout=4)"; fi || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "if [ \"$SERVICE_ROLE\" = \"worker\" ]; then exec python3 -m backend.worker; else exec python3 -m uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}; fi"]
