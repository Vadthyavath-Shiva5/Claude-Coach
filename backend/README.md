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
2. Set `ANTHROPIC_API_KEY` (for future external model integration)
3. Install and run:
   - `npm install`
   - `npm run dev`

## Deploy

- Docker deployment is supported via `Dockerfile`.
- Render starter config included in `render.yaml`.
- After deployment, set extension API base URL to your backend URL.
