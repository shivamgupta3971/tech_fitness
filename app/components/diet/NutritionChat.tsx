"use client";

import { useState } from "react";
import type { UserProfile } from "../../lib/nutrition";
import type { DayPlan } from "../../lib/storage";

interface Props {
  profile?: UserProfile;
  activeDayPlan?: DayPlan;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function NutritionChat({ profile, activeDayPlan }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Namaste! I'm your FitVeda Nutrition Assistant. Have questions about swapping an ingredient, hitting your protein goals, or customizing meal portions?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    const userMsg: Message = { role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/diet/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          profile,
          currentPlan: activeDayPlan,
          history: messages.slice(-6),
        }),
      });

      const data = await res.json();
      const reply = data.reply || "Sorry, I could not process that request right now.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network error communicating with the nutrition assistant. Please try again.",
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
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 px-4 py-3 bg-gradient-to-r from-neon-cyan to-neon-magenta text-black font-bold rounded-full shadow-[0_0_25px_rgba(0,255,255,0.4)] hover:scale-105 transition-all flex items-center gap-2 text-xs uppercase tracking-wider"
        style={{ fontFamily: "var(--font-audiowide)" }}
      >
        <span>💬</span>
        <span>{isOpen ? "Close AI Diet Chat" : "Ask AI Dietitian"}</span>
      </button>

      {/* Slide-out / Floating Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-96 max-w-[90vw] h-[500px] bg-[#080814] border border-neon-cyan/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl">
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
              onClick={() => setIsOpen(false)}
              className="text-white/40 hover:text-white text-xs px-2"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl max-w-[85%] leading-relaxed ${
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
                Analyzing your diet plan & allergies...
              </div>
            )}
          </div>

          {/* Quick Suggestions */}
          <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto border-t border-white/5 bg-black/30">
            {["Can I swap paneer?", "High-protein snack ideas", "How to adjust calories?"].map(
              (chip, cIdx) => (
                <button
                  key={cIdx}
                  onClick={() => setInput(chip)}
                  className="px-2 py-0.5 rounded-full border border-white/10 text-[9px] text-white/50 hover:text-neon-cyan hover:border-neon-cyan whitespace-nowrap transition-colors"
                >
                  {chip}
                </button>
              )
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={sendMessage} className="p-2 bg-black/60 border-t border-white/10 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about meal swaps, calories..."
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
