// Provider chooser for LLM discovery (GCC / startup tracks).
// Prefers Groq (free, reliable) then Gemini, falling back if one is empty.
import { discover as discoverGemini, geminiConfigured } from "./gemini.mjs";
import { discoverGroq, groqConfigured } from "./groq.mjs";

export function discoveryConfigured() {
  return groqConfigured() || geminiConfigured();
}

export async function discoverAny(type, fresh = false) {
  if (groqConfigured()) {
    const g = await discoverGroq(type, fresh);
    if (g.listings?.length) return g;
    // Groq empty/errored — try Gemini if it's set, else return Groq's result.
    if (geminiConfigured()) {
      const gem = await discoverGemini(type, fresh);
      if (gem.listings?.length) return gem;
      return g.error ? g : gem;
    }
    return g;
  }
  if (geminiConfigured()) return discoverGemini(type, fresh);
  return { configured: false, listings: [] };
}
