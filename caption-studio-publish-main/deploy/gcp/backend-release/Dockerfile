ARG BASE_IMAGE
FROM ${BASE_IMAGE}
ARG APP_RELEASE
LABEL org.opencontainers.image.revision=${APP_RELEASE}
ENV APP_RELEASE=${APP_RELEASE}
COPY backend/ /app/backend/
COPY scripts/render_template_overlay.mjs /app/scripts/render_template_overlay.mjs
COPY scripts/media_job_client.py scripts/media_load_smoke.py scripts/staging_smoke.py /app/scripts/
RUN test -f /app/backend/flat_fonts/Inter.ttf \
    && test -f /app/backend/flat_fonts/NotoSansDevanagari.ttf \
    && python3 -m compileall -q /app/backend /app/scripts/media_job_client.py \
    && if command -v node >/dev/null 2>&1; then node --input-type=module -e "import puppeteer from 'puppeteer'; const browser = await puppeteer.launch({headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox']}); const page = await browser.newPage(); await page.setContent('<p>renderer-ready</p>'); await browser.close();"; fi
