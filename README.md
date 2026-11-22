# Rift Assistant — Official Landing Page

Official landing page for **Rift Assistant** ([riftassistant.com](https://riftassistant.com)).

> Code on your Mac from your phone, anywhere in the world. Chat with Claude Code, review git diffs, and watch & control live iOS simulators, Android emulators, and Chrome web previews directly from your phone — even with your Mac locked.

## 🚀 Deployment (Railway)

This repository is built for zero-config Railway deployment:

1. Open your project in [Railway](https://railway.app).
2. Click **+ New Service** → **GitHub Repo** → select `LeDrOxx/rift-landing`.
3. Railway automatically detects Node/Express via Nixpacks, runs `npm install`, and starts the server with `npm start`.
4. In **Settings** → **Networking** → **Custom Domains**, add:
   - `riftassistant.com`
   - `www.riftassistant.com`
5. Point your DNS records as specified by Railway.

## 🛠 Local Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.
