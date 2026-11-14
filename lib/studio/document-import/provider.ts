import "server-only";
import { EXTRACTION_LIMITS, fail } from "./extraction-contract";

export type GlmSettings = Readonly<{
  provider: "glm"; platform: "zai-standard"; model: string; ocrModel: "glm-ocr"; pdfMode: "ocr_then_text";
  maxPages: number; timeoutMs: number; maxInputTokens: number; maxOutputTokens: number; maxOcrPagesPerDay: number;
}>;
export type GlmConfiguration = Readonly<{ settings: GlmSettings; authorization: () => string }>;
const configurations = new WeakSet<object>();

/** Explicit inputs only. No process.env, filesystem, key-prefix inference or provider fallback. */
export function configureGlm(values: Readonly<Record<string, string | undefined>>): GlmConfiguration {
  const required = (name: string) => {
    if (!values || !Object.hasOwn(values, name)) return fail("configuration_missing");
    const value = values[name];
    if (typeof value !== "string" || !value.trim()) return fail("configuration_missing");
    if (value !== value.trim()) return fail("configuration_invalid");
    return value;
  };
  if (required("DOCUMENT_IMPORT_PROVIDER") !== "glm"
    || required("DOCUMENT_IMPORT_GLM_PLATFORM") !== "zai-standard"
    || required("DOCUMENT_IMPORT_GLM_OCR_MODEL") !== "glm-ocr"
    || required("DOCUMENT_IMPORT_GLM_PDF_MODE") !== "ocr_then_text") fail("configuration_invalid");
  const apiKey = required("DOCUMENT_IMPORT_GLM_API_KEY");
  const model = required("DOCUMENT_IMPORT_GLM_MODEL");
  // Syntax only: neither a declaration nor a prefix certifies Standard account/model access.
  if (!/^[\x21-\x7e]{1,4096}$/.test(apiKey) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(model)) fail("configuration_invalid");
  const integer = (name: string, max = 2_147_483_647) => {
    const value = required(name);
    if (!/^[1-9][0-9]{0,9}$/.test(value) || Number(value) > max) return fail("configuration_invalid");
    return Number(value);
  };
  const settings: GlmSettings = Object.freeze({
    provider: "glm", platform: "zai-standard", model, ocrModel: "glm-ocr", pdfMode: "ocr_then_text",
    maxPages: integer("DOCUMENT_IMPORT_GLM_MAX_PAGES", EXTRACTION_LIMITS.pages),
    timeoutMs: integer("DOCUMENT_IMPORT_GLM_TIMEOUT_MS", 90_000),
    maxInputTokens: integer("DOCUMENT_IMPORT_GLM_MAX_INPUT_TOKENS"),
    maxOutputTokens: integer("DOCUMENT_IMPORT_GLM_MAX_OUTPUT_TOKENS"),
    maxOcrPagesPerDay: integer("DOCUMENT_IMPORT_GLM_MAX_OCR_PAGES_PER_DAY"),
  });
  if (settings.maxInputTokens + settings.maxOutputTokens > 2_147_483_647
    || settings.maxPages > settings.maxOcrPagesPerDay) fail("configuration_invalid");
  // The secret lives only in a closure; serializing configuration never serializes its value.
  const config = Object.freeze({ settings, authorization: () => `Bearer ${apiKey}` });
  configurations.add(config);
  return config;
}

export function requireGlmConfiguration(config: GlmConfiguration): void {
  if (!config || !configurations.has(config)) fail("configuration_invalid");
}

/** This reports syntax, not usable credentials, enabled models or a ready portal capability. */
export function describeGlmConfiguration(config: GlmConfiguration) {
  requireGlmConfiguration(config);
  return Object.freeze({ provider: "glm" as const, platform: "zai-standard" as const,
    configurationValid: true, accountVerified: false, readyForPortal: false,
    maxPages: config.settings.maxPages });
}
