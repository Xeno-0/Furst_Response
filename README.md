# Furst Response Setup

## Gemini key location

Paste your Gemini API key only in:

- `FRBackend/.env`

Use this line:

`GEMINI_API_KEY=PASTE_YOUR_REAL_KEY_HERE`

## Local run

1. Open `FRBackend/.env` and paste the key.
2. From `FRBackend`, run `npm start`.
3. Open `http://localhost:3000`.

## Online hosting

GitHub Pages cannot read `.env` files or run Node/Express. So if you host the frontend on GitHub Pages, you must also deploy `FRBackend` somewhere else such as Render, Railway, or a VPS.

Then set only the backend URL in:

- `site-config.js`

Example:

`backendBaseUrl: "https://your-backend.onrender.com"`

The Gemini key still stays only in `FRBackend/.env` on that backend host.
