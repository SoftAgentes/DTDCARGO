// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  redactConsoleEntry,
  redactHeaders,
  redactNetworkEntry,
  redactTokensInText,
  redactUrl,
} from "../../lib/studio/bug-sanitizer";

// SDD-0452: todos los valores son inventados. Nunca pegar credenciales reales.
// Se importa producción; la antigua inline duplicaba y divergía del sanitizer.
const REDACTED = "[REDACTED]";

describe("vectores históricos de la inline (7 P1 + 7 adicionales)", () => {
  const cases = [
    { name: "P1#1 Stripe sk_live", input: "API call with sk_live_abcdefghijklmnopqrstuvwx in headers", fn: redactTokensInText, absent: "sk_live_abc" },
    { name: "P1#2 JWT en path", input: "/api/auth/jwt/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxxxxxxxxx.yyyyyyyyyyyyy/callback", fn: redactUrl, absent: "eyJhbG" },
    { name: "P1#3 Hash access_token", input: "https://x.com/callback#access_token=abc123&refresh_token=def456", fn: redactUrl, absent: "abc123" },
    { name: "P1#4 Basic auth", input: "https://user:password@host.com/api", fn: redactUrl, absent: "password" },
    { name: "P1#5 Query en console msg", input: "failed /api/login?token=abc1234567890&other=ok", fn: redactTokensInText, absent: "abc1234567890" },
    { name: "P1#6 Custom prefix _live_", input: "dt_live_1234567890abcdefghijklmnopqrstuv", fn: redactTokensInText, absent: "dt_live_123" },
    { name: "P1#7 URL-encoded key", input: "https://x.com/cb?%74oken=abc1234567890", fn: redactUrl, absent: "abc1234567890" },
    { name: "URL absoluta inline (sin recursión)", input: "Error: failed POST https://api.x.com/auth?token=abc1234567890 returned 401", fn: redactTokensInText, absent: "abc1234567890" },
    { name: "Sanity URL normal", input: "https://api.x.com/users?limit=10&offset=0", fn: redactUrl, present: "limit=10" },
    { name: "Sanity texto normal", input: "Hello world", fn: redactTokensInText, equal: "Hello world" },
    { name: "Sanity JWT en texto", input: "token eyJabc1234567890123456.eyJ12345678901.signaturexxxxxxxxxx leaked", fn: redactTokensInText, absent: "eyJabc1234" },
    { name: "Sanity GitHub clásico", input: "ghp_abcdefghijklmnopqrstuvwxyz1234567890ABCD", fn: redactTokensInText, absent: "ghp_abc" },
    { name: "Sanity AWS ejemplo público", input: "AKIAIOSFODNN7EXAMPLE", fn: redactTokensInText, absent: "AKIAIOSF" },
    { name: "Sanity Bearer", input: "Authorization: Bearer 1234567890abcdef1234567890", fn: redactTokensInText, absent: "1234567890abcdef" },
  ];
  it.each(cases)("$name", ({ input, fn, absent, present, equal }) => {
    const result = fn(input);
    if (absent) expect(result).not.toContain(absent);
    if (present) expect(result).toContain(present);
    if (equal) expect(result).toBe(equal);
  });
});

// Fuentes y umbrales documentados en SDD-0452. Los prefijos son reales;
// los cuerpos FAKEONLY son deliberadamente falsos y no se usan contra APIs.
const fakeBody = "FAKEONLY".repeat(4);
const currentFormats = [
  { name: "Supabase secret base64url con guion final", token: `sb_secret_${fakeBody}_-` },
  { name: "Supabase publishable base64url con underscore final", token: `sb_publishable_${fakeBody}-_` },
  { name: "GitHub PAT fino", token: `github_pat_${"FAKEONLY".repeat(3)}_${"FAKEONLY".repeat(8)}` },
  { name: "GitHub instalación JWT", token: `ghs_00000_eyJ${fakeBody}.${fakeBody}.${fakeBody}` },
  { name: "Stripe organización", token: `sk_org_${fakeBody}` },
  { name: "Stripe firma webhook", token: `whsec_${fakeBody}` },
  { name: "Slack app", token: `xapp-1-${fakeBody}` },
  { name: "Slack workflow", token: `xwfp-${fakeBody}` },
  { name: "Slack refresh", token: `xoxe-1-${fakeBody}` },
  { name: "Slack bot rotado", token: `xoxe.xoxb-${fakeBody}` },
  { name: "Slack usuario rotado", token: `xoxe.xoxp-${fakeBody}` },
  { name: "AWS acceso temporal STS", token: `ASIA${"FAKEONLY".repeat(2)}` },
];

