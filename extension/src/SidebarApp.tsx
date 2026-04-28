import { useMemo, useReducer, useState } from "react";
import {
  analyzeIntent,
  clarifyIntent,
  generateSkillFiles,
  getSkillSuggestions,
  restructurePrompt
} from "./api";
import { buildIntent, generatePrompt, isComplexPrompt, recommendSkills } from "./logic";
import type { Answers, CoachState, CoachStep, IntentModel } from "./types";

const INSERT_PROMPT_EVENT = "coach:insert-prompt";
const SOURCE = "claude-capability-coach";

type Action =
  | { type: "SET_STEP"; step: CoachStep }
  | { type: "SET_PROMPT"; prompt: string }
  | { type: "SET_ANSWER"; key: keyof Answers; value: string }
  | { type: "SET_INTENT"; intent: IntentModel }
  | { type: "SET_GENERATED_PROMPT"; generatedPrompt: string }
  | { type: "SET_SKILLS" }
  | { type: "SET_SKILLS_LIST"; skills: CoachState["skills"] }
  | { type: "RESET_FLOW" };

const INITIAL_INTENT = buildIntent("", {});
const INITIAL_STATE: CoachState = {
  currentStep: "home",
  prompt: "",
  answers: {},
  intent: INITIAL_INTENT,
  generatedPrompt: "",
  skills: []
};

function reducer(state: CoachState, action: Action): CoachState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };
    case "SET_PROMPT":
      return { ...state, prompt: action.prompt };
    case "SET_ANSWER":
      return { ...state, answers: { ...state.answers, [action.key]: action.value } };
    case "SET_INTENT":
      return { ...state, intent: action.intent };
    case "SET_GENERATED_PROMPT":
      return { ...state, generatedPrompt: action.generatedPrompt };
    case "SET_SKILLS":
      return { ...state, skills: recommendSkills(state.prompt) };
    case "SET_SKILLS_LIST":
      return { ...state, skills: action.skills };
    case "RESET_FLOW":
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}

function downloadFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SidebarApp() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [navStack, setNavStack] = useState<CoachStep[]>(["home"]);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [skillDecisionComplete, setSkillDecisionComplete] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [skillFiles, setSkillFiles] = useState<{ skillMd: string; instructionsMd: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [intelligenceMode, setIntelligenceMode] = useState<"backend" | "local">("backend");

  const currentStep = navStack[navStack.length - 1];
  const canGoBack = navStack.length > 1;
  const stepTitles: Record<CoachStep, string> = {
    home: "Home",
    "chat-input": "Task Input",
    questions: "Clarifying Questions",
    "intent-editor": "Intent Editor",
    "prompt-output": "Prompt Output",
    "skill-decision": "Skill Decision",
    "skill-generator": "Skill Generator"
  };
  const questions = useMemo(
    () => [
      {
        key: "frequency" as const,
        title: "How often is this task?",
        options: ["one-time", "weekly", "daily"]
      },
      {
        key: "outputFormat" as const,
        title: "What output format do you want?",
        options: ["report", "summary", "table"]
      },
      {
        key: "detailLevel" as const,
        title: "How much detail do you need?",
        options: ["quick", "detailed"]
      }
    ],
    []
  );
  const flowOrder: CoachStep[] = [
    "home",
    "chat-input",
    "questions",
    "intent-editor",
    "prompt-output",
    "skill-decision",
    "skill-generator"
  ];

  const gotoStep = (next: CoachStep) => {
    dispatch({ type: "SET_STEP", step: next });
    setNavStack((stack) => [...stack, next]);
    setStatusMessage("");
  };

  const onBack = () => {
    if (!canGoBack) return;
    setNavStack((stack) => {
      const next = stack.slice(0, -1);
      dispatch({ type: "SET_STEP", step: next[next.length - 1] });
      return next;
    });
  };

  const restartFlow = () => {
    dispatch({ type: "RESET_FLOW" });
    setNavStack(["home"]);
    setDraftPrompt("");
    setQuestionIndex(0);
    setSkillDecisionComplete(false);
    setSkillFiles(null);
    setStatusMessage("");
  };

  const onStart = () => gotoStep("chat-input");

  const onSubmitPrompt = async () => {
    const prompt = draftPrompt.trim();
    if (!prompt) return;

    setIsBusy(true);
    dispatch({ type: "SET_PROMPT", prompt });
    setQuestionIndex(0);
    setSkillDecisionComplete(false);
    setSkillFiles(null);

    let complex = false;
    try {
      const result = await analyzeIntent(prompt);
      complex = result.isComplex;
      setIntelligenceMode("backend");
    } catch {
      complex = isComplexPrompt(prompt);
      setIntelligenceMode("local");
      setStatusMessage("Backend unavailable. Using local fallback intelligence.");
    } finally {
      setIsBusy(false);
    }

    if (complex) {
      gotoStep("questions");
      return;
    }

    const intent = buildIntent(prompt, {});
    dispatch({ type: "SET_INTENT", intent });
    gotoStep("intent-editor");
  };

  const onSelectAnswer = async (value: string) => {
    const question = questions[questionIndex];
    dispatch({ type: "SET_ANSWER", key: question.key, value });

    if (questionIndex < questions.length - 1) {
      setQuestionIndex((idx) => idx + 1);
      return;
    }

    const answers = { ...state.answers, [question.key]: value };
    setIsBusy(true);
    let intent = buildIntent(state.prompt, answers);
    try {
      const result = await clarifyIntent(state.prompt, answers);
      intent = result.intent;
      setIntelligenceMode("backend");
    } catch {
      setIntelligenceMode("local");
      setStatusMessage("Backend unavailable. Using local fallback intelligence.");
    } finally {
      setIsBusy(false);
    }

    dispatch({ type: "SET_INTENT", intent });
    gotoStep("intent-editor");
  };

  const updateIntent = (next: IntentModel) => dispatch({ type: "SET_INTENT", intent: next });

  const onGeneratePrompt = async () => {
    setIsBusy(true);
    let generatedPrompt = generatePrompt(state.intent);
    let skills = recommendSkills(state.prompt);
    try {
      const [promptResult, skillResult] = await Promise.all([
        restructurePrompt(state.intent),
        getSkillSuggestions(state.prompt)
      ]);
      generatedPrompt = promptResult.improvedPrompt;
      skills = skillResult.skills;
      setIntelligenceMode("backend");
    } catch {
      setIntelligenceMode("local");
      setStatusMessage("Backend unavailable. Using local fallback intelligence.");
    } finally {
      setIsBusy(false);
    }

    dispatch({ type: "SET_GENERATED_PROMPT", generatedPrompt });
    dispatch({ type: "SET_SKILLS_LIST", skills });
    gotoStep("prompt-output");
  };

  const copyPrompt = async () => {
    if (!state.generatedPrompt) return;
    await navigator.clipboard.writeText(state.generatedPrompt);
    setStatusMessage("Prompt copied. Paste it into Claude and run.");
  };

  const insertIntoClaude = () => {
    if (!state.generatedPrompt) return;
    window.parent.postMessage(
      {
        source: SOURCE,
        type: INSERT_PROMPT_EVENT,
        payload: { prompt: state.generatedPrompt }
      },
      "*"
    );
    setStatusMessage("Prompt inserted into Claude input box.");
  };

  const onGenerateSkillFiles = async () => {
    setIsBusy(true);
    const skillName = state.skills[0]?.name || "Custom Workflow Skill";
    try {
      const files = await generateSkillFiles(skillName, state.prompt);
      setSkillFiles(files);
      setIntelligenceMode("backend");
      setStatusMessage("Skill files generated.");
    } catch {
      const localSkillMd = `# ${skillName}\n\n## Purpose\n${state.prompt}\n\n## Workflow\n${state.intent.instructions
        .map((line, idx) => `${idx + 1}. ${line}`)
        .join("\n")}`;
      const localInstructions = `# instructions\n\n- Goal: ${state.intent.goal}\n- Output format: ${state.intent.outputFormat}\n- Tone: ${state.intent.tone}\n- Notes: ${state.intent.notes || "N/A"}`;
      setSkillFiles({ skillMd: localSkillMd, instructionsMd: localInstructions });
      setIntelligenceMode("local");
      setStatusMessage("Backend unavailable. Generated local skill files.");
    } finally {
      setIsBusy(false);
    }
  };

  const sessionSummary = useMemo(() => {
    const answers = [
      `- Frequency: ${state.answers.frequency || "N/A"}`,
      `- Output format: ${state.answers.outputFormat || "N/A"}`,
      `- Detail level: ${state.answers.detailLevel || "N/A"}`
    ].join("\n");
    const skillLines = state.skills.length
      ? state.skills.map((skill, index) => `${index + 1}. ${skill.name} - ${skill.reason}`).join("\n")
      : "No skills generated.";

    return `# Claude Capability Coach Session Summary

## Intelligence Mode
${intelligenceMode}

## Original Prompt
${state.prompt || "N/A"}

## Clarifying Answers
${answers}

## Structured Intent
- Goal: ${state.intent.goal}
- Output format: ${state.intent.outputFormat}
- Tone: ${state.intent.tone}
- Notes: ${state.intent.notes || "N/A"}

### Instructions
${state.intent.instructions.map((line, idx) => `${idx + 1}. ${line}`).join("\n")}

## Generated Prompt
${state.generatedPrompt || "N/A"}

## Skill Suggestions
${skillLines}

## Generated Files
- SKILL.md: ${skillFiles ? "Generated" : "Not generated"}
- instructions.md: ${skillFiles ? "Generated" : "Not generated"}
`;
  }, [intelligenceMode, skillFiles, state.answers.detailLevel, state.answers.frequency, state.answers.outputFormat, state.generatedPrompt, state.intent.goal, state.intent.instructions, state.intent.notes, state.intent.outputFormat, state.intent.tone, state.prompt, state.skills]);

  return (
    <div className="app">
      <div className="header">
        <h1>Claude Capability Coach</h1>
        {canGoBack && (
          <button className="secondaryButton" onClick={onBack}>
            Back
          </button>
        )}
      </div>
      <div className="card compact">
        <div className="stepper">
          {flowOrder.map((step) => {
            const visited = navStack.includes(step);
            const active = step === currentStep;
            return (
              <span
                key={step}
                className={`stepTag ${active ? "activeStep" : visited ? "visitedStep" : ""}`}
              >
                {stepTitles[step]}
              </span>
            );
          })}
        </div>
        <p className="subtle">
          Step: <strong>{stepTitles[currentStep]}</strong>
        </p>
        <p className="subtle">Progress: {navStack.length} steps visited in this session.</p>
        <p className="subtle">Intelligence mode: {intelligenceMode}</p>
      </div>
      {statusMessage && (
        <div className="card compact">
          <p>{statusMessage}</p>
        </div>
      )}

      {currentStep === "home" && (
        <div className="card stack">
          <h3>Welcome</h3>
          <p className="subtle">
            Use this coach to turn rough tasks into structured prompts and optional reusable skill files.
          </p>
          <div className="card compact">
            <p><strong>Flow options</strong></p>
            <p className="subtle">Quick prompt: Start -> Input -> Intent -> Prompt Output</p>
            <p className="subtle">Full workflow: Start -> Input -> Questions -> Intent -> Prompt -> Skill files</p>
          </div>
          <button onClick={onStart}>Start</button>
        </div>
      )}

      {currentStep === "chat-input" && (
        <div className="card stack">
          <h3>Describe your task</h3>
          <p className="subtle">
            Example: "Create a weekly sales report summary from meeting notes and emails."
          </p>
          <textarea
            value={draftPrompt}
            onChange={(event) => setDraftPrompt(event.target.value)}
            placeholder="Describe your task..."
          />
          <button onClick={onSubmitPrompt} disabled={draftPrompt.trim().length < 5 || isBusy}>
            {isBusy ? "Processing..." : "Submit"}
          </button>
        </div>
      )}

      {currentStep === "questions" && (
        <div className="card stack">
          <h3>{questions[questionIndex].title}</h3>
          <div className="buttonColumn">
            {questions[questionIndex].options.map((option) => (
              <button key={option} onClick={() => void onSelectAnswer(option)} disabled={isBusy}>
                {option}
              </button>
            ))}
          </div>
          <p className="subtle">
            Question {questionIndex + 1} of {questions.length}
          </p>
        </div>
      )}

      {currentStep === "intent-editor" && (
        <div className="card stack">
          <h3>Intent Editor</h3>
          <label>
            Goal
            <textarea
              value={state.intent.goal}
              onChange={(event) => updateIntent({ ...state.intent, goal: event.target.value })}
            />
          </label>
          <label>
            Instructions (one per line)
            <textarea
              value={state.intent.instructions.join("\n")}
              onChange={(event) =>
                updateIntent({
                  ...state.intent,
                  instructions: event.target.value.split("\n").filter(Boolean)
                })
              }
            />
          </label>
          <label>
            Output format
            <select
              value={state.intent.outputFormat}
              onChange={(event) =>
                updateIntent({ ...state.intent, outputFormat: event.target.value as IntentModel["outputFormat"] })
              }
            >
              <option value="report">report</option>
              <option value="summary">summary</option>
              <option value="table">table</option>
            </select>
          </label>
          <label>
            Tone
            <select
              value={state.intent.tone}
              onChange={(event) =>
                updateIntent({ ...state.intent, tone: event.target.value as IntentModel["tone"] })
              }
            >
              <option value="professional">professional</option>
              <option value="friendly">friendly</option>
              <option value="neutral">neutral</option>
            </select>
          </label>
          <label>
            Notes
            <textarea
              value={state.intent.notes}
              onChange={(event) => updateIntent({ ...state.intent, notes: event.target.value })}
            />
          </label>
          <button onClick={() => void onGeneratePrompt()} disabled={isBusy}>
            {isBusy ? "Generating..." : "Next"}
          </button>
        </div>
      )}

      {currentStep === "prompt-output" && (
        <div className="card stack">
          <h3>Generated Prompt</h3>
          <pre>{state.generatedPrompt}</pre>
          <div className="card compact">
            <p><strong>How to use this prompt</strong></p>
            <p className="subtle">1. Copy or insert into Claude input.</p>
            <p className="subtle">2. Review before sending.</p>
            <p className="subtle">3. Save good prompts for reuse in recurring tasks.</p>
          </div>
          <div className="buttonRow">
            <button onClick={copyPrompt}>Copy</button>
            <button onClick={insertIntoClaude}>Insert into Claude</button>
            <button onClick={() => downloadFile("session-summary.md", sessionSummary)}>
              Export Session Summary
            </button>
          </div>
          <button onClick={() => gotoStep("skill-decision")}>Looks good -> Continue</button>
        </div>
      )}

      {currentStep === "skill-decision" && (
        <div className="card stack">
          <h3>Reusable Skill</h3>
          <p>Do you want to create a reusable skill for this task?</p>
          {state.skills.length > 0 && (
            <div className="card compact">
              <p><strong>Suggested skills</strong></p>
              {state.skills.map((skill) => (
                <p key={skill.name} className="subtle">
                  - {skill.name}: {skill.reason}
                </p>
              ))}
            </div>
          )}
          <div className="buttonRow">
            <button onClick={() => gotoStep("skill-generator")}>Yes</button>
            <button onClick={() => setSkillDecisionComplete(true)}>No</button>
          </div>
          {skillDecisionComplete && (
            <div className="card compact">
              <p>Flow complete. You can now use your improved prompt in Claude.</p>
              <button onClick={restartFlow}>Start New Flow</button>
            </div>
          )}
        </div>
      )}

      {currentStep === "skill-generator" && (
        <div className="card stack">
          <h3>Skill Generator</h3>
          <p className="subtle">
            Download both files and keep them in your project docs so you can reuse the same workflow quickly.
          </p>
          {!skillFiles && (
            <button onClick={() => void onGenerateSkillFiles()} disabled={isBusy}>
              {isBusy ? "Generating files..." : "Generate Skill Files"}
            </button>
          )}
          {skillFiles && (
            <>
              <h4>SKILL.md</h4>
              <pre>{skillFiles.skillMd}</pre>
              <h4>instructions.md</h4>
              <pre>{skillFiles.instructionsMd}</pre>
            </>
          )}
          <div className="card compact">
            <p><strong>How to use generated files</strong></p>
            <p className="subtle">- `SKILL.md`: defines purpose and reusable workflow pattern.</p>
            <p className="subtle">- `instructions.md`: operational checklist for applying the skill repeatedly.</p>
          </div>
          <div className="buttonRow">
            <button
              onClick={() => skillFiles && downloadFile("SKILL.md", skillFiles.skillMd)}
              disabled={!skillFiles}
            >
              Download SKILL.md
            </button>
            <button
              onClick={() => skillFiles && downloadFile("instructions.md", skillFiles.instructionsMd)}
              disabled={!skillFiles}
            >
              Download instructions.md
            </button>
            <button onClick={() => downloadFile("session-summary.md", sessionSummary)}>
              Export Session Summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
