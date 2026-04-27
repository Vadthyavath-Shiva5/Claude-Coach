import "dotenv/config";
import cors from "cors";
import express from "express";
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

app.use(cors({ origin: allowedOrigin === "*" ? true : allowedOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "claude-coach-backend" });
});

app.post("/v1/intent/analyze", (req, res) => {
  const parsed = analyzeIntentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { prompt } = parsed.data;
  return res.json({
    isComplex: isComplexPrompt(prompt),
    promptLength: prompt.trim().split(/\s+/).filter(Boolean).length
  });
});

app.post("/v1/intent/clarify", (req, res) => {
  const parsed = clarifyIntentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }
  const intent = buildIntent(parsed.data.prompt, parsed.data.answers);
  return res.json({ intent });
});

app.post("/v1/prompt/restructure", (req, res) => {
  const parsed = restructurePromptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }
  return res.json({ improvedPrompt: generatePrompt(parsed.data.intent) });
});

app.post("/v1/skills/recommend", (req, res) => {
  const parsed = recommendSkillsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }
  return res.json({ skills: recommendSkills(parsed.data.prompt) });
});

app.post("/v1/skills/generate", (req, res) => {
  const parsed = generateSkillSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }
  return res.json(generateSkillFiles(parsed.data.skillName || "", parsed.data.prompt || ""));
});

app.listen(port, () => {
  console.log(`Claude Coach backend listening on :${port}`);
});
