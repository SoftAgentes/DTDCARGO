// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTestGlmConfiguration, GlmTestConfigurationError, TEST_INPUTS, admitTestInput, createGlmTestRuntime } from "./glm-test-runtime";
afterEach(() => vi.unstubAllGlobals());
describe("S3 backend-only GLM configuration", () => {
  it("rejects a different output/root before reading any credential or metadata",async()=>{
    const reader=vi.fn();await expect(createGlmTestRuntime({canonicalRoot:"C:/tmp/not-authority",goId:"synthetic-go-01",workspaceIds:{pdf:"p",xlsx:"x"}},{readCredential:reader})).rejects.toBeInstanceOf(GlmTestConfigurationError);
    expect(reader).not.toHaveBeenCalled();
  });
  it.each([0,4854,4855,4856])("rejects unadmitted or altered PDF bytes of length %s without a parser or network",size=>{
    expect(()=>admitTestInput(new Uint8Array(size),"synthetic.pdf")).toThrow(GlmTestConfigurationError);
  });
  it("reads only the explicit private destination with an injected synthetic reader, never env or network", async () => {
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden"); }));
    const reader = vi.fn(async () => new TextEncoder().encode("DOCUMENT_IMPORT_GLM_API_KEY=synthetic-private-value\nDOCUMENT_IMPORT_GLM_MODEL=\nIGNORED=unrelated\n"));
    const config = await loadTestGlmConfiguration(reader);
    expect(reader).toHaveBeenCalledTimes(1); expect(reader).toHaveBeenCalledWith("C:/Users/AKX generator/.config/dtdcargo/document-import-glm.test.env");
    expect(config.settings).toMatchObject({ model: "glm-4.6", platform: "zai-standard", maxPages: 2, maxInputTokens: 16384, maxOutputTokens: 8192 });
    expect(JSON.stringify(config)).not.toMatch(/synthetic-private-value|IGNORED|unrelated/); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["", "DOCUMENT_IMPORT_GLM_MODEL=glm-4.6", "DOCUMENT_IMPORT_GLM_API_KEY=synthetic\nDOCUMENT_IMPORT_GLM_MODEL=another-model", "DOCUMENT_IMPORT_GLM_API_KEY=one\nDOCUMENT_IMPORT_GLM_API_KEY=two"])("rejects missing or incompatible configuration safely", async text => {
    await expect(loadTestGlmConfiguration(async () => new TextEncoder().encode(text))).rejects.toBeInstanceOf(GlmTestConfigurationError);
  });
  it("does not expose reader exception text or read a second destination", async () => {
    const reader = vi.fn(async () => { throw new Error("PRIVATE credential payload and location"); });
    try { await loadTestGlmConfiguration(reader); expect.fail("Expected safe error"); } catch (error) { expect(String(error)).not.toMatch(/PRIVATE|payload|location/); }
    expect(reader).toHaveBeenCalledTimes(1);
  });
  it("pins separate PDF and XLSX inputs without embedding business answers", () => {
    expect(TEST_INPUTS.pdf).toEqual({ bytes: 4855, sha256: "7fada57b5d00093c5f3950e36de7812226b675a2fc1547d234ca3c790b170b2e" });
    expect(TEST_INPUTS.xlsx.bytes).toBe(8178); expect(TEST_INPUTS.xlsx.sha256).not.toBe(TEST_INPUTS.pdf.sha256);
    expect(JSON.stringify(TEST_INPUTS)).not.toMatch(/cartons|netWeight|grossWeight|amount|cbm|observations/);
  });
});
