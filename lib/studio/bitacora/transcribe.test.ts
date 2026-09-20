// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { transcribeAudio, transcriptionConfigured } from "./transcribe";
import {
  audioContentTypeForExt,
  audioExtFromFile,
  audioExtFromMime,
  buildMeetingAudioPath,
  isValidMeetingAudioPath,
} from "./storage";

// SDD-0146 Fase 3 · transcripción (CF Whisper) + validación de path del audio.
// Sin red real: `fetch` se mockea. Sin tokens de CF: fail-closed.

const TENANT = "11111111-1111-1111-1111-111111111111";
const MEETING = "22222222-2222-2222-2222-222222222222";
const FILE = "33333333-3333-3333-3333-333333333333";

// ─── transcriptionConfigured (fail-closed) ───────────────────

describe("transcriptionConfigured", () => {
  const prevAcc = process.env.CLOUDFLARE_ACCOUNT_ID;
  const prevTok = process.env.CLOUDFLARE_API_TOKEN;
  afterEach(() => {
    if (prevAcc === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID;
    else process.env.CLOUDFLARE_ACCOUNT_ID = prevAcc;
    if (prevTok === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
    else process.env.CLOUDFLARE_API_TOKEN = prevTok;
  });

  it("false sin ninguna env", () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    expect(transcriptionConfigured()).toBe(false);
  });

  it("false si falta una de las dos", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc";
    delete process.env.CLOUDFLARE_API_TOKEN;
    expect(transcriptionConfigured()).toBe(false);
  });

  it("true con las dos", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc";
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    expect(transcriptionConfigured()).toBe(true);
  });
});

// ─── Validación del path del audio ───────────────────────────

describe("isValidMeetingAudioPath", () => {
  it("acepta el shape correcto para webm/mp4/m4a", () => {
    for (const ext of ["webm", "mp4", "m4a"] as const) {
      const p = `${TENANT}/bitacora_meeting/${MEETING}/${FILE}.${ext}`;
      expect(isValidMeetingAudioPath(p, TENANT)).toBe(true);
    }
  });

  it("build + valida ida y vuelta", () => {
    const p = buildMeetingAudioPath({
      tenantId: TENANT,
      meetingId: MEETING,
      uuid: FILE,
      ext: "mp4",
    });
    expect(isValidMeetingAudioPath(p, TENANT)).toBe(true);
  });

  it("rechaza otro tenant", () => {
    const other = "99999999-9999-9999-9999-999999999999";
    const p = `${other}/bitacora_meeting/${MEETING}/${FILE}.webm`;
    expect(isValidMeetingAudioPath(p, TENANT)).toBe(false);
  });

  it("rechaza '..' (traversal)", () => {
    expect(
      isValidMeetingAudioPath(
        `${TENANT}/bitacora_meeting/../${FILE}.webm`,
        TENANT,
      ),
    ).toBe(false);
    expect(
      isValidMeetingAudioPath(`${TENANT}/../otro/x.webm`, TENANT),
    ).toBe(false);
  });

  it("rechaza extensión no permitida (mp3/wav/ogg)", () => {
    for (const ext of ["mp3", "wav", "ogg", "txt"]) {
      const p = `${TENANT}/bitacora_meeting/${MEETING}/${FILE}.${ext}`;
      expect(isValidMeetingAudioPath(p, TENANT)).toBe(false);
    }
  });

  it("rechaza carpeta equivocada (bitacora_task)", () => {
    const p = `${TENANT}/bitacora_task/${MEETING}/${FILE}.webm`;
    expect(isValidMeetingAudioPath(p, TENANT)).toBe(false);
  });

  it("rechaza segmento vacío o no-uuid", () => {
    expect(
      isValidMeetingAudioPath(
        `${TENANT}/bitacora_meeting//${FILE}.webm`,
        TENANT,
      ),
    ).toBe(false);
    expect(
      isValidMeetingAudioPath(
        `${TENANT}/bitacora_meeting/not-a-uuid/${FILE}.webm`,
        TENANT,
      ),
    ).toBe(false);
  });

  it("rechaza no-string y tenant mal formado", () => {
    expect(isValidMeetingAudioPath(null, TENANT)).toBe(false);
    expect(isValidMeetingAudioPath(undefined, TENANT)).toBe(false);
    expect(isValidMeetingAudioPath(123, TENANT)).toBe(false);
    expect(
      isValidMeetingAudioPath(
        `${TENANT}/bitacora_meeting/${MEETING}/${FILE}.webm`,
        "no-es-un-tenant",
      ),
    ).toBe(false);
  });

  it("rechaza sufijo/prefijo extra (regex anclado)", () => {
    expect(
      isValidMeetingAudioPath(
        `${TENANT}/bitacora_meeting/${MEETING}/${FILE}.webm/extra`,
        TENANT,
      ),
    ).toBe(false);
    expect(
      isValidMeetingAudioPath(
        `x/${TENANT}/bitacora_meeting/${MEETING}/${FILE}.webm`,
        TENANT,
      ),
    ).toBe(false);
  });
});

// ─── Derivación de extensión (iOS = mp4, nunca hardcodear webm) ─

