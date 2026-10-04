# Lekha Captions marketing site

This folder is an optional static Next.js marketing website. The Vite editor is published separately at `app.lekhacaptions.com`.

## Local development

1. Copy `.env.example` to `.env.local` if you need to override the product app URL.
2. Run `npm install`.
3. Run `npm run dev` and open the local URL shown by Next.js.
4. Run `npm run build` to create the static site in `out`.

## Netlify deployment

Use the existing `lekha-captions` Netlify marketing site. The `lekha-captions-staging` site hosts the editor.

- Base directory: `landing-next`
- Build command: `npm run build`
- Publish directory: `out`
- Environment variable: `NEXT_PUBLIC_APP_URL=https://app.lekhacaptions.com`
- Production domain: `lekhacaptions.com`
- App/editor domain: `app.lekhacaptions.com`

Keep `lekhacaptions.com` as the marketing primary domain and redirect `www` to it. Editor and login links point to `app.lekhacaptions.com`; API requests use `api.lekhacaptions.com` on Railway.

The site uses the Next.js App Router with `output: 'export'`, so no Netlify server runtime or backend functions are required.
