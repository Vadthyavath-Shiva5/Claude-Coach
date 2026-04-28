import "dotenv/config";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import {
  analyzePrompt,
  buildIntent,
  generatePrompt,
  generateSkillFiles,
  recommendSkills
} from "./coach-logic.js";
import {
  buildIntentWithClaude,
  classifyPromptWithClaude,
  generateSkillPackageWithClaude,
  recommendSkillsWithClaude,
  restructurePromptWithClaude
} from "./claude-client.js";
import {
  analyzeIntentSchema,
  clarifyIntentSchema,
  generateSkillSchema,
  recommendSkillsSchema,
  restructurePromptSchema
} from "./schemas.js";

const app = express();
const port = Number(process.env.PORT || 8080);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
const sharedApiKey = process.env.API_SHARED_KEY || "";
const allowedOrigins = allowedOrigin
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const useClaudeIntelligence = Boolean(process.env.ANTHROPIC_API_KEY);

app.use(
  cors({
    origin:
      allowedOrigins.length === 1 && allowedOrigins[0] === "*"
        ? true
        : (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
              return;
            }
            callback(new Error("CORS origin blocked"));
          }
  })
);
app.use(express.json({ limit: "1mb" }));

function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.use("/v1", (req, res, next) => {
  if (!sharedApiKey) {
    next();
    return;
  }

  const key = req.header("x-api-key");
  if (!key || key !== sharedApiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "claude-coach-backend" });
});

app.post("/v1/intent/analyze", asyncHandler(async (req, res) => {
  const parsed = analyzeIntentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const { prompt } = parsed.data;
  try {
    const analysis = useClaudeIntelligence ? await classifyPromptWithClaude(prompt) : analyzePrompt(prompt);
    res.json({
      ...analysis,
      promptLength: prompt.trim().split(/\s+/).filter(Boolean).length
    });
    return;
  } catch (error) {
    if (useClaudeIntelligence) {
      res.status(502).json({
        error: "Intelligence provider failure",
        message: error instanceof Error ? error.message : "Claude classification failed."
      });
      return;
    }
    const analysis = analyzePrompt(prompt);
    res.json({
      ...analysis,
      promptLength: prompt.trim().split(/\s+/).filter(Boolean).length
    });
    return;
  }
}));

app.post("/v1/intent/clarify", asyncHandler(async (req, res) => {
  const parsed = clarifyIntentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const intent = useClaudeIntelligence
      ? await buildIntentWithClaude(parsed.data.prompt, parsed.data.answers)
      : buildIntent(parsed.data.prompt, parsed.data.answers);
    res.json({ intent });
    return;
  } catch (error) {
    if (useClaudeIntelligence) {
      res.status(502).json({
        error: "Intelligence provider failure",
        message: error instanceof Error ? error.message : "Claude intent builder failed."
      });
      return;
    }
    res.json({ intent: buildIntent(parsed.data.prompt, parsed.data.answers) });
    return;
  }
}));

app.post("/v1/prompt/restructure", asyncHandler(async (req, res) => {
  const parsed = restructurePromptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const improvedPrompt = useClaudeIntelligence
      ? await restructurePromptWithClaude(parsed.data.intent)
      : generatePrompt(parsed.data.intent);
    res.json({ improvedPrompt });
    return;
  } catch (error) {
    if (useClaudeIntelligence) {
      res.status(502).json({
        error: "Intelligence provider failure",
        message: error instanceof Error ? error.message : "Claude prompt restructuring failed."
      });
      return;
    }
    res.json({ improvedPrompt: generatePrompt(parsed.data.intent) });
    return;
  }
}));

app.post("/v1/skills/recommend", asyncHandler(async (req, res) => {
  const parsed = recommendSkillsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const skills = useClaudeIntelligence
      ? await recommendSkillsWithClaude(parsed.data.prompt)
      : recommendSkills(parsed.data.prompt);
    res.json({ skills });
    return;
  } catch (error) {
    if (useClaudeIntelligence) {
      res.status(502).json({
        error: "Intelligence provider failure",
        message: error instanceof Error ? error.message : "Claude skill recommendation failed."
      });
      return;
    }
    res.json({ skills: recommendSkills(parsed.data.prompt) });
    return;
  }
}));

app.post("/v1/skills/generate", asyncHandler(async (req, res) => {
  const parsed = generateSkillSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const payload = useClaudeIntelligence
      ? await generateSkillPackageWithClaude(parsed.data.skillName || "", parsed.data.prompt || "")
      : generateSkillFiles(parsed.data.skillName || "", parsed.data.prompt || "");
    res.json(payload);
    return;
  } catch (error) {
    if (useClaudeIntelligence) {
      res.status(502).json({
        error: "Intelligence provider failure",
        message: error instanceof Error ? error.message : "Claude skill generation failed."
      });
      return;
    }
    res.json(generateSkillFiles(parsed.data.skillName || "", parsed.data.prompt || ""));
    return;
  }
}));

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  res.status(500).json({ error: "Internal Server Error", message });
});

app.listen(port, () => {
  console.log(`Claude Coach backend listening on :${port}`);
});
