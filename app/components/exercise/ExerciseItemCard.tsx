"use client";

import Link from "next/link";
import { useState } from "react";
import type { PlannedExercise } from "../../lib/storage";

interface Props {
  exercise: PlannedExercise;
  onStatusChange?: (status: PlannedExercise["status"], notes?: string) => void;
}

export default function ExerciseItemCard({ exercise, onStatusChange }: Props) {
  const [showInstructions, setShowInstructions] = useState(false);
  const [showModNotes, setShowModNotes] = useState(false);
  const [modNote, setModNote] = useState(exercise.notes || "");

  const isCompleted = exercise.status === "completed";
  const isSkipped = exercise.status === "skipped";
  const isModified = exercise.status === "modified";

  return (
    <div
      className={`p-4 rounded-xl border bg-black/60 transition-all duration-200 ${
        isCompleted
          ? "border-emerald-500/50 bg-emerald-950/20"
          : isSkipped
          ? "border-red-500/30 bg-red-950/10 opacity-60"
          : isModified
          ? "border-amber-500/40 bg-amber-950/20"
          : "border-white/10 hover:border-neon-cyan/40 shadow-lg"
      }`}
    >
      {/* Header: Name, Target, & Tracking Status Badge */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <h4
            className="text-sm sm:text-base font-semibold text-white tracking-wide"
            style={{ fontFamily: "var(--font-chakra-petch)" }}
          >
            {exercise.name}
          </h4>
          <div className="text-[10px] text-white/50 tracking-wider uppercase mt-0.5">
            Target: {exercise.targetMuscles.slice(0, 3).join(", ")}
          </div>
        </div>

        {/* Honest Tracking Badge */}
        {exercise.trackable ? (
          <span
            className="text-[9px] font-bold tracking-[0.18em] uppercase px-2.5 py-1 rounded bg-neon-cyan/20 border border-neon-cyan/60 text-neon-cyan shadow-[0_0_10px_rgba(0,255,255,0.3)] flex items-center gap-1.5"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            <span>🎯</span> AI TRACKABLE
          </span>
        ) : (
          <span className="text-[9px] tracking-wider uppercase px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/40">
            ✋ MANUAL LOG
          </span>
        )}
      </div>

      {/* Target Volume (Sets / Reps / Duration) */}
      <div className="flex items-center gap-3 text-xs font-mono my-2 text-white/80">
        {exercise.sets && (
          <div className="bg-white/5 px-2 py-1 rounded border border-white/5">
            <span className="text-white/40 text-[9px]">SETS: </span>
            <span className="font-bold text-neon-cyan">{exercise.sets}</span>
          </div>
        )}
        {exercise.reps && (
          <div className="bg-white/5 px-2 py-1 rounded border border-white/5">
            <span className="text-white/40 text-[9px]">REPS: </span>
            <span className="font-bold text-neon-magenta">{exercise.reps}</span>
          </div>
        )}
        {exercise.durationSeconds && (
          <div className="bg-white/5 px-2 py-1 rounded border border-white/5">
            <span className="text-white/40 text-[9px]">TIME: </span>
            <span className="font-bold text-neon-yellow">{exercise.durationSeconds}s</span>
          </div>
        )}
        <div className="bg-white/5 px-2 py-1 rounded border border-white/5 text-[10px] text-white/50 capitalize">
          {exercise.difficulty}
        </div>
      </div>

      {/* Beginner Alternative If Present */}
      {exercise.beginnerAlternative && (
        <div className="text-[10px] text-amber-300/80 mb-2 flex items-center gap-1">
          <span>💡</span> Easy alternative: {exercise.beginnerAlternative}
        </div>
      )}

      {/* Instructions toggle */}
      {exercise.instructions && exercise.instructions.length > 0 && (
        <div className="my-2">
          <button
            onClick={() => setShowInstructions((s) => !s)}
            className="text-[10px] uppercase tracking-wider text-neon-cyan/70 hover:text-neon-cyan transition-colors"
          >
            {showInstructions ? "▼ Hide Form Cues" : "▶ View Form Cues"}
          </button>
          {showInstructions && (
            <ul className="mt-1.5 p-2 rounded bg-black/40 border border-white/5 text-[11px] text-white/70 space-y-1 list-disc list-inside">
              {exercise.instructions.map((inst, i) => (
                <li key={i}>{inst}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Bottom Action Row */}
      <div className="pt-3 mt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
        {/* Arena Integration Link for Trackable Movements */}
        {exercise.trackable ? (
          <Link
            href={`/?mode=${exercise.trackingMode === "dance" ? "dance" : "gym"}&exercise=${exercise.catalogId}`}
            className="px-3 py-1.5 rounded-lg bg-neon-cyan/20 border border-neon-cyan text-neon-cyan font-bold text-[10px] tracking-[0.18em] uppercase hover:bg-neon-cyan/35 transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,255,255,0.25)]"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            <span>📹</span> TRACK IN ARENA →
          </Link>
        ) : (
          <span className="text-[10px] text-white/40 italic">
            Self-guided • Check off when done
          </span>
        )}

        {/* Completion Status Buttons */}
        {onStatusChange && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onStatusChange(isCompleted ? "pending" : "completed")}
              className={`px-2.5 py-1 rounded text-[10px] tracking-wider uppercase font-semibold transition-all ${
                isCompleted
                  ? "bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
              }`}
            >
              {isCompleted ? "✓ Done" : "Mark Done"}
            </button>

            <button
              onClick={() => onStatusChange(isSkipped ? "pending" : "skipped")}
              className={`px-2 py-1 rounded text-[10px] uppercase transition-all ${
                isSkipped
                  ? "bg-red-600/80 text-white"
                  : "bg-white/5 text-white/40 hover:text-white/70"
              }`}
              title="Skip this movement"
            >
              Skip
            </button>

            <button
              onClick={() => setShowModNotes((n) => !n)}
              className={`px-2 py-1 rounded text-[10px] uppercase transition-all ${
                isModified
                  ? "bg-amber-600/60 text-white"
                  : "bg-white/5 text-white/40 hover:text-white/70"
              }`}
              title="Mark as modified (e.g. fewer reps, modified stance)"
            >
              Mod
            </button>
          </div>
        )}
      </div>

      {/* Modification Note input */}
      {showModNotes && onStatusChange && (
        <div className="mt-3 pt-2 border-t border-white/5 flex gap-2">
          <input
            type="text"
            placeholder="e.g. did 8 reps instead of 12, knee on floor"
            value={modNote}
            onChange={(e) => setModNote(e.target.value)}
            className="flex-1 bg-black/60 border border-amber-500/30 rounded px-2 py-1 text-xs text-white focus:outline-none"
          />
          <button
            onClick={() => {
              onStatusChange("modified", modNote);
              setShowModNotes(false);
            }}
            className="px-2.5 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] uppercase"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
