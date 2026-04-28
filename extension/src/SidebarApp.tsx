import { useMemo, useReducer, useState } from "react";
import JSZip from "jszip";
import {
  analyzeIntent,
  clarifyIntent,
  generateSkillFiles,
  getSkillSuggestions,
  restructurePrompt,
  type AnalyzeIntentResponse
} from "./api";
import { buildIntent, generatePrompt } from "./logic";
import type { Answers, CoachState, CoachStep, IntentModel, SkillSuggestion } from "./types";

type Action =
  | { type: "SET_STEP"; step: CoachStep }
  | { type: "SET_PROMPT"; prompt: string }
  | { type: "SET_ANSWER"; key: keyof Answers; value: string }
  | { type: "SET_INTENT"; intent: IntentModel }
  | { type: "SET_GENERATED_PROMPT"; generatedPrompt: string }
  | { type: "SET_SKILLS"; skills: SkillSuggestion[] }
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
  const [statusMessage, setStatusMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeIntentResponse | null>(null);
  const [skillPackage, setSkillPackage] = useState<{
    skillFolderName: string;
    files: Array<{ name: string; content: string }>;
  } | null>(null);

  const currentStep = navStack[navStack.length - 1];
  const canGoBack = navStack.length > 1;
  const stepTitles: Record<CoachStep, string> = {
    home: "Home",
    "chat-input": "Task Input",
    "simple-result": "Simple Task Check",
    questions: "Clarifying Questions",
    "intent-editor": "Intent Editor",
    "prompt-output": "Prompt Output",
    "skill-decision": "Skill Decision",
    "skill-generator": "Skill Generator"
  };
  const flowOrder: CoachStep[] = [
    "home",
    "chat-input",
    "simple-result",
    "questions",
    "intent-editor",
    "prompt-output",
    "skill-decision",
    "skill-generator"
  ];

  const questionFlow = useMemo(
    () => [
      {
        key: "frequency" as const,
        title: analysis?.clarifyingQuestions[0] || "How often is this task expected to run?",
        options: ["one-time", "weekly", "daily"]
      },
      {
        key: "outputFormat" as const,
        title: analysis?.clarifyingQuestions[1] || "What output format do you prefer?",
        options: ["report", "summary", "table"]
      },
      {
        key: "detailLevel" as const,
        title: analysis?.clarifyingQuestions[2] || "How deep should the output go?",
        options: ["quick", "detailed"]
      }
    ],
    [analysis?.clarifyingQuestions]
  );

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
    setStatusMessage("");
    setAnalysis(null);
    setSkillPackage(null);
  };

  const onSubmitPrompt = async () => {
    const prompt = draftPrompt.trim();
    if (!prompt) return;
    setIsBusy(true);
    try {
      dispatch({ type: "SET_PROMPT", prompt });
      const result = await analyzeIntent(prompt);
      setAnalysis(result);
      setQuestionIndex(0);
      if (result.classification === "simple") {
        gotoStep("simple-result");
      } else {
        gotoStep("questions");
      }
    } catch {
      setStatusMessage("Intelligence layer unavailable. Please check backend and retry.");
    } finally {
      setIsBusy(false);
    }
  };

  const onSelectAnswer = async (value: string) => {
    const question = questionFlow[questionIndex];
    dispatch({ type: "SET_ANSWER", key: question.key, value });
    if (questionIndex < questionFlow.length - 1) {
      setQuestionIndex((idx) => idx + 1);
      return;
    }

    const answers = { ...state.answers, [question.key]: value };
    setIsBusy(true);
    try {
      const result = await clarifyIntent(state.prompt, answers);
      dispatch({ type: "SET_INTENT", intent: result.intent });
      gotoStep("intent-editor");
    } catch {
      setStatusMessage("Failed to build intent. Please retry.");
    } finally {
      setIsBusy(false);
    }
  };

  const onGeneratePrompt = async () => {
    setIsBusy(true);
    try {
      const [promptResult, skillResult] = await Promise.all([
        restructurePrompt(state.intent),
        getSkillSuggestions(state.prompt)
      ]);
      dispatch({ type: "SET_GENERATED_PROMPT", generatedPrompt: promptResult.improvedPrompt });
      dispatch({ type: "SET_SKILLS", skills: skillResult.skills });
      gotoStep("prompt-output");
    } catch {
      dispatch({ type: "SET_GENERATED_PROMPT", generatedPrompt: generatePrompt(state.intent) });
      setStatusMessage("Prompt generated with fallback. Verify backend intelligence for best quality.");
      gotoStep("prompt-output");
    } finally {
      setIsBusy(false);
    }
  };

  const onGenerateSkillPackage = async () => {
    setIsBusy(true);
    try {
      const response = await generateSkillFiles(state.skills[0]?.name || "Custom Skill", state.prompt);
      setSkillPackage(response);
      setStatusMessage("Professional skill package generated.");
    } catch {
      setStatusMessage("Skill generation failed. Check backend and try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const downloadSkillZip = async () => {
    if (!skillPackage) return;
    const zip = new JSZip();
    const folder = zip.folder(skillPackage.skillFolderName);
    if (!folder) return;
    skillPackage.files.forEach((file) => folder.file(file.name, file.content));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${skillPackage.skillFolderName}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const sessionSummary = useMemo(() => {
    return `# Session Summary

## Prompt
${state.prompt || "N/A"}

## Classification
${analysis?.classification || "N/A"} - ${analysis?.reason || "N/A"}

## Answers
- Frequency: ${state.answers.frequency || "N/A"}
- Output format: ${state.answers.outputFormat || "N/A"}
- Detail level: ${state.answers.detailLevel || "N/A"}

## Final Prompt
${state.generatedPrompt || "N/A"}
`;
  }, [analysis?.classification, analysis?.reason, state.answers.detailLevel, state.answers.frequency, state.answers.outputFormat, state.generatedPrompt, state.prompt]);

  return (
    <div className="app">
      <div className="header">
        <h1>Claude Capability Coach</h1>
        <div className="buttonRow">
          {canGoBack && (
            <button className="secondaryButton" onClick={onBack}>
              Back
            </button>
          )}
          <button className="secondaryButton" onClick={restartFlow}>
            New Session
          </button>
        </div>
      </div>

      <div className="card compact">
        <div className="stepper">
          {flowOrder.map((step) => {
            const visited = navStack.includes(step);
            const active = step === currentStep;
            return (
              <span key={step} className={`stepTag ${active ? "activeStep" : visited ? "visitedStep" : ""}`}>
                {stepTitles[step]}
              </span>
            );
          })}
        </div>
      </div>

      {statusMessage && (
        <div className="card compact">
          <p>{statusMessage}</p>
        </div>
      )}

      {currentStep === "home" && (
        <div className="card stack">
          <h3>Welcome</h3>
          <p className="subtle">Start a new coaching session for task-specific prompt intelligence.</p>
          <button onClick={() => gotoStep("chat-input")}>Start</button>
        </div>
      )}

      {currentStep === "chat-input" && (
        <div className="card stack">
          <h3>Describe your task</h3>
          <textarea
            value={draftPrompt}
            onChange={(event) => setDraftPrompt(event.target.value)}
            placeholder="Describe your task..."
          />
          <button onClick={() => void onSubmitPrompt()} disabled={draftPrompt.trim().length < 5 || isBusy}>
            {isBusy ? "Analyzing..." : "Submit"}
          </button>
        </div>
      )}

      {currentStep === "simple-result" && (
        <div className="card stack">
          <h3>Simple Task Detected</h3>
          <p>{analysis?.reason}</p>
          <div className="buttonRow">
            <button onClick={() => gotoStep("prompt-output")}>Generate Quick Prompt Anyway</button>
            <button className="secondaryButton" onClick={restartFlow}>
              End Session
            </button>
          </div>
        </div>
      )}

      {currentStep === "questions" && (
        <div className="card stack">
          <h3>{questionFlow[questionIndex].title}</h3>
          <div className="buttonColumn">
            {questionFlow[questionIndex].options.map((option) => (
              <button key={option} onClick={() => void onSelectAnswer(option)} disabled={isBusy}>
                {option}
              </button>
            ))}
          </div>
          <p className="subtle">
            Question {questionIndex + 1} of {questionFlow.length}
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
              onChange={(event) => dispatch({ type: "SET_INTENT", intent: { ...state.intent, goal: event.target.value } })}
            />
          </label>
          <label>
            Instructions (one per line)
            <textarea
              value={state.intent.instructions.join("\n")}
              onChange={(event) =>
                dispatch({
                  type: "SET_INTENT",
                  intent: { ...state.intent, instructions: event.target.value.split("\n").filter(Boolean) }
                })
              }
            />
          </label>
          <label>
            Output format
            <select
              value={state.intent.outputFormat}
              onChange={(event) =>
                dispatch({
                  type: "SET_INTENT",
                  intent: { ...state.intent, outputFormat: event.target.value as IntentModel["outputFormat"] }
                })
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
                dispatch({
                  type: "SET_INTENT",
                  intent: { ...state.intent, tone: event.target.value as IntentModel["tone"] }
                })
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
              onChange={(event) => dispatch({ type: "SET_INTENT", intent: { ...state.intent, notes: event.target.value } })}
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
          <pre>{state.generatedPrompt || generatePrompt(state.intent)}</pre>
          <div className="buttonRow">
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(state.generatedPrompt || generatePrompt(state.intent));
                setStatusMessage("Copied. Paste into Claude and execute.");
              }}
            >
              Copy to paste into Claude
            </button>
            <button onClick={() => gotoStep("skill-decision")}>Continue for skill recommendation</button>
            <button onClick={() => downloadFile("session-summary.md", sessionSummary)}>Export Session Summary</button>
          </div>
        </div>
      )}

      {currentStep === "skill-decision" && (
        <div className="card stack">
          <h3>Skill Recommendation</h3>
          <p>Do you want to create a reusable skill package for this task?</p>
          {state.skills.map((skill) => (
            <div key={skill.name} className="skillCard">
              <h4>{skill.name}</h4>
              <p>{skill.description}</p>
              <small>{skill.reason}</small>
            </div>
          ))}
          <div className="buttonRow">
            <button onClick={() => gotoStep("skill-generator")}>Yes</button>
            <button className="secondaryButton" onClick={restartFlow}>
              No, end session
            </button>
          </div>
        </div>
      )}

      {currentStep === "skill-generator" && (
        <div className="card stack">
          <h3>Skill Package Generator</h3>
          <p className="subtle">
            Generated package follows Claude custom skill guidance with YAML metadata and upload instructions.
          </p>
          {!skillPackage && (
            <button onClick={() => void onGenerateSkillPackage()} disabled={isBusy}>
              {isBusy ? "Generating package..." : "Generate Skill Package"}
            </button>
          )}
          {skillPackage && (
            <>
              {skillPackage.files.map((file) => (
                <div key={file.name} className="stack">
                  <h4>{file.name}</h4>
                  <pre>{file.content}</pre>
                </div>
              ))}
              <div className="buttonRow">
                <button onClick={() => void downloadSkillZip()}>Download Skill Folder ZIP</button>
                <button onClick={() => downloadFile("session-summary.md", sessionSummary)}>
                  Export Session Summary
                </button>
              </div>
              <div className="card compact">
                <p><strong>How to upload</strong></p>
                <p className="subtle">- Claude: Customize -> Skills -> Upload ZIP -> Enable skill.</p>
                <p className="subtle">- Project option: create a project and add knowledge/instruction files.</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
