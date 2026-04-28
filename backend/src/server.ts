import "dotenv/config";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import {
  buildIntent,
  generatePrompt,
  generateSkillFiles,
  isComplexPrompt,
  recommendSkills
} from "./coach-logic.js";
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

app.post("/v1/intent/analyze", asyncHandler((req, res) => {
  const parsed = analyzeIntentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const { prompt } = parsed.data;
  res.json({
    isComplex: isComplexPrompt(prompt),
    promptLength: prompt.trim().split(/\s+/).filter(Boolean).length
  });
}));

app.post("/v1/intent/clarify", asyncHandler((req, res) => {
  const parsed = clarifyIntentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const intent = buildIntent(parsed.data.prompt, parsed.data.answers);
  res.json({ intent });
}));

app.post("/v1/prompt/restructure", asyncHandler((req, res) => {
  const parsed = restructurePromptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  res.json({ improvedPrompt: generatePrompt(parsed.data.intent) });
}));

app.post("/v1/skills/recommend", asyncHandler((req, res) => {
  const parsed = recommendSkillsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  res.json({ skills: recommendSkills(parsed.data.prompt) });
}));

app.post("/v1/skills/generate", asyncHandler((req, res) => {
  const parsed = generateSkillSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  res.json(generateSkillFiles(parsed.data.skillName || "", parsed.data.prompt || ""));
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
