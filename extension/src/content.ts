const SIDEBAR_ID = "coach-sidebar";
const TOGGLE_ID = "coach-toggle-button";
const SIDEBAR_WIDTH = 360;
const SIDEBAR_ORIGIN = "claude-capability-coach";
const INSERT_PROMPT_EVENT = "coach:insert-prompt";

function isClaudePage(): boolean {
  return window.location.hostname.includes("claude.ai");
}

function injectSidebar(): HTMLIFrameElement {
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
  iframe.style.transform = "translateX(100%)";
  iframe.style.transition = "transform 0.3s ease";
  iframe.title = "Claude Capability Coach";
  iframe.dataset.open = "false";

  document.body.appendChild(iframe);
  return iframe;
}

function injectToggleButton(sidebar: HTMLIFrameElement): HTMLButtonElement {
  if (document.getElementById(TOGGLE_ID)) {
    return document.getElementById(TOGGLE_ID) as HTMLButtonElement;
  }

  const button = document.createElement("button");
  button.id = TOGGLE_ID;
  button.textContent = "Coach";
  button.style.position = "fixed";
  button.style.right = "20px";
  button.style.top = "50%";
  button.style.transform = "translateY(-50%)";
  button.style.width = "54px";
  button.style.height = "54px";
  button.style.borderRadius = "999px";
  button.style.border = "1px solid #d1d5db";
  button.style.background = "#111827";
  button.style.color = "#ffffff";
  button.style.fontWeight = "600";
  button.style.cursor = "pointer";
  button.style.zIndex = "10000";
  button.style.boxShadow = "0 8px 18px rgba(0,0,0,0.2)";

  button.addEventListener("click", () => {
    const isOpen = sidebar.dataset.open === "true";
    sidebar.dataset.open = isOpen ? "false" : "true";
    sidebar.style.transform = isOpen ? "translateX(100%)" : "translateX(0)";
  });

  document.body.appendChild(button);
  return button;
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

    if (data.type === INSERT_PROMPT_EVENT) {
      insertPromptIntoClaude(String(data.payload?.prompt ?? ""));
    }
  });
}

function bootstrap(): void {
  if (!isClaudePage()) {
    return;
  }

  const sidebar = injectSidebar();
  injectToggleButton(sidebar);
  attachControlListener();
}

bootstrap();
