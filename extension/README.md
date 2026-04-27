# Extension

Chrome extension frontend for `Claude Capability Coach` that activates on `claude.ai`.

## Implemented MVP

- Manifest V3 extension setup
- Content script:
  - detects `claude.ai`
  - injects fixed right sidebar (`360px`)
  - shifts page with `margin-right`
  - reads prompt from `textarea`
  - sends prompt events to sidebar app
  - fallback mode when textarea is not found
- Sidebar React app (TypeScript):
  - state-driven coaching flow (idle → detection → questions → intent editor → prompt output → skill suggestions → action)
  - clarification questions (frequency, format, detail level)
  - editable structured intent
  - improved prompt generation + copy action
  - keyword-based skill suggestions (top 3)

## Local Build

From `extension/`:

- `npm install`
- `npm run build`

Then load `extension/dist` as an unpacked extension in Chrome.

## Downloadable Build Flow

After `npm run build`:

1. Zip the contents of `extension/dist`
2. Share the zip via GitHub release assets or cloud drive link
3. Test install in Chrome:
   - Open `chrome://extensions`
   - Enable Developer mode
   - Click `Load unpacked` and select `extension/dist`

For Chrome Web Store publishing later, upload the packaged extension through the developer dashboard.

## Intelligence API Wiring (next step)

Provide:
- deployed API base URL (`https://...`)
- endpoint paths for:
  - intent analyze
  - intent clarify
  - prompt restructure
  - skill recommend
  - skill generate
- auth mechanism (none / API key / bearer token)
- request/response JSON contracts for each endpoint

## Environment

- Create `extension/.env` from `extension/.env.example`
- Set:
  - `VITE_INTELLIGENCE_API_BASE_URL`
