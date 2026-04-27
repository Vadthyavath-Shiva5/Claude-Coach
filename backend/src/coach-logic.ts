export type FrequencyOption = "one-time" | "weekly" | "daily";
export type OutputFormatOption = "report" | "summary" | "table";
export type DetailLevelOption = "quick" | "detailed";

export interface IntentAnswers {
  frequency?: FrequencyOption;
  outputFormat?: OutputFormatOption;
  detailLevel?: DetailLevelOption;
}

export interface IntentModel {
  goal: string;
  instructions: string[];
  outputFormat: OutputFormatOption;
  tone: "professional" | "friendly" | "neutral";
  notes: string;
  frequency: FrequencyOption;
}

const COMPLEX_KEYWORDS = ["analyse", "analyze", "generate", "create", "report", "weekly"];

export function isComplexPrompt(prompt: string): boolean {
  const clean = prompt.trim().toLowerCase();
  if (!clean) return false;
  const words = clean.split(/\s+/).filter(Boolean).length;
  return words > 15 || COMPLEX_KEYWORDS.some((keyword) => clean.includes(keyword));
}

export function buildIntent(prompt: string, answers: IntentAnswers): IntentModel {
  const outputFormat = answers.outputFormat ?? "summary";
  const frequency = answers.frequency ?? "one-time";
  const detailLevel = answers.detailLevel ?? "quick";

  return {
    goal: prompt.trim() || "Help improve this task prompt.",
    instructions: [
      "Understand the exact task objective.",
      "Identify missing context and assumptions.",
      `Respond with a ${detailLevel} level of detail.`,
      `Format output as a ${outputFormat}.`
    ],
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

export function recommendSkills(prompt: string) {
  const lower = prompt.toLowerCase();
  const skills: Array<{ name: string; description: string; reason: string }> = [];

  if (lower.includes("email")) {
    skills.push({
      name: "Email Analysis Skill",
      description: "Analyze email threads and summarize required actions.",
      reason: "Prompt includes email-related keywords."
    });
  }
  if (lower.includes("report")) {
    skills.push({
      name: "Reporting Skill",
      description: "Generate structured recurring reports from raw updates.",
      reason: "Prompt requests report-style outputs."
    });
  }
  if (lower.includes("research")) {
    skills.push({
      name: "Research Skill",
      description: "Structure findings and produce decision-ready summaries.",
      reason: "Prompt indicates research workflow."
    });
  }

  while (skills.length < 3) {
    skills.push({
      name: `General Workflow Skill ${skills.length + 1}`,
      description: "Reusable process to clarify, execute, and refine tasks.",
      reason: "Added as general-purpose recommendation."
    });
  }

  return skills.slice(0, 3);
}

export function generateSkillFiles(skillName: string, prompt: string) {
  const skill = skillName || "Custom Workflow Skill";
  return {
    skillMd: `# ${skill}\n\n## Purpose\nImprove prompt quality for tasks like:\n- ${prompt || "User-defined task"}\n\n## Workflow\n1. Clarify goal\n2. Add constraints\n3. Define output format\n`,
    instructionsMd:
      "# instructions\n\nUse this skill to guide users through intent clarification and structured prompt writing.\n"
  };
}
