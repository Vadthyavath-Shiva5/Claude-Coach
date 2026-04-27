const SIDEBAR_ID = "coach-sidebar";
const SIDEBAR_WIDTH = 360;
const SIDEBAR_ORIGIN = "claude-capability-coach";
const PROMPT_EVENT = "coach:prompt";
const FALLBACK_EVENT = "coach:manual-input-required";
const ACTIVATE_EVENT = "coach:activate";
const INSERT_PROMPT_EVENT = "coach:insert-prompt";

let isCoachActive = false;
let boundTextarea: HTMLTextAreaElement | null = null;

function isClaudePage(): boolean {
  return window.location.hostname.includes("claude.ai");
}

function injectSidebar(): HTMLIFrameElement | null {
  if (document.getElementById(SIDEBAR_ID)) {
    return document.getElementById(SIDEBAR_ID) as HTMLIFrameElement;
  }

  const iframe = document.createElement("iframe");
  iframe.id = SIDEBAR_ID;
  iframe.src = chrome.runtime.getURL("sidebar.html");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.top = "0";
  iframe.style.width = `${SIDEBAR_WIDTH}px`;
  iframe.style.height = "100vh";
  iframe.style.background = "white";
  iframe.style.zIndex = "9999";
  iframe.style.border = "0";
  iframe.style.borderLeft = "1px solid #e4e4e7";
  iframe.style.boxShadow = "-6px 0 18px rgba(0,0,0,0.06)";
  iframe.title = "Claude Capability Coach";

  document.body.appendChild(iframe);
  document.body.style.marginRight = `${SIDEBAR_WIDTH}px`;
  return iframe;
}

function postCoachEvent(type: string, payload: unknown): void {
  window.postMessage(
    {
      source: SIDEBAR_ORIGIN,
      type,
      payload
    },
    "*"
  );
}

function attachPromptCapture(): void {
  if (!isCoachActive) {
    return;
  }

  const textarea = document.querySelector("textarea");
  if (!textarea) {
    postCoachEvent(FALLBACK_EVENT, { reason: "textarea-not-found" });
    return;
  }

  const target = textarea as HTMLTextAreaElement;
  if (boundTextarea === target) {
    postCoachEvent(PROMPT_EVENT, { prompt: target.value });
    return;
  }

  boundTextarea = target;
  postCoachEvent(PROMPT_EVENT, { prompt: target.value });
  target.addEventListener("input", () => {
    if (!isCoachActive) {
      return;
    }
    postCoachEvent(PROMPT_EVENT, { prompt: target.value });
  });
}

function insertPromptIntoClaude(prompt: string): void {
  const textarea = document.querySelector("textarea") as HTMLTextAreaElement | null;
  if (!textarea) {
    postCoachEvent(FALLBACK_EVENT, { reason: "textarea-not-found" });
    return;
  }

  textarea.value = prompt;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
}

function attachControlListener(): void {
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== SIDEBAR_ORIGIN) {
      return;
    }

    if (data.type === ACTIVATE_EVENT) {
      isCoachActive = Boolean(data.payload?.active);
      if (isCoachActive) {
        attachPromptCapture();
      }
    }

    if (data.type === INSERT_PROMPT_EVENT) {
      insertPromptIntoClaude(String(data.payload?.prompt ?? ""));
    }
  });
}

function bootstrap(): void {
  if (!isClaudePage()) {
    return;
  }

  injectSidebar();
  attachControlListener();
}

bootstrap();
