FROM node:20-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg ca-certificates dumb-init \
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
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health/readiness', timeout=4)" || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["python3", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
