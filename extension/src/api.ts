import { buildIntent, generatePrompt, isComplexPrompt, recommendSkills } from "./logic";
import type { Answers, IntentModel, SkillSuggestion } from "./types";

const API_BASE_URL = import.meta.env.VITE_INTELLIGENCE_API_BASE_URL as string | undefined;
const INTELLIGENCE_API_KEY = import.meta.env.VITE_INTELLIGENCE_API_KEY as string | undefined;

async function postJson<T>(path: string, body: unknown): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("No API base URL configured.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(INTELLIGENCE_API_KEY ? { "x-api-key": INTELLIGENCE_API_KEY } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export interface AnalyzeIntentResponse {
  isComplex: boolean;
  classification: "simple" | "complex";
  reason: string;
  clarifyingQuestions: string[];
}

export async function analyzeIntent(prompt: string): Promise<AnalyzeIntentResponse> {
  if (!API_BASE_URL) {
    const isComplex = isComplexPrompt(prompt);
    return {
      isComplex,
      classification: isComplex ? "complex" : "simple",
      reason: isComplex
        ? "Complex task detected. Structured coaching is recommended."
        : "Simple request detected. You can answer directly without full coaching.",
      clarifyingQuestions: []
    };
  }
  return postJson("/v1/intent/analyze", { prompt });
}

export async function clarifyIntent(prompt: string, answers: Answers): Promise<{ intent: IntentModel }> {
  if (!API_BASE_URL) return { intent: buildIntent(prompt, answers) };
  return postJson("/v1/intent/clarify", { prompt, answers });
}

export async function restructurePrompt(intent: IntentModel): Promise<{ improvedPrompt: string }> {
  if (!API_BASE_URL) return { improvedPrompt: generatePrompt(intent) };
  return postJson("/v1/prompt/restructure", { intent });
}

export async function getSkillSuggestions(prompt: string): Promise<{ skills: SkillSuggestion[] }> {
  if (!API_BASE_URL) return { skills: recommendSkills(prompt) };
  return postJson("/v1/skills/recommend", { prompt });
}

export async function generateSkillFiles(skillName: string, prompt: string): Promise<{
  skillFolderName: string;
  files: Array<{ name: string; content: string }>;
}> {
  if (!API_BASE_URL) {
    return {
      skillFolderName: (skillName || "custom-skill").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      files: [
        {
          name: "SKILL.md",
          content: `---
name: ${skillName || "Custom Skill"}
description: Structured prompt coaching skill for repeatable tasks.
---

# Overview
Generated locally for prompt:
${prompt}
`
        },
        {
          name: "instructions.md",
          content: "# Instructions\n\nGenerated locally."
        }
      ]
    };
  }
  return postJson("/v1/skills/generate", { skillName, prompt });
}
