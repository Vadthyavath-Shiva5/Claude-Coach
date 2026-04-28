export type CoachStep =
  | "home"
  | "chat-input"
  | "questions"
  | "intent-editor"
  | "prompt-output"
  | "skill-decision"
  | "skill-generator";

export type FrequencyOption = "one-time" | "weekly" | "daily";
export type OutputFormatOption = "report" | "summary" | "table";
export type DetailLevelOption = "quick" | "detailed";

export interface Answers {
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

export interface SkillSuggestion {
  name: string;
  description: string;
  reason: string;
}

export interface CoachState {
  currentStep: CoachStep;
  prompt: string;
  answers: Answers;
  intent: IntentModel;
  generatedPrompt: string;
  skills: SkillSuggestion[];
}
