# Lekha Captions marketing site

This folder is the independent, static Next.js marketing website for `lekhacaptions.com`. It does not import, move, or deploy the Vite dashboard/editor. The product app remains a separate deployment at `app.lekhacaptions.com`.

## Local development

1. Copy `.env.example` to `.env.local` if you need to override the product app URL.
2. Run `npm install`.
3. Run `npm run dev` and open the local URL shown by Next.js.
4. Run `npm run build` to create the static site in `out`.

## Netlify deployment

Create a **new Netlify site** for the marketing site. Do not reuse the dashboard/editor site.

- Base directory: `landing-next`
- Build command: `npm run build`
- Publish directory: `out`
- Environment variable: `NEXT_PUBLIC_APP_URL=https://app.lekhacaptions.com`
- Production domain: `lekhacaptions.com`
- App/editor domain: `app.lekhacaptions.com`

In Netlify DNS/domain settings, attach both `lekhacaptions.com` and `www.lekhacaptions.com` to this marketing-site deployment and choose the preferred primary-domain redirect. Keep `app.lekhacaptions.com` connected only to the existing Vite dashboard/editor deployment.

The site uses the Next.js App Router with `output: 'export'`, so no Netlify server runtime or backend functions are required.
