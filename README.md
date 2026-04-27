# Claude Coach - Chrome Extension + Intelligence API

Claude Coach is a layered assistant that runs alongside Claude.ai and helps users write better prompts before they submit them.

It consists of:
- A downloadable Chrome extension (distributed via install link/package)
- A frontend sidebar UI inside the extension for interaction and guidance
- A deployed backend intelligence API for intent analysis and prompt restructuring
- A skill system that recommends and generates reusable skill files

## Core User Flow

1. User types a prompt in Claude.ai.
2. Extension reads prompt text from the page DOM.
3. Sidebar sends prompt to intelligence API.
4. API performs:
   - intent clarification prompts
   - prompt restructuring
   - skill recommendation
5. Sidebar shows outputs:
   - Better prompt (copy/paste)
   - Top skill suggestions
   - Generated skill files (`SKILL.md`, `instructions.md`)

## Project Structure

```text
Claude-Coach/
  README.md
  ARCHITECTURE.md
  extension/
  frontend/
  backend/
  intelligence-api/
  shared/
  phases/
    phase-1-sidebar-injection/
    phase-2-prompt-capture/
    phase-3-intent-detection/
    phase-4-clarification-questions/
    phase-5-intent-builder/
    phase-6-prompt-restructuring/
    phase-7-skill-recommendation/
    phase-8-skill-generator/
  Initial setup/
```

## Output Contract (Sidebar)

- `improvedPrompt`: rewritten prompt ready for Claude
- `clarifyingQuestions`: any additional questions asked/answered
- `recommendedSkills`: top 3 skills with reason
- `generatedSkillFiles`: file content for `SKILL.md` and `instructions.md`

## Tech Split

- `extension/`: manifest, content script, DOM listeners, message passing
- `frontend/`: sidebar app UI and state management
- `backend/`: API routes, auth, request validation, persistence
- `intelligence-api/`: orchestration layer for prompt analysis/generation
- `shared/`: common types and schemas

## Delivery Plan

Execution is split into 8 implementation phases, documented under `phases/`.
Current execution status is tracked in `phases/IMPLEMENTATION_STATUS.md`.

## Distribution and Deployment (Important)

- The frontend is the Chrome extension itself, and users install it from a shared download/install link.
- The backend must be deployed to a public environment so installed extensions can call it from user machines.
- Local backend works only for development/testing; production usage requires a hosted API URL and CORS/HTTPS setup.

## Secrets Handling

- Store sensitive values in `.env` files only (never in extension source files).
- `.env` files are git-ignored to keep secrets out of GitHub.
- Use `.env.example` files as templates for required variables.

## Test End-to-End

1. Start backend:
   - `cd backend`
   - copy `.env.example` to `.env`
   - set `ANTHROPIC_API_KEY` and other values
   - `npm install && npm run dev`
2. Build extension:
   - `cd extension`
   - copy `.env.example` to `.env`
   - set `VITE_INTELLIGENCE_API_BASE_URL` to backend URL
   - `npm install && npm run build`
3. Load extension in Chrome:
   - Open `chrome://extensions`
   - Enable Developer mode
   - Load unpacked from `extension/dist`
4. Open `https://claude.ai`, click `Start Coach`, and test flow.
