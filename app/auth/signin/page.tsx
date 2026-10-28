"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updatePreferences } from "../../lib/storage";

export default function SignInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Please enter a username.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        username: username.trim(),
        password: password || "fitveda123",
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid credentials. Please try again.");
      } else {
        updatePreferences({ username: username.trim() });
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen arena flex flex-col items-center justify-center p-4 text-white relative">
      <div className="w-full max-w-md bg-black/70 border border-neon-cyan/20 rounded-xl p-8 backdrop-blur-md relative z-10 shadow-[0_0_30px_rgba(0,255,255,0.15)]">
        {/* Glow corners */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neon-cyan/60" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-neon-cyan/60" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-neon-cyan/60" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neon-cyan/60" />

        <div className="text-center mb-6">
          <h1
            className="text-2xl tracking-[0.2em] uppercase neon-title mb-1"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            FITVEDA
          </h1>
          <p
            className="text-[11px] text-neon-cyan/60 tracking-[0.25em] uppercase"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            Sign In / Profile Access
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-500/50 rounded text-red-200 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="username"
              className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1"
              style={{ fontFamily: "var(--font-audiowide)" }}
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. shiva"
              required
              className="w-full bg-black/50 border border-neon-cyan/30 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-cyan transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1"
              style={{ fontFamily: "var(--font-audiowide)" }}
            >
              Password (Optional for local mode)
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-black/50 border border-neon-cyan/30 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-cyan transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-2.5 px-4 bg-neon-cyan/20 border border-neon-cyan text-neon-cyan rounded font-medium text-xs tracking-[0.2em] uppercase hover:bg-neon-cyan/30 transition-all duration-200 flex items-center justify-center gap-2"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            {loading ? "AUTHENTICATING..." : "ENTER FITVEDA"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-[10px] text-neon-cyan/40 hover:text-neon-cyan tracking-wider uppercase transition-colors"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            ← Back to Workout Arena
          </Link>
        </div>
      </div>
    </div>
  );
}
