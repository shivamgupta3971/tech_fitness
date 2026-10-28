"use client";

import { useState } from "react";
import type { GroceryItem } from "../../lib/storage";

interface Props {
  items: GroceryItem[];
}

export default function GroceryListView({ items }: Props) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  const toggleCheck = (name: string) => {
    setCheckedItems((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const categories: GroceryItem["category"][] = [
    "protein",
    "grain",
    "dairy",
    "vegetable",
    "fruit",
    "spice",
    "other",
  ];

  const categoryTitles: Record<GroceryItem["category"], { title: string; icon: string }> = {
    protein: { title: "Proteins & Legumes", icon: "🍗" },
    grain: { title: "Grains, Flours & Staples", icon: "🌾" },
    dairy: { title: "Dairy & Fats", icon: "🥛" },
    vegetable: { title: "Fresh Vegetables", icon: "🥦" },
    fruit: { title: "Fruits", icon: "🍎" },
    spice: { title: "Spices & Pantry", icon: "🌶️" },
    other: { title: "Miscellaneous", icon: "🛒" },
  };

  const copyToClipboard = () => {
    const text = items
      .map((item) => `[${checkedItems[item.name] ? "x" : " "}] ${item.name} (${item.totalQuantity})`)
      .join("\n");
    navigator.clipboard.writeText("FITVEDA WEEKLY GROCERY LIST:\n" + text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#080814] border border-neon-cyan/20 rounded-2xl p-6 text-white shadow-xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
        <div>
          <h3
            className="text-lg font-bold tracking-[0.15em] uppercase text-neon-cyan"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            Weekly Grocery Checklist
          </h3>
          <p className="text-[11px] text-white/50 tracking-wider uppercase">
            Aggregated Ingredients for 7-Day Plan
          </p>
        </div>

        <button
          onClick={copyToClipboard}
          className="px-3 py-1.5 rounded border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/15 text-xs tracking-wider uppercase transition-colors flex items-center gap-1.5"
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          {copied ? "✓ COPIED!" : "📋 COPY LIST"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((cat) => {
          const group = items.filter((item) => item.category === cat);
          if (group.length === 0) return null;
          const { title, icon } = categoryTitles[cat];

          return (
            <div key={cat} className="p-4 rounded-xl bg-black/40 border border-white/5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neon-magenta mb-3 flex items-center gap-2">
                <span>{icon}</span> {title}
              </h4>
              <ul className="space-y-2">
                {group.map((item) => {
                  const isChecked = !!checkedItems[item.name];
                  return (
                    <li
                      key={item.name}
                      onClick={() => toggleCheck(item.name)}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-xs ${
                        isChecked
                          ? "bg-emerald-950/20 text-white/40 line-through"
                          : "hover:bg-white/5 text-white/80"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="accent-neon-cyan rounded"
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-neon-cyan/60">
                        {item.totalQuantity}
                      </span>
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
