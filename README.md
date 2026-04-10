# Furst Response Setup

## API key location

Paste your model provider key only in the backend `.env`.

For Groq, use:

- `FRBackend/.env`

Recommended variables:

`AI_PROVIDER=groq`

`GROQ_API_KEY=PASTE_YOUR_REAL_KEY_HERE`

`GROQ_MODEL=llama-3.3-70b-versatile`

Also accepted as fallback names:

`API_KEY`

`MODEL_NAME`

## Local run

1. Open `FRBackend/.env` and paste the key and model.
2. From `FRBackend`, run `npm start`.
3. Open `http://localhost:3000`.

## Online hosting

GitHub Pages cannot read `.env` files or run Node/Express. So if you host the frontend on GitHub Pages, you must also deploy `FRBackend` somewhere else such as Render, Railway, or a VPS.

Then set only the backend URL in:

- `site-config.js`

Example:

`backendBaseUrl: "https://your-backend.onrender.com"`

The API key still stays only in `FRBackend/.env` on that backend host.

If Render still shows a missing-key error, open `/api/health` on your deployed backend and confirm `aiConfigured` is `true`.
