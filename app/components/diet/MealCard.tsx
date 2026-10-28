"use client";

import { useState } from "react";
import type { Meal } from "../../lib/storage";

interface Props {
  meal: Meal;
  isEaten?: boolean;
  portionMultiplier?: number;
  onToggleEaten?: (eaten: boolean, portion: number) => void;
  onSwap?: (mealId: string) => void;
}

export default function MealCard({
  meal,
  isEaten = false,
  portionMultiplier = 1.0,
  onToggleEaten,
  onSwap,
}: Props) {
  const [showPrep, setShowPrep] = useState(false);
  const [portion, setPortion] = useState(portionMultiplier);

  const typeGradients: Record<Meal["type"], { border: string; badge: string }> = {
    breakfast: { border: "border-amber-400/30", badge: "bg-amber-400/20 text-amber-300" },
    lunch: { border: "border-neon-cyan/30", badge: "bg-neon-cyan/20 text-neon-cyan" },
    snack: { border: "border-neon-green/30", badge: "bg-neon-green/20 text-neon-green" },
    dinner: { border: "border-neon-violet/30", badge: "bg-neon-violet/20 text-neon-violet" },
  };

  const currentTheme = typeGradients[meal.type] || typeGradients.lunch;

  const handlePortionChange = (newPortion: number) => {
    setPortion(newPortion);
    if (isEaten && onToggleEaten) {
      onToggleEaten(true, newPortion);
    }
  };

  return (
    <div
      className={`relative rounded-xl border bg-black/60 p-4 transition-all duration-300 ${
        currentTheme.border
      } ${
        isEaten
          ? "opacity-70 bg-emerald-950/20 border-emerald-500/40"
          : "hover:border-opacity-60 shadow-lg"
      }`}
    >
      {/* Top Bar: Meal Type & Verified Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded font-bold ${currentTheme.badge}`}
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          {meal.type}
        </span>

        <div className="flex items-center gap-2">
          {/* Verified / Estimated badge */}
          {meal.nutrition.verified ? (
            <span
              className="text-[9px] tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 flex items-center gap-1"
              title="Verified: Nutritional values derived strictly from verified Indian/USDA database"
            >
              <span>✓</span> VERIFIED
            </span>
          ) : (
            <span
              className="text-[9px] tracking-wider uppercase px-2 py-0.5 rounded bg-amber-900/40 border border-amber-500/40 text-amber-300 flex items-center gap-1"
              title="Estimated: Nutritional values calculated from estimated macro profiles"
            >
              <span>~</span> ESTIMATED
            </span>
          )}

          {onSwap && (
            <button
              onClick={() => onSwap(meal.id)}
              className="text-[10px] text-white/50 hover:text-neon-cyan transition-colors"
              title="Replace / Swap Meal"
            >
              🔄
            </button>
          )}
        </div>
      </div>

      {/* Dish Name */}
      <h3
        className="text-base font-semibold text-white tracking-wide mb-2"
        style={{ fontFamily: "var(--font-chakra-petch)" }}
      >
        {meal.name}
      </h3>

      {/* Macros Grid */}
      <div className="grid grid-cols-4 gap-2 p-2 rounded-lg bg-white/5 border border-white/5 mb-3 text-center">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-white/50">Cals</div>
          <div className="text-xs font-bold text-neon-cyan">
            {Math.round(meal.nutrition.calories * portion)}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-white/50">Protein</div>
          <div className="text-xs font-bold text-neon-magenta">
            {Math.round(meal.nutrition.proteinG * portion)}g
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-white/50">Carbs</div>
          <div className="text-xs font-bold text-neon-yellow">
            {Math.round(meal.nutrition.carbsG * portion)}g
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-white/50">Fat</div>
          <div className="text-xs font-bold text-neon-pink">
            {Math.round(meal.nutrition.fatG * portion)}g
          </div>
        </div>
      </div>

      {/* Ingredients List */}
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-wider text-white/60 mb-1 font-semibold">
          Ingredients:
        </div>
        <ul className="text-xs text-white/80 space-y-1">
          {meal.ingredients.map((ing, idx) => (
            <li key={idx} className="flex items-center justify-between text-[11px]">
              <span>• {ing.name}</span>
              <span className="text-neon-cyan/70 font-mono text-[10px]">{ing.quantity}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Hydration Reminder if present */}
      {meal.hydrationReminderMl && (
        <div className="text-[10px] text-cyan-300/80 mb-3 flex items-center gap-1.5 bg-cyan-950/20 px-2 py-1 rounded border border-cyan-800/30">
          <span>💧</span> Drink {meal.hydrationReminderMl}ml water with this meal
        </div>
      )}

      {/* Prep Steps Toggle */}
      {meal.prepSteps && meal.prepSteps.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowPrep((p) => !p)}
            className="text-[10px] uppercase tracking-wider text-neon-cyan/80 hover:text-neon-cyan flex items-center gap-1 transition-colors"
          >
            <span>{showPrep ? "▼" : "▶"}</span> Quick Prep Guide ({meal.prepSteps.length} steps)
          </button>
          {showPrep && (
            <ol className="mt-2 text-[11px] text-white/70 space-y-1 list-decimal list-inside pl-1 bg-black/40 p-2 rounded border border-white/5">
              {meal.prepSteps.map((step, sIdx) => (
                <li key={sIdx}>{step}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Completion & Portion Control */}
      <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-white/50 uppercase">Portion:</span>
          {[0.5, 1.0, 1.5].map((p) => (
            <button
              key={p}
              onClick={() => handlePortionChange(p)}
              className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                portion === p
                  ? "border-neon-cyan bg-neon-cyan/20 text-neon-cyan font-bold"
                  : "border-white/10 text-white/40 hover:text-white"
              }`}
            >
              {p}x
            </button>
          ))}
        </div>

        {onToggleEaten && (
          <button
            onClick={() => onToggleEaten(!isEaten, portion)}
            className={`px-3 py-1 rounded text-[10px] tracking-wider uppercase font-semibold transition-all ${
              isEaten
                ? "bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
            }`}
          >
            {isEaten ? "✓ Eaten" : "Mark as Eaten"}
          </button>
        )}
      </div>
    </div>
  );
}
