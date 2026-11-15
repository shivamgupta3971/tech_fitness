"use client";

import { useEffect, useRef, useState } from "react";
import type { UserProfile } from "../../lib/nutrition";
import type { DayPlan } from "../../lib/storage";
import { postJson } from "../../lib/api";

interface Props {
  profile?: UserProfile;
  activeDayPlan?: DayPlan;
  /** Daily calorie target computed from the profile; the assistant uses it to keep suggestions on plan. */
  targetCalories?: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const GREETING: Message = {
  role: "assistant",
  content:
    "Namaste! I'm your FitVeda Nutrition Assistant. Have questions about swapping an ingredient, hitting your protein goals, or customizing meal portions?",
};

export default function NutritionChat({ profile, activeDayPlan, targetCalories }: Props) {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading, isOpen]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    const history = messages.slice(-6);
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setInput("");
    setLoading(true);

    try {
      const data = await postJson<{ reply?: string }>(
        "/api/diet/chat",
        {
          message: query,
          profile: profile ? { ...profile, targetCalories } : undefined,
          currentPlan: activeDayPlan,
          history,
        },
        45_000
      );
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "Sorry, I could not process that request right now." },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "Network error communicating with the nutrition assistant. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="fixed bottom-6 right-6 z-40 px-4 py-3 bg-linear-to-r from-neon-cyan to-neon-magenta text-black font-bold rounded-full shadow-[0_0_25px_rgba(0,255,255,0.4)] hover:scale-105 transition-all flex items-center gap-2 text-xs uppercase tracking-wider"
        style={{ fontFamily: "var(--font-audiowide)" }}
      >
        <span aria-hidden="true">💬</span>
        <span>{isOpen ? "Close AI Diet Chat" : "Ask AI Dietitian"}</span>
      </button>

      {/* Slide-out / Floating Chat Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="AI Dietitian Assistant"
          className="fixed bottom-20 right-6 z-50 w-96 max-w-[90vw] h-125 max-h-[70dvh] bg-[#080814] border border-neon-cyan/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl"
        >
          {/* Header */}
          <div className="p-3 bg-black/60 border-b border-neon-cyan/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-neon-green animate-pulse" />
              <span
                className="text-xs uppercase tracking-wider text-neon-cyan font-bold"
                style={{ fontFamily: "var(--font-audiowide)" }}
              >
                AI Dietitian Assistant
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="text-white/40 hover:text-white text-xs px-2"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs" aria-live="polite">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl max-w-[85%] leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "ml-auto bg-neon-cyan/20 border border-neon-cyan/40 text-white rounded-br-none"
                    : "mr-auto bg-white/5 border border-white/10 text-white/90 rounded-bl-none"
                }`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="mr-auto bg-white/5 p-2 rounded-xl text-[11px] text-neon-cyan/60 animate-pulse">
                Analyzing your diet plan &amp; allergies...
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick Suggestions */}
          <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto border-t border-white/5 bg-black/30">
            {["Can I swap paneer?", "High-protein snack ideas", "How to adjust calories?"].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setInput(chip)}
                className="px-2 py-0.5 rounded-full border border-white/10 text-[9px] text-white/50 hover:text-neon-cyan hover:border-neon-cyan whitespace-nowrap transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={sendMessage} className="p-2 bg-black/60 border-t border-white/10 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about meal swaps, calories..."
              aria-label="Your question"
              maxLength={500}
              className="flex-1 bg-black/50 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-neon-cyan"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-3 py-1.5 rounded-lg bg-neon-cyan/20 border border-neon-cyan text-neon-cyan font-bold text-xs uppercase hover:bg-neon-cyan/30 transition-colors disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
