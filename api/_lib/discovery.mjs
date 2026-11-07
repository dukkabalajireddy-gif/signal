// Discovery provider for the GCC / startup tracks. Groq only — Gemini was
// removed (its free-tier quota was exhausted and Groq fully covers discovery).
import { discoverGroq, groqConfigured } from "./groq.mjs";

export function discoveryConfigured() {
  return groqConfigured();
}

export async function discoverAny(type, fresh = false) {
  if (groqConfigured()) return discoverGroq(type, fresh);
  return { configured: false, listings: [] };
}
