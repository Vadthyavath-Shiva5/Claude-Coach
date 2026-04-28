import type { IntentAnswers, IntentModel } from "./coach-logic.js";

interface ClaudeMessageResponse {
  content?: Array<{ type: string; text?: string }>;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate.trim());
}

async function callClaude(system: string, user: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  const maxTokens = Number(process.env.ANTHROPIC_MAX_TOKENS || 1200);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: user }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API failed (${response.status}): ${err}`);
  }

  const data = (await response.json()) as ClaudeMessageResponse;
  const text = data.content?.find((item) => item.type === "text")?.text;
  if (!text) {
    throw new Error("Claude returned no text content.");
  }
  return text;
}

export async function classifyPromptWithClaude(prompt: string): Promise<{
  isComplex: boolean;
  classification: "simple" | "complex";
  reason: string;
  clarifyingQuestions: string[];
}> {
  const output = await callClaude(
    "You are a senior prompt architect. Return strict JSON only.",
    `Classify this user task as simple or complex for Claude-capability coaching.

Task:
${prompt}

Rules:
- Complex examples: building plans, PPT/deck creation, reports, coding tasks, workflows, recurring tasks, multi-step tasks.
- Simple examples: direct fact questions, brief definitions, single-line asks.
- If task asks to create or prepare PPT/presentation/deck, classify as complex.

Return JSON:
{
  "isComplex": boolean,
  "classification": "simple" | "complex",
  "reason": "short reason",
  "clarifyingQuestions": ["q1","q2","q3"]
}`
  );
  return extractJson(output) as {
    isComplex: boolean;
    classification: "simple" | "complex";
    reason: string;
    clarifyingQuestions: string[];
  };
}

export async function buildIntentWithClaude(prompt: string, answers: IntentAnswers): Promise<IntentModel> {
  const output = await callClaude(
    "You are a senior product strategist and prompt engineer. Return strict JSON only.",
    `Build a structured intent object for this task.

Prompt:
${prompt}

Answers:
${JSON.stringify(answers)}

Return JSON:
{
  "goal": "string",
  "instructions": ["string"],
  "outputFormat": "report|summary|table",
  "tone": "professional|friendly|neutral",
  "notes": "string",
  "frequency": "one-time|weekly|daily"
}`
  );
  return extractJson(output) as IntentModel;
}

export async function restructurePromptWithClaude(intent: IntentModel): Promise<string> {
  const output = await callClaude(
    "You are a principal-level prompt engineer. Return only the final prompt text.",
    `Create a high-quality production prompt from this intent.

Intent JSON:
${JSON.stringify(intent, null, 2)}

Requirements:
- Rich context and explicit constraints
- No unsupported assumptions
- Clear output contract
- Factual discipline and relevance
- Decision-ready formatting`
  );
  return output.trim();
}

export async function recommendSkillsWithClaude(prompt: string): Promise<
  Array<{ name: string; description: string; reason: string }>
> {
  const output = await callClaude(
    "You are a senior AI workflow consultant. Return strict JSON only.",
    `Recommend top 3 reusable skills for this task:

${prompt}

Return JSON array:
[
  { "name": "string", "description": "string", "reason": "string" }
]`
  );
  return extractJson(output) as Array<{ name: string; description: string; reason: string }>;
}

export async function generateSkillPackageWithClaude(skillName: string, prompt: string): Promise<{
  skillFolderName: string;
  files: Array<{ name: string; content: string }>;
}> {
  const output = await callClaude(
    "You are an expert in Claude skill authoring. Return strict JSON only.",
    `Create a professional Claude skill package aligned with official skill structure.

Skill name: ${skillName || "Custom Workflow Skill"}
Prompt context: ${prompt}

Requirements:
- SKILL.md must include YAML frontmatter with name and description.
- Include actionable instructions and upload guide.
- Include optional project recommendation docs.

Return JSON:
{
  "skillFolderName": "kebab-case-folder",
  "files": [
    { "name": "SKILL.md", "content": "..." },
    { "name": "instructions.md", "content": "..." },
    { "name": "REFERENCE.md", "content": "..." },
    { "name": "PROJECT_RECOMMENDATION.md", "content": "..." },
    { "name": "UPLOAD_GUIDE.md", "content": "..." }
  ]
}`
  );
  return extractJson(output) as { skillFolderName: string; files: Array<{ name: string; content: string }> };
}
