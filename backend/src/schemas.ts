import { z } from "zod";

export const analyzeIntentSchema = z.object({
  prompt: z.string().min(1)
});

export const clarifyIntentSchema = z.object({
  prompt: z.string().min(1),
  answers: z
    .object({
      frequency: z.enum(["one-time", "weekly", "daily"]).optional(),
      outputFormat: z.enum(["report", "summary", "table"]).optional(),
      detailLevel: z.enum(["quick", "detailed"]).optional()
    })
    .default({})
});

export const restructurePromptSchema = z.object({
  intent: z.object({
    goal: z.string(),
    instructions: z.array(z.string()),
    outputFormat: z.enum(["report", "summary", "table"]),
    tone: z.enum(["professional", "friendly", "neutral"]),
    notes: z.string(),
    frequency: z.enum(["one-time", "weekly", "daily"])
  })
});

export const recommendSkillsSchema = z.object({
  prompt: z.string().min(1)
});

export const generateSkillSchema = z.object({
  skillName: z.string().optional(),
  prompt: z.string().optional()
});
