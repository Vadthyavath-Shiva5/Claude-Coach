import { useEffect, useMemo, useState } from "react";
import { buildIntent, generatePrompt, isComplexPrompt, recommendSkills } from "./logic";
import { analyzeIntent, clarifyIntent, getSkillSuggestions, restructurePrompt } from "./api";
import type {
  Answers,
  CoachStage,
  DetailLevelOption,
  FrequencyOption,
  IntentModel,
  OutputFormatOption,
  SkillSuggestion
} from "./types";

const PROMPT_EVENT = "coach:prompt";
const FALLBACK_EVENT = "coach:manual-input-required";
const ACTIVATE_EVENT = "coach:activate";
const INSERT_PROMPT_EVENT = "coach:insert-prompt";
const SOURCE = "claude-capability-coach";

function Header() {
  return (
    <div className="card">
      <h1>Claude Capability Coach</h1>
      <p>Thinking layer UI to clarify intent and improve prompts.</p>
    </div>
  );
}

function PromptListener({ prompt }: { prompt: string }) {
  return (
    <div className="card compact">
      <strong>Prompt Listener</strong>
      <p>{prompt ? "Listening to Claude input..." : "Waiting for input..."}</p>
    </div>
  );
}

function DetectionView({ isComplex }: { isComplex: boolean }) {
  if (!isComplex) {
    return <p className="subtle">Waiting for input...</p>;
  }
  return <p>This looks like a structured task...</p>;
}

