# Extension

Chrome extension frontend for `Claude Capability Coach` that activates on `claude.ai`.

## Implemented UX

- Manifest V3 extension setup
- Content script:
  - detects `claude.ai`
  - injects fixed right sidebar (`360px`) hidden by default
  - injects floating `Coach` toggle button
  - smooth slide in/out behavior (`transform` + `transition`)
  - no page margin push and no auto textarea reading
- Sidebar React app (TypeScript):
  - guided state-machine flow:
    - Home
    - Chat Input
    - Questions
    - Intent Editor
    - Prompt Output
    - Skill Decision
    - Skill Generator
  - navigation stack with Back support
  - manual task input (user controlled)
  - editable structured intent and prompt generation
  - copy + insert prompt actions
  - skill file preview and download (`SKILL.md`, `instructions.md`)
  - visual stepper and progress indicators
  - session export (`session-summary.md`)

## End User Guide

1. Open `claude.ai`
2. Click floating `Coach` button
3. Click `Start`
4. Describe your task and submit
5. Answer questions (if shown)
6. Edit intent and click `Next`
7. Copy or insert generated prompt into Claude
8. Optionally generate and download reusable skill files

### How to use outputs

- Generated prompt:
  - paste into Claude and run
  - tweak constraints/output format for better iterations
- `SKILL.md`:
  - store reusable workflow definition for similar tasks
- `instructions.md`:
  - store operating checklist for repeatable execution

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

The app prefers backend intelligence APIs and falls back to local logic only if backend is unavailable.

## Environment

- Create `extension/.env` from `extension/.env.example`
- Set:
  - `VITE_INTELLIGENCE_API_BASE_URL`
  - `VITE_INTELLIGENCE_API_KEY` (optional shared key)
