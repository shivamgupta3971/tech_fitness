# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"FITVEDA" — a real-time AI dance coaching web app (TreeHacks 2026 hackathon). User pastes a YouTube URL, the video downloads server-side, plays in a custom player alongside a webcam feed with live pose detection, scoring, and AI coaching feedback.

## Commands

- **Dev server:** `npm run dev` (runs on localhost:3000)
- **Build:** `npm run build`
- **Typecheck:** `npm run typecheck` (tsc --noEmit)
- **Lint:** `npm run lint` (ESLint with Next.js config)
- **Test:** `npm run test` (Vitest test suite)

## System Dependencies

- **yt-dlp** — required for YouTube video downloads (spawned via child_process)
- **ffmpeg** — used by yt-dlp for muxing
- **OPENAI_API_KEY**, **GROQ_API_KEY** — required (coach + report, mode detection + live scoring). See `.env.example`.
- **SARVAM_API_KEY** — optional, spoken voice for the coach (Sarvam AI bulbul:v3). Without it the coach is text-only.

## Architecture

### Data Flow

```
YouTube URL → /api/download (SSE: progress → done → classified) → {VIDEO_DIR}/{id}.mp4 (OS temp dir + /fitveda by default)
  → classified event sets mode (gym/dance) → ModeOverlay flash (3s)
  → /api/video/[id] (serves MP4 with range requests)
  → Client: pose extraction (hidden video+canvas, MediaPipe, 10fps)
  → PoseTimeline displayed as MoveQueue strip

Webcam → MediaPipe Pose (self-hosted from /public, on-device) → skeleton overlay + scoring
  → buildPoseSummary() → /api/coach (OpenAI) → text (+ Sarvam TTS audio if configured)
```

### Key Files

- **`app/page.tsx`** — Main orchestrator. Owns all top-level state (download, extraction, scoring, coaching). Coordinates the full pipeline.
- **`app/lib/pose.ts`** — MediaPipe Pose setup (WASM/model files served from `/public`). Exports `loadPose()`, `drawSkeleton()` (parameterized with `SkeletonStyle`), and pose connection/landmark types.
- **`app/lib/videoPoseExtractor.ts`** — Client-side pipeline: creates hidden video+canvas, seeks through frames at 0.1s intervals, runs MediaPipe on each, returns `PoseTimeline`.
- **`app/lib/scoring.ts`** — Choreography-agnostic scoring: movement energy (keypoint velocity), form heuristics (arm height, torso angle, symmetry). Exports `computeScore()` and `buildPoseSummary()`.
- **`app/lib/coach.ts`** — Maintains conversation history (last 6 exchanges), throttles to one call per 3s. Sends pose summaries to `/api/coach`.
- **`app/components/ModeOverlay.tsx`** — Full-screen flashy overlay announcing the detected mode ("BEAST MODE" / "LET'S GROOVE"). Triggered by a `seq` counter prop. Uses layered CSS animations: expanding ring bursts, horizontal streaks, diagonal flashes, slam-in text, and expanding-letter-spacing subtitle. Auto-hides after 3s, `pointer-events: none`.
- **`app/api/download/route.ts`** — POST endpoint. Spawns yt-dlp, parses stdout for progress, streams SSE events (`progress`, `done`, `classified`, `error`). Caches to `VIDEO_DIR`.
- **`app/api/video/[id]/route.ts`** — GET endpoint. Serves MP4 with HTTP range request support. Uses `cancelled` flag pattern to prevent ERR_INVALID_STATE on stream cancellation.
- **`app/api/coach/route.ts`** — POST endpoint. OpenAI chat completion with system prompt for dance/gym coaching personality, plus optional Sarvam TTS.
- **`app/shared/`** — Core scoring, coaching, speech and pose types (re-exported by `app/lib/` shims).

### Important Patterns

