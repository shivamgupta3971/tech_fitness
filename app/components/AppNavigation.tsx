"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePreferences } from "../lib/useAppData";

const NAV_ITEMS = [
  { label: "ARENA", href: "/", icon: "🏟️" },
  { label: "DIET PLANNER", href: "/diet", icon: "🥗" },
  { label: "EXERCISE PLANNER", href: "/exercise", icon: "💪" },
  { label: "DASHBOARD", href: "/dashboard", icon: "📊" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" || pathname === "/arena" : pathname.startsWith(href);
}

/**
 * Fixed height (`--nav-h`, see globals.css) and a single row at every width: the Arena sizes itself to
 * "viewport minus nav", so a nav that wrapped onto a second line would push the Arena's coach panel off-screen.
 */
export default function AppNavigation() {
  const pathname = usePathname();
  const { username } = usePreferences();

  return (
    <nav
      aria-label="Primary"
      className="w-full h-(--nav-h) shrink-0 bg-black/80 border-b border-neon-cyan/15 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between gap-2 relative z-40"
    >
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2 group shrink-0">
        <span
          className="text-base sm:text-lg font-bold tracking-[0.2em] uppercase neon-title group-hover:drop-shadow-[0_0_8px_#ff00aa] transition-all"
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          FITVEDA
        </span>
        <span className="hidden lg:inline text-[9px] px-1.5 py-0.5 rounded border border-neon-cyan/30 text-neon-cyan/80 tracking-widest uppercase">
          AI FITNESS
        </span>
      </Link>

      {/* Nav Links */}
      <div className="flex items-center gap-0.5 sm:gap-2 min-w-0">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`px-2.5 sm:px-3 py-1.5 rounded text-[10px] tracking-[0.18em] uppercase transition-all duration-200 flex items-center gap-1.5 border ${
                active
                  ? "border-neon-cyan text-neon-cyan bg-neon-cyan/15 shadow-[0_0_12px_rgba(0,255,255,0.25)] font-semibold"
                  : "border-transparent text-white/60 hover:text-white hover:border-white/20 hover:bg-white/5"
              }`}
              style={{ fontFamily: "var(--font-audiowide)" }}
            >
              <span className="text-xs" aria-hidden="true">{item.icon}</span>
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Account / User info */}
      <div className="flex items-center gap-2 shrink-0">
        {username ? (
          <Link
            href="/profile"
            aria-label={`Profile: ${username}`}
            className="text-[10px] tracking-wider uppercase text-neon-cyan/80 hover:text-neon-cyan border border-neon-cyan/30 px-2.5 py-1 rounded bg-black/40 hover:bg-neon-cyan/10 transition-colors flex items-center gap-1"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            <span aria-hidden="true">👤</span>
            <span className="hidden sm:inline max-w-32 truncate">{username}</span>
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
