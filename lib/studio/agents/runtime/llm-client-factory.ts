/**
 * Factory para LLMClient (SDD-0020 Fase 2D.2).
 *
 * Decide qué cliente usar según env:
 *  - ANTHROPIC_API_KEY presente → AnthropicLLMClient (real, gasta tokens)
 *  - Sin key → MockLLMClient (determinístico, sin gastar)
 *  - LLM_FORCE_MOCK=1 → fuerza mock aunque haya key (útil para desarrollo)
 *
 * Loggea cuál usa al primer instance — visible en server logs.
 */

import { AnthropicLLMClient } from "./llm-client-anthropic";
import { MockLLMClient } from "./llm-client-mock";
import type { LLMClient } from "./types";

let cachedClient: LLMClient | null = null;
let lastMode: "anthropic" | "mock" | null = null;

export function createLLMClient(): LLMClient {
  const forceMock = process.env.LLM_FORCE_MOCK === "1";
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  const wantMode: "anthropic" | "mock" =
    !forceMock && hasKey ? "anthropic" : "mock";

  if (cachedClient && lastMode === wantMode) return cachedClient;

  if (wantMode === "anthropic") {
    cachedClient = new AnthropicLLMClient();
    if (lastMode !== "anthropic") {
      console.log(
        "[agents/runtime] LLM client: Anthropic (real). Cost se carga a spend_usd_mtd del agent.",
      );
    }
  } else {
    cachedClient = new MockLLMClient();
    if (lastMode !== "mock") {
      console.log(
        forceMock
          ? "[agents/runtime] LLM client: Mock (LLM_FORCE_MOCK=1 set)."
          : "[agents/runtime] LLM client: Mock (ANTHROPIC_API_KEY no configurada).",
      );
    }
  }
  lastMode = wantMode;
  return cachedClient;
}
