# Rift Assistant — Official Landing Page

Official landing page for **Rift Assistant** ([riftassistant.com](https://riftassistant.com)).

> Code on your Mac from your phone. Drive Claude Code running on your Mac, use a real terminal and git, and watch and control iOS simulators, Android emulators and web previews live, from any network. Your Mac can stay locked.

## Pages

Plain static HTML in `public/`, no build step. `cleanUrls` serves `privacy.html` at `/privacy`.

| URL | File | Notes |
|---|---|---|
| `/` | `index.html` | Landing page (inline CSS) |
| `/setup` | `setup.html` | Setup guide |
| `/faq` | `faq.html` | Full FAQ, holds the `FAQPage` JSON-LD |
| `/support` | `support.html` | Contact + troubleshooting (App Store Support URL) |
| `/privacy` | `privacy.html` | Privacy Policy (store Privacy Policy URL) |
| `/terms` | `terms.html` | Terms of Use |

Content pages share `public/assets/site.css`. When you add a page, add it to `public/sitemap.xml` and the footer of every page.

## 🚀 Deployment (Vercel)

Deployed on Vercel from this repo. The primary domain is `www.riftassistant.com` (the apex redirects to it in Vercel domain settings), so canonical URLs use `www`. `vercel.json` sets the output directory to `public/`, clean URLs and cache headers. Unknown paths get `public/404.html` with a 404 status.

## 🛠 Local Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. `server.js` mirrors Vercel locally (clean URLs and real 404s).
