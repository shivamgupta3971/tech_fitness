"use client";

import { useState } from "react";
import type { GroceryItem } from "../../lib/storage";
import { setGroceryChecked } from "../../lib/storage";
import { useGroceryChecked } from "../../lib/useAppData";

interface Props {
  planId: string;
  items: GroceryItem[];
}

const CATEGORIES: GroceryItem["category"][] = ["protein", "grain", "dairy", "vegetable", "fruit", "spice", "other"];

const CATEGORY_TITLES: Record<GroceryItem["category"], { title: string; icon: string }> = {
  protein: { title: "Proteins & Legumes", icon: "🍗" },
  grain: { title: "Grains, Flours & Staples", icon: "🌾" },
  dairy: { title: "Dairy & Fats", icon: "🥛" },
  vegetable: { title: "Fresh Vegetables", icon: "🥦" },
  fruit: { title: "Fruits", icon: "🍎" },
  spice: { title: "Spices & Pantry", icon: "🌶️" },
  other: { title: "Miscellaneous", icon: "🛒" },
};

export default function GroceryListView({ planId, items }: Props) {
  // Ticks are stored per plan, so they survive switching tabs, navigating away and reloading.
  const checked = useGroceryChecked(planId);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const toggleCheck = (name: string) => {
    const next = new Set(checked);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setGroceryChecked(planId, Array.from(next));
  };

  const copyToClipboard = async () => {
    const lines: string[] = ["FITVEDA WEEKLY GROCERY LIST"];
    for (const cat of CATEGORIES) {
      const group = items.filter((i) => i.category === cat);
      if (group.length === 0) continue;
      lines.push("", CATEGORY_TITLES[cat].title.toUpperCase());
      for (const item of group) lines.push(`[${checked.has(item.name) ? "x" : " "}] ${item.name} — ${item.totalQuantity}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyState("copied");
    } catch {
      setCopyState("failed"); // insecure context or permission denied
    }
    setTimeout(() => setCopyState("idle"), 2000);
  };

  const doneCount = items.filter((i) => checked.has(i.name)).length;

  return (
    <div className="bg-[#080814] border border-neon-cyan/20 rounded-2xl p-6 text-white shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
        <div>
          <h3
            className="text-lg font-bold tracking-[0.15em] uppercase text-neon-cyan"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            Weekly Grocery Checklist
          </h3>
          <p className="text-[11px] text-white/50 tracking-wider uppercase">
            {doneCount} of {items.length} ticked • Totals for the whole plan, as-cooked weights
          </p>
        </div>

        <button
          type="button"
          onClick={copyToClipboard}
          className="px-3 py-1.5 rounded border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/15 text-xs tracking-wider uppercase transition-colors flex items-center gap-1.5"
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          {copyState === "copied" ? "✓ COPIED!" : copyState === "failed" ? "COPY BLOCKED" : "📋 COPY LIST"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {CATEGORIES.map((cat) => {
          const group = items.filter((item) => item.category === cat);
          if (group.length === 0) return null;
          const { title, icon } = CATEGORY_TITLES[cat];

          return (
            <div key={cat} className="p-4 rounded-xl bg-black/40 border border-white/5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neon-magenta mb-3 flex items-center gap-2">
                <span aria-hidden="true">{icon}</span> {title}
              </h4>
              <ul className="space-y-1">
                {group.map((item) => {
                  const isChecked = checked.has(item.name);
                  return (
                    <li key={item.name}>
                      <label
                        className={`flex items-center justify-between gap-2 p-2 rounded cursor-pointer transition-colors text-xs ${
                          isChecked ? "bg-emerald-950/20 text-white/40 line-through" : "hover:bg-white/5 text-white/80"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCheck(item.name)}
                            className="accent-neon-cyan rounded"
                          />
                          <span className="truncate">{item.name}</span>
                        </span>
                        <span className="font-mono text-[10px] text-neon-cyan/60 whitespace-nowrap">
                          {item.totalQuantity}
                          {item.uses && item.uses > 1 ? ` · ×${item.uses}` : ""}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
