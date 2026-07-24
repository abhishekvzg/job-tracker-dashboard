"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatAction } from "@/lib/gemini";

type ChatMessage = {
  id: number;
  role: "user" | "assistant" | "error";
  text: string;
  action?: ChatAction;
  resolution?: "applied" | "cancelled";
};

let nextId = 1;
const MAX_TEXTAREA_HEIGHT = 120;

export function ChatWidget({ onApplied }: { onApplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nextId++,
      role: "assistant",
      text: 'Tell me what to add or update — e.g. "Mark Mastercard as Interview" or "Add an application to Google, applied via LinkedIn today".',
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [applyingId, setApplyingId] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [input]);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  function addMessage(msg: Omit<ChatMessage, "id">) {
    const id = nextId++;
    setMessages((m) => [...m, { ...msg, id }]);
    return id;
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    // History from before this message, so the model can see its own follow-up questions.
    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-12)
      .map((m) => ({ role: m.role, text: m.text }));
    addMessage({ role: "user", text });
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const json = await res.json();
      if (!res.ok) {
        const hint =
          res.status === 501
            ? " Add a GEMINI_API_KEY to .env.local and restart the dev server to enable this."
            : res.status === 401
              ? " Your Google Sheets connection expired — refresh the page and click Connect Google Sheets."
              : "";
        addMessage({ role: "error", text: (json.error || "Something went wrong.") + hint });
        return;
      }
      const action = json.action as ChatAction;
      if (action.intent === "unclear" || action.intent === "question") {
        addMessage({ role: "assistant", text: action.summary });
      } else {
        addMessage({ role: "assistant", text: action.summary, action });
      }
    } catch {
      addMessage({ role: "error", text: "Could not reach the server." });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    // Shift+Enter falls through to the textarea's default behavior (insert a newline).
  }

  async function applyAction(msgId: number, action: ChatAction) {
    setApplyingId(msgId);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applyAction: action }),
      });
      const json = await res.json();
      if (!res.ok) {
        const hint = res.status === 401 ? " Your Google Sheets connection expired — refresh the page and click Connect Google Sheets." : "";
        addMessage({ role: "error", text: (json.error || "Failed to apply the change.") + hint });
        return;
      }
      setMessages((m) => m.map((msg) => (msg.id === msgId ? { ...msg, resolution: "applied" } : msg)));
      addMessage({ role: "assistant", text: "Done — saved to your sheet. ✅" });
      onApplied();
    } catch {
      addMessage({ role: "error", text: "Could not reach the server." });
    } finally {
      setApplyingId(null);
    }
  }

  function cancelAction(msgId: number) {
    setMessages((m) => m.map((msg) => (msg.id === msgId ? { ...msg, resolution: "cancelled" } : msg)));
  }

  return (
    <div className="fixed bottom-6 right-6 z-100">
      {open && (
        <div
          className={`mb-3 flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl transition-[width,height] duration-150 dark:border-white/10 dark:bg-neutral-900 ${
            expanded ? "h-[min(720px,80vh)] w-[min(520px,90vw)]" : "h-[520px] w-[360px]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-black/8 bg-neutral-900 px-4 py-3 dark:border-white/10 dark:bg-neutral-950">
            <div className="text-sm font-extrabold text-white">AI Editor</div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-white/70 hover:text-white"
                aria-label={expanded ? "Collapse chat" : "Expand chat"}
                title={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? "⤡" : "⤢"}
              </button>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white" aria-label="Close chat">
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3.5">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-snug ${
                    msg.role === "user"
                      ? "bg-orange-600 text-white"
                      : msg.role === "error"
                        ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                        : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words font-medium">{msg.text}</div>
                  {msg.action && msg.action.intent !== "unclear" && !msg.resolution && (
                    <div className="mt-2 flex gap-1.5">
                      <button
                        onClick={() => applyAction(msg.id, msg.action!)}
                        disabled={applyingId === msg.id}
                        className="rounded-md bg-neutral-900 px-2.5 py-1 text-[12px] font-bold text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                      >
                        {applyingId === msg.id ? "Applying…" : `Apply${msg.action.intent === "delete" ? " (delete)" : ""}`}
                      </button>
                      <button
                        onClick={() => cancelAction(msg.id)}
                        disabled={applyingId === msg.id}
                        className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[12px] font-bold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {msg.resolution === "cancelled" && (
                    <div className="mt-1.5 text-[11.5px] font-semibold text-neutral-400 dark:text-neutral-500">
                      Cancelled — no changes made.
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-black/8 p-2.5 dark:border-white/10">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={sending ? "Waiting for a reply…" : "Type a command…"}
                rows={1}
                disabled={sending}
                className="max-h-[120px] flex-1 resize-none overflow-y-auto rounded-lg border border-neutral-300 px-3 py-2 text-[13px] font-medium leading-snug outline-none focus:border-orange-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="shrink-0 rounded-lg bg-orange-600 px-3 py-2 text-[13px] font-extrabold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {sending ? "…" : "Send"}
              </button>
            </div>
            <div className="mt-1 text-[10.5px] font-semibold text-neutral-400 dark:text-neutral-500">
              Enter to send · Shift+Enter for a new line
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-2xl text-white shadow-[0_6px_16px_rgba(234,88,12,0.4)] hover:bg-orange-700"
        aria-label="Toggle AI editor chat"
      >
        {open ? "×" : "💬"}
      </button>
    </div>
  );
}
