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

const COMPLEX_KEYWORDS = [
  "analyse",
  "analyze",
  "generate",
  "create",
  "report",
  "weekly",
  "ppt",
  "presentation",
  "deck",
  "slides"
];
const SIMPLE_KEYWORDS = ["what", "when", "where", "who", "define", "meaning", "explain"];

export interface AnalyzeResult {
  isComplex: boolean;
  classification: "simple" | "complex";
  reason: string;
  clarifyingQuestions: string[];
}

export function isComplexPrompt(prompt: string): boolean {
  const clean = prompt.trim().toLowerCase();
  if (!clean) return false;
  const words = clean.split(/\s+/).filter(Boolean).length;
  return words > 15 || COMPLEX_KEYWORDS.some((keyword) => clean.includes(keyword));
}

export function analyzePrompt(prompt: string): AnalyzeResult {
  const clean = prompt.trim().toLowerCase();
  const words = clean.split(/\s+/).filter(Boolean).length;
  const hasSimpleSignal = SIMPLE_KEYWORDS.some((keyword) => clean.startsWith(keyword) || clean.includes(`${keyword} `));
  const complex = isComplexPrompt(prompt);

  if (!complex && (words <= 14 || hasSimpleSignal)) {
    return {
      isComplex: false,
      classification: "simple",
      reason:
        "This appears to be a straightforward question or short task. It likely does not require a full Claude capability workflow.",
      clarifyingQuestions: []
    };
  }

  return {
    isComplex: true,
    classification: "complex",
    reason:
      "This task appears multi-step or output-sensitive. A structured clarification + prompt design workflow will improve reliability.",
    clarifyingQuestions: [
      "What exact business or user outcome should this response achieve?",
      "What constraints must Claude strictly follow (scope, exclusions, factual boundaries, references)?",
      "What output structure and quality standard should define a successful answer?"
    ]
  };
}

export function buildIntent(prompt: string, answers: IntentAnswers): IntentModel {
  const outputFormat = answers.outputFormat ?? "summary";
  const frequency = answers.frequency ?? "one-time";
  const detailLevel = answers.detailLevel ?? "quick";

  return {
    goal: prompt.trim() || "Help improve this task prompt.",
    instructions: [
      "Confirm the exact objective before drafting any solution.",
      "Use only information stated by the user or clearly marked assumptions.",
      "Surface uncertainty explicitly instead of inventing unsupported facts.",
      `Provide a ${detailLevel} level of detail with practical next actions.`,
      `Format the final response as a ${outputFormat} with clear section headings.`
    ],
    outputFormat,
    tone: "professional",
    notes: frequency === "one-time" ? "" : `This task repeats on a ${frequency} basis.`,
    frequency
  };
}

export function generatePrompt(intent: IntentModel): string {
  return [
    "You are a senior domain expert and structured problem-solving assistant.",
    "Operate with high factual discipline and explicit reasoning boundaries.",
    "",
    "Primary Objective",
    `- ${intent.goal}`,
    "",
    "Execution Requirements",
    "Instructions:",
    ...intent.instructions.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Quality Guardrails",
    "- Do not fabricate facts, sources, metrics, or implementation details.",
    "- If data is missing, state what is missing and request specific inputs.",
    "- Keep the response aligned to the stated goal and exclude irrelevant tangents.",
    "",
    "Output Contract",
    `- Output format: ${intent.outputFormat}`,
    `- Tone: ${intent.tone}`,
    `- Notes: ${intent.notes || "N/A"}`,
    "",
    "Final Check",
    "- Ensure response is factual, directly usable, and free of unsupported assumptions."
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
  const folderName = skill.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const description =
    "Guide Claude through structured intent clarification and high-quality prompt design for repeatable tasks.";

  const skillMd = `---
name: ${skill}
description: ${description}
---

# Overview
Use this Skill when a user needs a reliable, context-rich prompt that avoids assumptions and improves execution quality.

# When to use
- Multi-step tasks
- Recurring workflows
- Outputs requiring strict structure and quality controls

# Workflow
1. Clarify intent and expected outcomes
2. Capture constraints, assumptions, and exclusions
3. Define output format, tone, and depth
4. Build structured prompt with quality guardrails
5. Validate prompt for factual discipline and scope alignment

# Example seed task
${prompt || "User-defined task"}
`;

  const instructionsMd = `# Instructions

## Operator checklist
1. Confirm user goal and success criteria.
2. Ask clarifying questions for missing constraints.
3. Produce structured prompt sections:
   - objective
   - execution steps
   - output contract
   - quality guardrails
4. Validate the prompt for relevance and factual safety.
`;

  const referenceMd = `# Reference

## Prompt quality rules
- No hallucinated facts
- No hidden assumptions
- Explicitly call out unknowns
- Keep outputs decision-ready and action-oriented
`;

  const projectRecommendationMd = `# Project Recommendation (Optional)

If this workflow is used repeatedly across a team, consider creating a project package:
- Knowledge files for domain context
- Standard instruction templates
- Example prompts and gold-standard outputs

This is recommended when consistency and onboarding speed are important.
`;

  const uploadGuideMd = `# Upload Guide

## Upload as Skill in Claude
1. Open Claude settings.
2. Go to Customize -> Skills.
3. Upload the generated skill folder zip.
4. Enable the skill and test with trigger prompts.

## Upload as Project package (optional)
1. Create a new project in Claude.
2. Add the recommendation/reference files as project knowledge.
3. Add operational instructions in project settings.
`;

  return {
    skillFolderName: folderName,
    files: [
      { name: "SKILL.md", content: skillMd },
      { name: "instructions.md", content: instructionsMd },
      { name: "REFERENCE.md", content: referenceMd },
      { name: "PROJECT_RECOMMENDATION.md", content: projectRecommendationMd },
      { name: "UPLOAD_GUIDE.md", content: uploadGuideMd }
    ]
  };
}