describe("audioExtFromMime / audioExtFromFile", () => {
  it("webm (Chrome/Android)", () => {
    expect(audioExtFromMime("audio/webm;codecs=opus")).toBe("webm");
    expect(audioExtFromMime("audio/webm")).toBe("webm");
  });

  it("mp4 (iOS Safari graba mp4, NO webm)", () => {
    expect(audioExtFromMime("audio/mp4")).toBe("mp4");
    expect(audioExtFromMime("audio/mp4;codecs=mp4a.40.2")).toBe("mp4");
  });

  it("m4a → ext m4a, se sube como audio/mp4 (mime del bucket)", () => {
    expect(audioExtFromMime("audio/x-m4a")).toBe("m4a");
    expect(audioExtFromMime("audio/m4a")).toBe("m4a");
    expect(audioContentTypeForExt("m4a")).toBe("audio/mp4");
    expect(audioContentTypeForExt("mp4")).toBe("audio/mp4");
    expect(audioContentTypeForExt("webm")).toBe("audio/webm");
  });

  it("formato no soportado → null", () => {
    expect(audioExtFromMime("audio/mpeg")).toBe(null);
    expect(audioExtFromMime("audio/ogg")).toBe(null);
    expect(audioExtFromMime("")).toBe(null);
    expect(audioExtFromMime(undefined)).toBe(null);
  });

  it("File: cae al nombre si el mimeType está vacío", () => {
    expect(audioExtFromFile({ type: "", name: "reunion.m4a" })).toBe("m4a");
    expect(audioExtFromFile({ type: "", name: "clip.webm" })).toBe("webm");
    expect(audioExtFromFile({ type: "audio/mp4", name: "x.bin" })).toBe("mp4");
    expect(audioExtFromFile({ type: "", name: "voz.mp3" })).toBe(null);
  });
});

// ─── transcribeAudio (mock de fetch, sin red) ────────────────

type ReqInit = { headers: Record<string, string>; body: string };

function fakeResponse(opts: {
  ok: boolean;
  status: number;
  body?: unknown;
  text?: string;
}) {
  return {
    ok: opts.ok,
    status: opts.status,
    json: async () => opts.body ?? {},
    text: async () => opts.text ?? "",
  };
}

function makeBytes(): ArrayBuffer {
  return new Uint8Array([1, 2, 3, 4, 5]).buffer;
}

describe("transcribeAudio", () => {
  const prevAcc = process.env.CLOUDFLARE_ACCOUNT_ID;
  const prevTok = process.env.CLOUDFLARE_API_TOKEN;
  const prevModel = process.env.CF_WHISPER_MODEL;

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc123";
    process.env.CLOUDFLARE_API_TOKEN = "tok123";
    delete process.env.CF_WHISPER_MODEL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (prevAcc === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID;
    else process.env.CLOUDFLARE_ACCOUNT_ID = prevAcc;
    if (prevTok === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
    else process.env.CLOUDFLARE_API_TOKEN = prevTok;
    if (prevModel === undefined) delete process.env.CF_WHISPER_MODEL;
    else process.env.CF_WHISPER_MODEL = prevModel;
  });

  it("parsea result.text, arma la URL y el body correctos", async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse({
        ok: true,
        status: 200,
        body: { result: { text: "  Hola equipo, esto es una prueba.  " } },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const out = await transcribeAudio(makeBytes());
    expect(out).toBe("Hola equipo, esto es una prueba."); // trim del texto

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, ReqInit];
    expect(String(url)).toContain(
      "/accounts/acc123/ai/run/@cf/openai/whisper-large-v3-turbo",
    );
    expect(init.headers.Authorization).toBe("Bearer tok123");
    const body = JSON.parse(init.body) as {
      language?: string;
      task?: string;
      audio?: string;
    };
    expect(body.language).toBe("es");
    expect(body.task).toBe("transcribe");
    expect(typeof body.audio).toBe("string");
    expect((body.audio ?? "").length).toBeGreaterThan(0); // base64 del audio
  });

  it("respeta CF_WHISPER_MODEL override", async () => {
    process.env.CF_WHISPER_MODEL = "@cf/custom/whisper";
    const fetchMock = vi.fn(async () =>
      fakeResponse({ ok: true, status: 200, body: { result: { text: "ok" } } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await transcribeAudio(makeBytes());
    const [url] = fetchMock.mock.calls[0] as unknown as [string, ReqInit];
    expect(String(url)).toContain("@cf/custom/whisper");
  });

  it("CF !ok → throw con mensaje truncado ≤200", async () => {
    const huge = "x".repeat(500);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fakeResponse({ ok: false, status: 500, text: huge })),
    );
    let caught: unknown;
    try {
      await transcribeAudio(makeBytes());
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message.length).toBeLessThanOrEqual(200);
    expect((caught as Error).message).toContain("500");
  });

  it("respuesta sin result.text → throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fakeResponse({ ok: true, status: 200, body: { result: {} } })),
    );
    await expect(transcribeAudio(makeBytes())).rejects.toThrow();
  });

  it("fetch lanza (red caída) → throw truncado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    await expect(transcribeAudio(makeBytes())).rejects.toThrow(/Cloudflare/i);
  });

  it("sin env → throw 'no configurada' (no pega a CF)", async () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(transcribeAudio(makeBytes())).rejects.toThrow(/no configurada/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
