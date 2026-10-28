"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getPreferences } from "../lib/storage";

export default function AppNavigation() {
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const prefs = getPreferences();
    if (prefs.username) setUsername(prefs.username);
  }, [pathname]);

  const navItems = [
    { label: "ARENA", href: "/", icon: "🏟️" },
    { label: "DIET PLANNER", href: "/diet", icon: "🥗" },
    { label: "EXERCISE PLANNER", href: "/exercise", icon: "💪" },
    { label: "DASHBOARD", href: "/dashboard", icon: "📊" },
  ];

  return (
    <nav className="w-full bg-black/80 border-b border-neon-cyan/15 backdrop-blur-md px-4 py-2 flex flex-wrap items-center justify-between gap-3 relative z-40">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 group">
          <span
            className="text-lg font-bold tracking-[0.2em] uppercase neon-title group-hover:drop-shadow-[0_0_8px_#ff00aa] transition-all"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            FITVEDA
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded border border-neon-cyan/30 text-neon-cyan/80 tracking-widest uppercase">
            AI FITNESS
          </span>
        </Link>
      </div>

      {/* Nav Links */}
      <div className="flex items-center gap-1 sm:gap-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/" || pathname === "/arena"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded text-[10px] tracking-[0.18em] uppercase transition-all duration-200 flex items-center gap-1.5 border ${
                isActive
                  ? "border-neon-cyan text-neon-cyan bg-neon-cyan/15 shadow-[0_0_12px_rgba(0,255,255,0.25)] font-semibold"
                  : "border-transparent text-white/60 hover:text-white hover:border-white/20 hover:bg-white/5"
              }`}
              style={{ fontFamily: "var(--font-audiowide)" }}
            >
              <span className="text-xs">{item.icon}</span>
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Account / User info */}
      <div className="flex items-center gap-2">
        {username ? (
          <Link
            href="/profile"
            className="text-[10px] tracking-wider uppercase text-neon-cyan/80 hover:text-neon-cyan border border-neon-cyan/30 px-2.5 py-1 rounded bg-black/40 hover:bg-neon-cyan/10 transition-colors flex items-center gap-1"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            <span>👤</span>
            <span className="hidden sm:inline">{username}</span>
          </Link>
        ) : (
          <Link
            href="/auth/signin"
            className="text-[10px] tracking-wider uppercase text-neon-cyan/70 hover:text-neon-cyan border border-neon-cyan/20 px-2.5 py-1 rounded bg-black/40 hover:bg-neon-cyan/10 transition-colors"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            SIGN IN
          </Link>
        )}
      </div>
    </nav>
  );
}