function QuestionsView({
  answers,
  onSelect
}: {
  answers: Answers;
  onSelect: (key: keyof Answers, value: string) => void;
}) {
  return (
    <div className="stack">
      <h3>Clarification Questions</h3>

      <div className="question">
        <p>1) Frequency</p>
        <div className="buttonRow">
          {(["one-time", "weekly", "daily"] as FrequencyOption[]).map((value) => (
            <button
              key={value}
              className={answers.frequency === value ? "active" : ""}
              onClick={() => onSelect("frequency", value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {answers.frequency && (
        <div className="question">
          <p>2) Output format</p>
          <div className="buttonRow">
            {(["report", "summary", "table"] as OutputFormatOption[]).map((value) => (
              <button
                key={value}
                className={answers.outputFormat === value ? "active" : ""}
                onClick={() => onSelect("outputFormat", value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      )}

      {answers.outputFormat && (
        <div className="question">
          <p>3) Detail level</p>
          <div className="buttonRow">
            {(["quick", "detailed"] as DetailLevelOption[]).map((value) => (
              <button
                key={value}
                className={answers.detailLevel === value ? "active" : ""}
                onClick={() => onSelect("detailLevel", value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IntentEditor({
  intent,
  setIntent
}: {
  intent: IntentModel;
  setIntent: (next: IntentModel) => void;
}) {
  return (
    <div className="stack">
      <h3>Intent Editor</h3>
      <label>
        Goal
        <textarea
          value={intent.goal}
          onChange={(e) => setIntent({ ...intent, goal: e.target.value })}
        />
      </label>

      <label>
        Instructions (one per line)
        <textarea
          value={intent.instructions.join("\n")}
          onChange={(e) =>
            setIntent({
              ...intent,
              instructions: e.target.value.split("\n").filter(Boolean)
            })
          }
        />
      </label>

      <label>
        Output format
        <select
          value={intent.outputFormat}
          onChange={(e) =>
            setIntent({
              ...intent,
              outputFormat: e.target.value as OutputFormatOption
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
          value={intent.tone}
          onChange={(e) =>
            setIntent({
              ...intent,
              tone: e.target.value as IntentModel["tone"]
            })
          }
        >
          <option value="professional">professional</option>
          <option value="friendly">friendly</option>
          <option value="neutral">neutral</option>
        </select>
      </label>

      <label>
        Notes (optional)
        <textarea
          value={intent.notes}
          onChange={(e) => setIntent({ ...intent, notes: e.target.value })}
        />
      </label>
    </div>
  );
}

function PromptOutput({ improvedPrompt }: { improvedPrompt: string }) {
  return (
    <div className="stack">
      <h3>Improved Prompt</h3>
      <pre>{improvedPrompt}</pre>
    </div>
  );
}

function SkillSuggestions({ skills }: { skills: SkillSuggestion[] }) {
  return (
    <div className="stack">
      <h3>Skill Suggestions</h3>
      {skills.map((skill) => (
        <div key={skill.name} className="skillCard">
          <h4>{skill.name}</h4>
          <p>{skill.description}</p>
          <small>{skill.reason}</small>
        </div>
      ))}
      <button>Create your own skill</button>
    </div>
  );
}

function ActionButtons({ improvedPrompt }: { improvedPrompt: string }) {
  const copyPrompt = async () => {
    if (!improvedPrompt) {
      return;
    }
    await navigator.clipboard.writeText(improvedPrompt);
  };

  const insertIntoClaude = () => {
    if (!improvedPrompt) {
      return;
    }
    window.parent.postMessage(
      {
        source: SOURCE,
        type: INSERT_PROMPT_EVENT,
        payload: { prompt: improvedPrompt }
      },
      "*"
    );
  };

  return (
    <div className="card">
      <h3>Actions</h3>
      <div className="buttonRow">
        <button onClick={copyPrompt}>Copy Prompt</button>
        <button onClick={insertIntoClaude}>Insert into Claude chat bar</button>
      </div>
    </div>
  );
}

export default function SidebarApp() {
  const [isStarted, setIsStarted] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [apiError, setApiError] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [intent, setIntent] = useState<IntentModel>(() => buildIntent("", {}));
  const [postQuestionStage, setPostQuestionStage] = useState<
    "intent-editor" | "prompt-output" | "skill-suggestions" | "action"
  >("intent-editor");

  const [isComplex, setIsComplex] = useState(false);
  const questionsComplete = Boolean(
    answers.frequency && answers.outputFormat && answers.detailLevel
  );
  const [improvedPrompt, setImprovedPrompt] = useState("");
  const [skills, setSkills] = useState<SkillSuggestion[]>([]);

  const stage: CoachStage = useMemo(() => {
    if (!prompt.trim()) {
      return "idle";
    }
    if (!isComplex) {
      return "detection";
    }
    if (!questionsComplete) {
      return "questions";
    }
    return postQuestionStage;
  }, [isComplex, postQuestionStage, prompt, questionsComplete]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== SOURCE) {
        return;
      }

      if (data.type === PROMPT_EVENT && isStarted) {
        setPrompt(String(data.payload?.prompt ?? ""));
      }

      if (data.type === FALLBACK_EVENT) {
        setManualMode(true);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isStarted]);

  useEffect(() => {
    if (!prompt.trim()) {
      setIsComplex(false);
      return;
    }
    analyzeIntent(prompt)
      .then((result) => {
        setIsComplex(result.isComplex);
        setApiError("");
      })
      .catch(() => {
        setIsComplex(isComplexPrompt(prompt));
        setApiError("API unavailable, running local mode.");
      });
  }, [prompt]);

  useEffect(() => {
    clarifyIntent(prompt, answers)
      .then((result) => {
        setIntent(result.intent);
        setApiError("");
      })
      .catch(() => {
        setIntent(buildIntent(prompt, answers));
        setApiError("API unavailable, running local mode.");
      });
  }, [prompt, answers]);

  useEffect(() => {
    restructurePrompt(intent)
      .then((result) => {
        setImprovedPrompt(result.improvedPrompt);
        setApiError("");
      })
      .catch(() => {
        setImprovedPrompt(generatePrompt(intent));
        setApiError("API unavailable, running local mode.");
      });
  }, [intent]);

  useEffect(() => {
    getSkillSuggestions(prompt || improvedPrompt)
      .then((result) => {
        setSkills(result.skills);
        setApiError("");
      })
      .catch(() => {
        setSkills(recommendSkills(prompt || improvedPrompt));
        setApiError("API unavailable, running local mode.");
      });
  }, [prompt, improvedPrompt]);

  useEffect(() => {
    if (!questionsComplete) {
      setPostQuestionStage("intent-editor");
    }
  }, [questionsComplete]);

  const onAnswer = (key: keyof Answers, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const startCoach = () => {
    setIsStarted(true);
    window.parent.postMessage(
      {
        source: SOURCE,
        type: ACTIVATE_EVENT,
        payload: { active: true }
      },
      "*"
    );
  };

  return (
    <div className="app">
      <Header />
      <div className="card">
        <h3>Start</h3>
        <p>{isStarted ? "Coach is active and reading your prompt." : "Click start to wake up the coach."}</p>
        <button onClick={startCoach} disabled={isStarted}>
          {isStarted ? "Coach Started" : "Start Coach"}
        </button>
      </div>

      <PromptListener prompt={prompt} />
      {apiError && (
        <div className="card">
          <p className="subtle">{apiError}</p>
        </div>
      )}

      {manualMode && (
        <div className="card">
          <p>Textarea not found on page. Paste your prompt manually:</p>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
      )}

      <div className="card">
        <h2>Coach Container</h2>
        <p className="subtle">State: {stage}</p>
        <DetectionView isComplex={isComplex} />

        {stage === "questions" && <QuestionsView answers={answers} onSelect={onAnswer} />}
        {stage === "intent-editor" && <IntentEditor intent={intent} setIntent={setIntent} />}
        {stage === "prompt-output" && <PromptOutput improvedPrompt={improvedPrompt} />}
        {stage === "skill-suggestions" && <SkillSuggestions skills={skills} />}
      </div>

      {questionsComplete && stage !== "action" && (
        <div className="card">
          <button
            onClick={() =>
              setPostQuestionStage((current) =>
                current === "intent-editor"
                  ? "prompt-output"
                  : current === "prompt-output"
                    ? "skill-suggestions"
                    : "action"
              )
            }
          >
            Continue
          </button>
        </div>
      )}

      {stage === "action" && <ActionButtons improvedPrompt={improvedPrompt} />}
    </div>
  );
}
