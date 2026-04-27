import type { Answers, IntentModel, SkillSuggestion } from "./types";

const COMPLEX_KEYWORDS = ["analyse", "generate", "create", "report", "weekly"];

export function isComplexPrompt(prompt: string): boolean {
  const clean = prompt.trim().toLowerCase();
  if (!clean) {
    return false;
  }

  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  if (wordCount > 15) {
    return true;
  }

  return COMPLEX_KEYWORDS.some((keyword) => clean.includes(keyword));
}

export function buildIntent(prompt: string, answers: Answers): IntentModel {
  const cleanPrompt = prompt.trim();
  const goal = cleanPrompt || "Help improve this task prompt.";
  const outputFormat = answers.outputFormat ?? "summary";
  const frequency = answers.frequency ?? "one-time";
  const detailLevel = answers.detailLevel ?? "quick";

  const instructions = [
    "Understand the exact task objective.",
    "Identify missing context and assumptions.",
    `Respond with a ${detailLevel} level of detail.`,
    `Format the final output as a ${outputFormat}.`
  ];

  return {
    goal,
    instructions,
    outputFormat,
    tone: "professional",
    notes: frequency === "one-time" ? "" : `This task repeats on a ${frequency} basis.`,
    frequency
  };
}

export function generatePrompt(intent: IntentModel): string {
  return [
    "You are an expert assistant.",
    `Goal: ${intent.goal}`,
    "Instructions:",
    ...intent.instructions.map((item, index) => `${index + 1}. ${item}`),
    `Output format: ${intent.outputFormat}`,
    `Tone: ${intent.tone}`,
    `Notes: ${intent.notes || "N/A"}`
  ].join("\n");
}

export function recommendSkills(prompt: string): SkillSuggestion[] {
  const lower = prompt.toLowerCase();
  const mapped: SkillSuggestion[] = [];

  if (lower.includes("email")) {
    mapped.push({
      name: "Email Analysis Skill",
      description: "Analyze inbox patterns and summarize key actions.",
      reason: "Prompt contains email-related context."
    });
  }
  if (lower.includes("report")) {
    mapped.push({
      name: "Reporting Skill",
      description: "Produce repeatable structured reports from raw notes.",
      reason: "Prompt asks for reporting or structured output."
    });
  }
  if (lower.includes("research")) {
    mapped.push({
      name: "Research Skill",
      description: "Organize findings, sources, and decision insights.",
      reason: "Prompt involves research or investigation."
    });
  }

  while (mapped.length < 3) {
    mapped.push({
      name: `General Workflow Skill ${mapped.length + 1}`,
      description: "Reusable prompt workflow for planning and execution.",
      reason: "Recommended as a general-purpose capability."
    });
  }

  return mapped.slice(0, 3);
}
