# Backend

Deployable API service for `Claude Capability Coach`.

## Implemented Endpoints

- `GET /health`
- `POST /v1/intent/analyze`
- `POST /v1/intent/clarify`
- `POST /v1/prompt/restructure`
- `POST /v1/skills/recommend`
- `POST /v1/skills/generate`

## Run Locally

1. Copy `.env.example` to `.env`
2. Set required values:
   - `ANTHROPIC_API_KEY` (future external model integration)
   - `ALLOWED_ORIGIN` (comma-separated list supported)
   - `API_SHARED_KEY` (optional request auth for `/v1/*`)
3. Install and run:
   - `npm install`
   - `npm run dev`

## Deploy

- Docker deployment is supported via `Dockerfile`.
- Render starter config included in `render.yaml`.
- After deployment, set extension API base URL to your backend URL.
- If `API_SHARED_KEY` is configured, extension must send matching `x-api-key`.
