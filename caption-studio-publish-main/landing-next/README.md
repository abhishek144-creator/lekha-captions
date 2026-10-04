# Lekha Captions marketing site

This folder is an optional static Next.js marketing website. The Vite editor is built on the existing editor site and served at `lekhacaptions.com/Dashboard` through Netlify rewrites.

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
- Environment variable: `NEXT_PUBLIC_APP_URL=https://lekhacaptions.com/Dashboard?entry=editor`
- Production domain: `lekhacaptions.com`
- Editor address: `lekhacaptions.com/Dashboard`

Keep `lekhacaptions.com` as the marketing primary domain and redirect `www` to it. Editor and login routes stay on the apex; `app.lekhacaptions.com` redirects to it; API requests use `api.lekhacaptions.com` on Railway.

The site uses the Next.js App Router with `output: 'export'`, so no Netlify server runtime or backend functions are required.

The marketing Netlify configuration proxies the registered editor routes, assets, runtime configuration and auth helpers to the editor Netlify subdomain. Existing marketing and legal routes remain static. Set `VITE_EDITOR_URL=https://lekhacaptions.com` on the editor build and include `https://lekhacaptions.com` in Railway `ALLOWED_ORIGINS`, Firebase authorized domains, App Check/reCAPTCHA domains, and R2 CORS.