describe.each(currentFormats)("formato actual: $name", ({ token }) => {
  it("redacta texto suelto completo y conserva puntuación", () => {
    expect(redactTokensInText(token)).toBe(REDACTED);
    expect(redactTokensInText(`Falló (${token}), reintento pendiente.`))
      .toBe(`Falló (${REDACTED}), reintento pendiente.`);
  });
  it("redacta repeticiones sin estado entre llamadas y es idempotente", () => {
    const input = `${token} | ${token}`;
    const output = `${REDACTED} | ${REDACTED}`;
    expect(redactTokensInText(input)).toBe(output);
    expect(redactTokensInText(input)).toBe(output);
    expect(redactTokensInText(output)).toBe(output);
  });
  it("redacta consola y stack sin mutar la entrada ni borrar contexto", () => {
    const entry = Object.freeze({ level: "error", message: `Fallo ${token}`, stack: `Error ${token}\n at report.ts:12:3`, ts: "2026-09-10T00:00:00Z" });
    expect(redactConsoleEntry(entry)).toEqual({ ...entry, message: `Fallo ${REDACTED}`, stack: `Error ${REDACTED}\n at report.ts:12:3` });
    expect(entry.message).toBe(`Fallo ${token}`);
  });
  it("redacta paths y headers no sensibles con token incidental", () => {
    const entry = Object.freeze({ url: `https://example.invalid/debug/${token}?limit=10`, method: "GET", status: 401, ms: 25 });
    expect(redactNetworkEntry(entry)).toEqual({ ...entry, url: `https://example.invalid/debug/${REDACTED}?limit=10` });
    expect(redactHeaders({ "x-debug": `Fallo ${token}`, "content-type": "application/json" }))
      .toEqual({ "x-debug": `Fallo ${REDACTED}`, "content-type": "application/json" });
  });
});

describe("cabecera apikey ya soportada", () => {
  it("redacta Record sin depender del formato ni longitud del valor", () => {
    expect(redactHeaders({ apikey: "fake", ApiKey: "fake", APIKEY: "fake", "content-type": "application/json" }))
      .toEqual({ apikey: REDACTED, ApiKey: REDACTED, APIKEY: REDACTED, "content-type": "application/json" });
  });
  it("redacta tuplas y Headers nativos", () => {
    expect(redactHeaders([["APIKEY", "fake"]])).toEqual({ APIKEY: REDACTED });
    expect(redactHeaders(new Headers({ apikey: "fake" }))).toEqual({ apikey: REDACTED });
  });
});

describe("lectura del bug: negativos de los patrones nuevos", () => {
  it.each([
    "GET /api/orders 503 en 125 ms; TypeError en report.ts:12:3",
    "Prefijos: sb_secret_… sb_publishable_… github_pat_… ghs_… sk_org_… whsec_… xapp-… xwfp-… xoxe-…",
    "sb_secret_configuration_error sb_publishable_config github_pat_permissions sk_org_settings",
    "xapp-connection-error xwfp-step-failed xoxe-refresh-error",
    `my_sb_secret_${fakeBody} my_github_pat_${fakeBody} my_whsec_${fakeBody}`,
    "sb_secret_short sb_publishable_short github_pat_short whsec_short sk_org_short",
    `SB_SECRET_${fakeBody} SB_PUBLISHABLE_${fakeBody} GITHUB_PAT_${fakeBody}`,
    `pi_${fakeBody} acct_${fakeBody} evt_${fakeBody} rk_org_${fakeBody}`,
    "https://example.invalid/docs/sb_secret_setup",
  ])("conserva %s", (input) => {
    expect(redactTokensInText(input)).toBe(input);
  });
  it("conserva URLs con query normal en la API de URLs", () => {
    const url = "https://example.invalid/docs/sb_secret_setup?limit=10&offset=0";
    expect(redactUrl(url)).toBe(url);
  });
});

describe("otras familias previamente soportadas", () => {
  it.each([
    `sk_live_${fakeBody}`, `sk_test_${fakeBody}`, `pk_live_${fakeBody}`,
    `pk_test_${fakeBody}`, `rk_live_${fakeBody}`, `rk_test_${fakeBody}`,
    `ghp_${fakeBody}`, `gho_${fakeBody}`, `ghu_${fakeBody}`, `ghs_${fakeBody}`,
    `ghr_${fakeBody}`, `xoxb-${fakeBody}`, `xoxp-${fakeBody}`,
    `sk-proj-${fakeBody}`, `sk-ant-${fakeBody}`, `sk-${fakeBody}`,
    `Basic ${fakeBody}`, `aws_secret_access_key=${"FAKEONLY".repeat(5)}`,
  ])("conserva redacción de %s", (input) => {
    expect(redactTokensInText(input)).toBe(REDACTED);
  });
});
