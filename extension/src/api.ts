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

export async function analyzeIntent(prompt: string): Promise<{ isComplex: boolean }> {
  if (!API_BASE_URL) return { isComplex: isComplexPrompt(prompt) };
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
  skillMd: string;
  instructionsMd: string;
}> {
  if (!API_BASE_URL) {
    return {
      skillMd: `# ${skillName || "Custom Skill"}\n\nGenerated locally for prompt:\n${prompt}`,
      instructionsMd: "# instructions\n\nGenerated locally."
    };
  }
  return postJson("/v1/skills/generate", { skillName, prompt });
}
