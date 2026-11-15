/**
 * Tolerant JSON extraction for LLM replies. Models sometimes wrap JSON in code fences or prose, or leave
 * trailing commas. Returns null instead of throwing so callers can fall back deterministically.
 */
export function parseLooseJson(text: string | null | undefined): unknown | null {
  if (!text) return null;

  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  const candidate = stripped.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    // Retry once with trailing commas removed — the most common model slip.
    try {
      return JSON.parse(candidate.replace(/,(\s*[}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}