- **Classification gate:** `page.tsx` holds a `classificationStatus` (`idle → pending → done`). After download completes, the arena UI stays hidden (shows "Detecting mode..." indicator) until the `classified` SSE event arrives. An 8s safety timeout defaults to dance mode if classification never resolves. The `ModeOverlay` fires on transition to `done`.
- **SSE streaming for downloads:** `/api/download` streams `data: {json}\n\n` events including `classified` for mode detection. Client reads with `res.body.getReader()` and parses line-by-line.
- **forwardRef + useImperativeHandle:** `YoutubePanel` exposes `getCurrentTime()` so `page.tsx` can poll video position via rAF loop for MoveQueue sync.
- **Stable callback ref:** `onPoseRef` pattern in `page.tsx` prevents CameraPanel remounts when scoring/coaching logic changes. The actual `handlePose` callback passed to CameraPanel has empty deps.
- **MediaPipe assets self-hosted:** WASM/tflite files live in `public/` and are resolved via `locateFile` in `pose.ts`, keeping them out of the JS bundle.
- **Video ID validation:** Regex `^[a-zA-Z0-9_-]{11}$` in download route. Files stored at `{VIDEO_DIR}/{videoId}.mp4`.

### Chrome Extension

Manifest v3 extension in `/extension/`. Sends the current YouTube tab URL to `http://localhost:3000?url=...`. The web app reads the `?url=` query param on mount.

### Planners (Diet, Exercise, Dashboard)

The LLM only *suggests*; code decides what ships. Plans live in localStorage (no database).

- **Diet** — `api/diet/plan` asks the LLM for **one day at a time** (7 small parallel calls, `json: true`; a single big call truncated at the token limit and produced malformed JSON, so every plan silently fell back). Each day is zod-checked (`planValidator.ts`), then safety-checked in `dietPlanner.ts` (`findDayViolation` → `nutrition.ts` allergen/diet matcher). A day that fails is replaced by one from the built-in meal bank, which is itself allergy-filtered. Nutrition comes from `nutrition.json` via `nutritionLookup.ts`, then portions are scaled so each day hits the calorie target (`buildDayForTarget`).
- **Allergen matching** is whole-word on purpose (`egg` must not match eggplant, `til` not lentil); compound words (buttermilk, raita…) are listed explicitly. Add new keywords to `ALLERGEN_KEYWORDS` and a test in `allergens.test.ts`.
- **Exercise** — `exercisePlanner.ts` builds the week deterministically from goal / level / duration / equipment / limitations; an LLM suggestion is accepted only after it is cleaned against the same rules (`buildWeek({ llmDays })`). The catalog is `app/data/exercises.ts`; exercises carry `stress` tags (knee, back, shoulder…) matched against free-text limitations. Only exercises the pose engine can score may set `trackable: true`.
- **Adaptive tweaks** (`adaptive.ts`) are pure: `suggestAdjustment` describes a change, `applyAdjustment` returns the new plan.
- **State** — read via the hooks in `lib/useAppData.ts` (`useSyncExternalStore` over localStorage); write via `lib/storage.ts`, which validates shapes on read and emits `STORAGE_EVENT` so every page updates. Don't copy storage into component state in an effect.
- **Dates** — always local dates via `lib/dates.ts` (`toLocalDateString`); never `toISOString().split("T")`, which is the UTC date. Clients send `startDate` so server plans start on the user's "today".
- **Arena hand-off** — `lib/arenaLink.ts` builds `/?mode=&exercise=&session=&item=`; the Arena shows `WorkoutTargetBanner` so the exercise can be ticked off there.
- **Layout** — the global nav has a fixed height (`--nav-h` in `globals.css`) and the Arena sizes itself to `100dvh - var(--nav-h)`. Keep the nav to one row.
- **Privacy note** — pose detection is on-device, but during a session with a reference video, webcam + video frames are sent to `/api/score` (Groq vision) and pose summaries to the coach. Plan generation sends profile details to the LLM provider.

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4 (via `@tailwindcss/postcss`)
- MediaPipe Pose (client-side WASM, served from /public)
- OpenAI API (server-side, for coaching)
- Sarvam AI TTS (server-side, via `/api/coach`, optional)
- yt-dlp + ffmpeg (server-side, video download)
