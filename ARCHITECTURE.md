# Project Architecture

## High-Level Design

```text
User on Claude.ai page
      |
      v
Chrome Extension Content Script
      |
      v
Sidebar Frontend (React)
      |
      v
Backend API Gateway
      |
      v
Intelligence Layer (Prompt Coach Engine)
      |
      +--> Intent Clarifier
      +--> Prompt Restructurer
      +--> Skill Recommender
      +--> Skill File Generator
```

## Components

### 1) Extension Layer
- Injects sidebar into Claude.ai
- Reads prompt text from Claude textarea (DOM only)
- Sends prompt and context to backend
- Receives structured coaching outputs

### 2) Frontend Layer
- Renders coaching UI in sidebar
- Captures clarifying question answers
- Displays improved prompt + skill recommendations
- Provides copy-to-clipboard and download actions

### 3) Backend Layer
- Exposes endpoints for analysis and generation
- Validates request payloads
- Handles rate limiting/logging
- Proxies to intelligence orchestration services
- Must be publicly deployed for extension users (HTTPS + CORS)

### 4) Intelligence Layer (API)
- Detects intent complexity and missing context
- Generates clarification questions
- Produces structured intent object
- Rewrites user prompt into high quality format
- Recommends top skills and generates skill file content

## Data Flow

1. `capturePrompt` from Claude page
2. `analyzeIntent` (complexity + domain + missing constraints)
3. `clarifyIntent` (question/answer loop)
4. `buildIntentObject` (normalized structure)
5. `restructurePrompt` (final improved prompt)
6. `recommendSkills` (top 3)
7. `generateSkillFiles` (`SKILL.md`, `instructions.md`)

## Constraints

- No direct Claude API integration
- DOM-based page reading only
- Works only when `claude.ai` tab is active
- User maintains control: extension suggests, user decides what to paste
- Production extension requires a deployed backend URL; localhost is dev-only

## Suggested API Surface

- `POST /v1/intent/analyze`
- `POST /v1/intent/clarify`
- `POST /v1/prompt/restructure`
- `POST /v1/skills/recommend`
- `POST /v1/skills/generate`
