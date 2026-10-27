# FitVeda 🧘🕺

> **Real-time AI Fitness & Dance Trainer** — Turn any YouTube video, Zoom session, or AI-generated routine into an interactive, gamified workout with live pose estimation and voice coaching.

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Pose-orange)](https://developers.google.com/mediapipe)

---

## 🌟 Overview

FitVeda bridges the gap between passive video tutorials and having a personal trainer standing next to you. Paste any YouTube dance or workout link, connect your Zoom meeting, or prompt an AI-generated fitness routine. 

FitVeda streams the reference video side-by-side with your webcam, overlays real-time biomechanical skeleton tracking, grades your form with live scores and combos, and speaks actionable voice feedback in real time.

---

## ✨ Features

- **📺 Multi-Source Training**
  - **YouTube Direct Import:** Paste any YouTube URL. Server-side streaming (`yt-dlp` + FFmpeg) downloads and buffers the video with instant playback and A/B segment looping.
  - **Zoom Workout Mode:** Connect directly into Zoom classes using the Zoom Meeting SDK or capture screen/window for coach-led sessions.
  - **AI Workout Generator:** Generate personalized routines on demand using **Magic Hour** or **xAI Grok**.

- **⚡ 100% Private, On-Device Pose Tracking**
  - Powered by client-side **MediaPipe Pose (WASM)** served directly from the app.
  - High-frequency 30 FPS skeleton extraction and landmark smoothing.
  - **Zero video frames leave your machine** — full user privacy guaranteed.

- **🎯 Intelligent Mode Detection & Real-Time Scoring**
  - Automatically identifies whether your routine is **Dance** or **Gym** via Groq LLM.
  - Mode-specific scoring algorithms evaluate keypoint velocities, joint angles, limb height, symmetry, and repetition form.
  - Arcade-style feedback: *Perfect*, *Good*, *Miss*, combo streaks, and visual score pops.

- **🗣️ Real-Time AI Voice Coaching**
  - Context-aware coaching using **OpenAI** to analyze your pose summaries every 3 seconds.
  - High-quality text-to-speech audio powered by **Sarvam AI (`bulbul:v3`)** or browser Web Speech API.
  - Adaptable coach personalities: *Hype*, *Strict*, or *Balanced*.

- **🖐️ Hands-Free Gesture Controls**
  - Navigate, pause/resume, toggle loop segments, or dismiss overlays using physical hand gestures without touching your keyboard or mouse.

- **📊 Comprehensive Session Reports**
  - Post-workout interactive slide deck summarizing stars, longest streak, strengths, and areas for improvement.
  - **"Replay Hardest Part"**: One-click automatic rewind and A/B loop to your lowest-scoring segment for targeted practice.

- **🧩 Companion Chrome Extension**
  - Manifest v3 browser extension to send any active YouTube tab into FitVeda with a single click.

---

## 🏗️ Architecture & Data Flow

```text
               +----------------------------------------+
               | User Input (YouTube URL / Zoom / Gen)  |
               +-------------------+--------------------+
                                   |
              +--------------------+--------------------+
              |                                         |
    [Server Side (Node.js)]                   [Client Side (Browser)]
              |                                         |
     yt-dlp + FFmpeg stream                    Webcam Feed (User)
              |                                         |
     Range-request MP4 Server               MediaPipe Pose (WASM / TFLite)
              |                                         |
              +-------->  Dual Player  <----------------+
                               |
              +----------------+----------------+
              |                                 |
       Live Scoring Loop               Real-Time AI Coach
    (Velocity, Angles, Symmetry)       (OpenAI + Sarvam TTS)
              |                                 |
              +--------> UI & Audio Feedback <--+
```

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Server-Sent Events, Webpack)
- **UI & Styling:** [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/)
- **Vision & ML:** [MediaPipe Pose](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker) (Self-hosted WASM/TFLite)
- **Media Pipeline:** `yt-dlp`, `ffmpeg`, HTML5 Video & Canvas API
- **AI & Cloud Integrations:**
  - **OpenAI:** Coaching intelligence and post-session analysis
  - **Groq:** Fast LLM routine classification and vision scoring
  - **Sarvam AI:** Realistic multilingual voice synthesis
  - **Magic Hour / xAI Grok:** Generative exercise videos
  - **Zoom Meeting SDK:** Live class integration

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** (v18.17 or higher recommended)
- **yt-dlp** (installed and available in system PATH)
- **FFmpeg** (installed and available in system PATH)

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/fitveda.git
cd fitveda
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to create your local `.env.local`:
```bash
cp .env.example .env.local
```
Fill in the API keys as needed:
```env
# Required for AI coaching feedback & session summaries
OPENAI_API_KEY=your_openai_api_key

# Required for fast mode classification & vision scoring
GROQ_API_KEY=your_groq_api_key

# Optional: AI Exercise Video Generation
MAGICHOUR_API_KEY=your_magichour_api_key
XAI_API_KEY=your_xai_api_key

# Optional: Zoom Mode
ZOOM_SDK_KEY=your_zoom_sdk_key
ZOOM_SDK_SECRET=your_zoom_sdk_secret

# Optional: Spoken voice for coach (Sarvam AI bulbul:v3)
SARVAM_API_KEY=your_sarvam_api_key
```

### 4. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧩 Installing the Chrome Extension

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `extension/` directory inside this project.
5. Click the FitVeda extension icon on any YouTube dance or workout video to import it immediately!

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Next.js dev server on port 3000 |
| `npm run build` | Compiles the production build |
| `npm run start` | Starts the production server |
| `npm run typecheck` | Validates TypeScript types across the project |
| `npm run lint` | Runs ESLint checks |
| `npm run test` | Runs the Vitest test suite |

---

## 🔒 Privacy & Legal Notice

- **Privacy:** Webcam video frames are processed exclusively on the client device using WebAssembly and are never sent to external servers or stored.
- **YouTube Disclaimer:** Downloaded videos are intended solely for personal, ephemeral training sessions and temporary playback caching, with automatic cleanup routines.
