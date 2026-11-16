"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ApiError,
  sendChat,
  type ChatMessage,
  type Prescription,
  type SafetyReport,
} from "@/lib/api";

interface ChatPanelProps {
  prescription: Prescription | null;
  report: SafetyReport | null;
}

/** Markdown elements in an assistant answer, styled to the tokens.
User messages stay plain text. */
const markdownComponents = {
  p: ({ node: _node, ...props }: { node?: unknown }) => (
    <p className="mb-2 last:mb-0" {...props} />
  ),
  strong: ({ node: _node, ...props }: { node?: unknown }) => (
    <strong className="font-semibold text-ink-900" {...props} />
  ),
  em: ({ node: _node, ...props }: { node?: unknown }) => (
    <em {...props} />
  ),
  ul: ({ node: _node, ...props }: { node?: unknown }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0" {...props} />
  ),
  ol: ({ node: _node, ...props }: { node?: unknown }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0" {...props} />
  ),
  li: ({ node: _node, ...props }: { node?: unknown }) => (
    <li {...props} />
  ),
  h1: ({ node: _node, ...props }: { node?: unknown }) => (
    <h3 className="mb-2 font-display text-base font-bold text-ink-900" {...props} />
  ),
  h2: ({ node: _node, ...props }: { node?: unknown }) => (
    <h3 className="mb-2 font-display text-base font-bold text-ink-900" {...props} />
  ),
  h3: ({ node: _node, ...props }: { node?: unknown }) => (
    <h3 className="mb-1 font-display text-sm font-bold text-ink-900" {...props} />
  ),
  a: ({ node: _node, ...props }: { node?: unknown }) => (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a
      className="font-medium text-brand-700 underline"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  code: ({ node: _node, ...props }: { node?: unknown }) => (
    <code
      className="rounded bg-ink-200/60 px-1 py-0.5 text-[13px] text-ink-900"
      {...props}
    />
  ),
  blockquote: ({ node: _node, ...props }: { node?: unknown }) => (
    <blockquote
      className="mb-2 border-l-2 border-ink-300 pl-3 italic last:mb-0"
      {...props}
    />
  ),
  hr: ({ node: _node, ...props }: { node?: unknown }) => (
    <hr className="my-3 border-ink-200" {...props} />
  ),
};

export default function ChatPanel({ prescription, report }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = prescription !== null;

  const ask = async () => {
    const question = input.trim();
    if (!question || !enabled || sending) return;
    setError(null);
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: question },
    ];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await sendChat(next, {
        prescription: prescription as Prescription,
        report,
      });
      // Sources attach to this assistant message and render inside
      // its bubble — there is no separate sources box anymore.
      setMessages([
        ...next,
        {
          role: "assistant",
          content: res.answer,
          sources: res.sources ?? [],
        },
      ]);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "The chat request failed. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft sm:p-6">
      <h2 className="font-display text-base font-bold text-ink-900">
        Ask about this scan
      </h2>
      {!enabled ? (
        <p className="mt-2 text-sm text-ink-500">
          Scan a prescription first — the chat answers questions about your
          scan&apos;s findings.
        </p>
      ) : (
        <>
          {messages.length > 0 && (
            <div className="mt-4 space-y-3">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    m.role === "user"
                      ? "ml-8 bg-brand-600 text-white"
                      : "mr-8 bg-ink-100 text-ink-800"
                  }`}
                >
                  <p
                    className={`mb-1 text-xs font-semibold ${
                      m.role === "user" ? "text-brand-100" : "text-ink-400"
                    }`}
                  >
                    {m.role === "user" ? "You" : "RxSentinel"}
                  </p>
                  {m.role === "assistant" ? (
                    <div className="leading-relaxed">
                      <ReactMarkdown components={markdownComponents}>
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                  {m.role === "assistant" &&
                    m.sources &&
                    m.sources.length > 0 && (
                      <div className="mt-3 border-t border-ink-200/70 pt-2 text-xs text-ink-400">
                        <p className="font-medium">Sources:</p>
                        <ul className="list-disc space-y-1 pl-5">
                          {m.sources.map((s, j) => (
                            <li key={`${s.id}-${j}`} className="break-words">
                              <span className="font-medium text-ink-500">
                                {s.source}:
                              </span>{" "}
                              {s.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </motion.div>
              ))}
              {sending && (
                <p className="text-sm italic text-ink-400">Thinking…</p>
              )}
            </div>
          )}
          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
              {error}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") ask();
              }}
              placeholder="Ask about a finding, a dose, or a medicine…"
              aria-label="Ask about this scan"
              className="min-h-12 flex-1 rounded-xl border border-ink-200 bg-ink-50/60 px-4 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              onClick={ask}
              disabled={sending || !input.trim()}
              className="min-h-12 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-200"
            >
              Send
            </button>
          </div>
        </>
      )}
    </section>
  );
}
