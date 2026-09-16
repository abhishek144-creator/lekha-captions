# Lekha Captions marketing site

This folder is an optional static Next.js marketing website. The published Vite app uses `lekhacaptions.com` as its primary domain.

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
- Environment variable: `NEXT_PUBLIC_APP_URL=https://lekhacaptions.com`
- Production domain: `lekhacaptions.com`
- App/editor domain: `lekhacaptions.com`

Keep `lekhacaptions.com` as the primary domain. Redirect `www.lekhacaptions.com` and the legacy `app.lekhacaptions.com` hostname to it.

The site uses the Next.js App Router with `output: 'export'`, so no Netlify server runtime or backend functions are required.
