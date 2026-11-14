// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureGlm, describeGlmConfiguration, requireGlmConfiguration, type GlmConfiguration } from "./provider";

const values = () => ({
  DOCUMENT_IMPORT_PROVIDER: "glm", DOCUMENT_IMPORT_GLM_PLATFORM: "zai-standard",
  DOCUMENT_IMPORT_GLM_API_KEY: "synthetic-test-key", DOCUMENT_IMPORT_GLM_MODEL: "synthetic-model",
  DOCUMENT_IMPORT_GLM_OCR_MODEL: "glm-ocr", DOCUMENT_IMPORT_GLM_PDF_MODE: "ocr_then_text",
  DOCUMENT_IMPORT_GLM_MAX_PAGES: "2", DOCUMENT_IMPORT_GLM_TIMEOUT_MS: "1000",
  DOCUMENT_IMPORT_GLM_MAX_INPUT_TOKENS: "1000", DOCUMENT_IMPORT_GLM_MAX_OUTPUT_TOKENS: "200",
  DOCUMENT_IMPORT_GLM_MAX_OCR_PAGES_PER_DAY: "2",
});
afterEach(() => vi.unstubAllEnvs());

describe("SDD-0473 GLM S1 explicit provider", () => {
  it("never claims account access or portal readiness from syntactically valid settings", () => {
    expect(describeGlmConfiguration(configureGlm(values()))).toEqual({ provider: "glm", platform: "zai-standard",
      configurationValid: true, accountVerified: false, readyForPortal: false, maxPages: 2 });
  });
  it("rejects Coding Plan rather than routing a portal through its endpoint", () => {
    expect(() => configureGlm({ ...values(), DOCUMENT_IMPORT_GLM_PLATFORM: "coding-plan" })).toThrow();
  });
  it("rejects BigModel and Anthropic profiles without fallback", () => {
    expect(() => configureGlm({ ...values(), DOCUMENT_IMPORT_GLM_PLATFORM: "bigmodel" })).toThrow();
    expect(() => configureGlm({ ...values(), DOCUMENT_IMPORT_PROVIDER: "anthropic" })).toThrow();
  });
  it("requires an explicit structuring model and does not inherit process env", () => {
    vi.stubEnv("DOCUMENT_IMPORT_GLM_MODEL", "inherited-model");
    expect(() => configureGlm({ ...values(), DOCUMENT_IMPORT_GLM_MODEL: "" })).toThrow();
    expect(() => configureGlm({})).toThrow();
    expect(() => configureGlm(Object.create(values()) as Record<string, string>)).toThrow();
  });
  it("does not infer key class from any prefix", () => {
    const config = configureGlm({ ...values(), DOCUMENT_IMPORT_GLM_API_KEY: "synthetic-coding-looking-prefix" });
    expect(describeGlmConfiguration(config).accountVerified).toBe(false);
  });
  it("keeps the secret out of JSON and rejects header injection without echoing it", () => {
    const config = configureGlm(values());
    expect(config.authorization()).toBe("Bearer synthetic-test-key");
    expect(JSON.stringify(config)).not.toContain("synthetic-test-key");
    try { configureGlm({ ...values(), DOCUMENT_IMPORT_GLM_API_KEY: "synthetic\r\nx-leak: value" }); }
    catch (error) { expect(String(error)).not.toContain("x-leak"); return; }
    throw new Error("Header injection was accepted");
  });
  it("rejects missing budgets and noninteger or excessive limits", () => {
    expect(() => configureGlm({ ...values(), DOCUMENT_IMPORT_GLM_MAX_INPUT_TOKENS: "" })).toThrow();
    expect(() => configureGlm({ ...values(), DOCUMENT_IMPORT_GLM_MAX_PAGES: "31" })).toThrow();
    expect(() => configureGlm({ ...values(), DOCUMENT_IMPORT_GLM_TIMEOUT_MS: "90001" })).toThrow();
    expect(() => configureGlm({ ...values(), DOCUMENT_IMPORT_GLM_MAX_OUTPUT_TOKENS: "1.5" })).toThrow();
    expect(() => configureGlm({ ...values(), DOCUMENT_IMPORT_GLM_MAX_OUTPUT_TOKENS: "0" })).toThrow();
  });
  it("rejects a per-request page ceiling above the daily allowance", () => {
    expect(() => configureGlm({ ...values(), DOCUMENT_IMPORT_GLM_MAX_OCR_PAGES_PER_DAY: "1" })).toThrow();
  });
  it("rejects budget sums beyond the existing integer quota interface", () => {
    expect(() => configureGlm({ ...values(), DOCUMENT_IMPORT_GLM_MAX_INPUT_TOKENS: "2147483647" })).toThrow();
  });
  it("requires the explicit OCR protocol and disallows silent vision/model defaults", () => {
    expect(() => configureGlm({ ...values(), DOCUMENT_IMPORT_GLM_PDF_MODE: "vision" })).toThrow();
    expect(() => configureGlm({ ...values(), DOCUMENT_IMPORT_GLM_OCR_MODEL: "" })).toThrow();
  });
  it("freezes settings and rejects forged configuration objects", () => {
    const config = configureGlm(values());
    expect(Object.isFrozen(config.settings)).toBe(true);
    expect(() => requireGlmConfiguration({ ...config } as GlmConfiguration)).toThrow();
  });
});
