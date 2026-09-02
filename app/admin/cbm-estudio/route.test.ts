import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const SECRET = "credencial-interna-de-prueba";
const URL = "https://dtdcargo.com/admin/cbm-estudio";
const IP = "203.0.113.27";

const throttle = vi.hoisted(() => ({
  clientError: false,
  insertError: null as { code: string; message: string } | null,
  occupiedIds: new Set<string>(),
  insertAttempts: [] as Array<{ id: string; ip: string }>,
  insertedRows: [] as Array<{ id: string; ip: string }>,
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    if (throttle.clientError) throw new Error("admin unavailable");
    return {
      from: (table: string) => {
        if (table !== "portal_registro_throttle") {
          throw new Error(`tabla inesperada: ${table}`);
        }
        return {
          insert: async (row: { id: string; ip: string }) => {
            throttle.insertAttempts.push(row);
            if (throttle.insertError) return { error: throttle.insertError };
            if (throttle.occupiedIds.has(row.id)) {
              return { error: { code: "23505", message: "duplicate key" } };
            }
            throttle.occupiedIds.add(row.id);
            throttle.insertedRows.push(row);
            return { error: null };
          },
        };
      },
    };
  },
}));

function postRequest(token: string, ip = IP): NextRequest {
  return new NextRequest(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-forwarded-for": ip,
    },
    body: new URLSearchParams({ token }),
  });
}

describe("/admin/cbm-estudio · sesión sin secreto en URL", () => {
  beforeEach(() => {
    process.env.CBM_ESTUDIO_TOKEN = SECRET;
    throttle.clientError = false;
    throttle.insertError = null;
    throttle.occupiedIds = new Set<string>();
    throttle.insertAttempts = [];
    throttle.insertedRows = [];
  });

  afterEach(() => {
    delete process.env.CBM_ESTUDIO_TOKEN;
    vi.useRealTimers();
  });

  it("limpia un token legacy de la URL sin usarlo como autenticación", async () => {
    const response = await GET(new NextRequest(`${URL}?token=${SECRET}`));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(URL);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rechaza GET sin sesión y nunca refleja la credencial", async () => {
    const response = await GET(new NextRequest(URL));
    const body = await response.text();

    expect(response.status).toBe(401);
    expect(body).toContain('method="post"');
    expect(body).not.toContain(SECRET);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("rechaza credencial inválida sin acuñar cookie", async () => {
    const response = await POST(postRequest("incorrecta"));

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).not.toContain("incorrecta");
    const expectedHash = createHash("sha256").update(IP).digest("hex");
    expect(throttle.insertedRows).toHaveLength(1);
    expect(throttle.insertedRows[0]).toMatchObject({
      ip: `cbm-estudio:${expectedHash}`,
    });
    expect(throttle.insertedRows[0].ip).not.toContain(IP);
  });

  it("admite sólo cinco intentos aun cuando seis llegan en paralelo", async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => POST(postRequest("incorrecta"))),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([
      401, 401, 401, 401, 401, 429,
    ]);
    const limited = responses.find((response) => response.status === 429);
    expect(limited?.headers.get("retry-after")).toBe("900");
    expect(limited?.headers.get("set-cookie")).toBeNull();
    expect(await limited?.text()).not.toContain("<form");
    expect(throttle.insertedRows).toHaveLength(5);
  });

  it("habilita cinco slots nuevos al comenzar la ventana siguiente", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T10:00:00-04:00"));
    const firstWindow = await Promise.all(
      Array.from({ length: 6 }, () => POST(postRequest("incorrecta"))),
    );
    expect(
      firstWindow.filter((response) => response.status === 429),
    ).toHaveLength(1);

    vi.advanceTimersByTime(15 * 60 * 1000);
    const nextWindow = await POST(postRequest("incorrecta"));

    expect(nextWindow.status).toBe(401);
    expect(throttle.insertedRows).toHaveLength(6);
  });

  it("falla cerrado si no puede crear el cliente del throttle", async () => {
    throttle.clientError = true;

    const response = await POST(postRequest(SECRET));

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(throttle.insertAttempts).toEqual([]);
    expect(throttle.insertedRows).toEqual([]);
    expect(await response.text()).not.toContain("<form");
  });

  it("falla cerrado si no puede registrar el intento", async () => {
    throttle.insertError = { code: "08006", message: "insert unavailable" };

    const response = await POST(postRequest(SECRET));

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(throttle.insertedRows).toEqual([]);
  });

  it("registra un formulario malformado antes de rechazarlo", async () => {
    const response = await POST(
      new NextRequest(URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": IP,
        },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(throttle.insertedRows).toHaveLength(1);
  });

  it("acuña una cookie HttpOnly derivada y redirige a una URL limpia", async () => {
    const response = await POST(postRequest(SECRET));
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(URL);
    expect(setCookie).toContain("__Host-dtd-cbm-estudio=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=strict");
    expect(setCookie).not.toContain(SECRET);
  });

  it("sirve el contenido sólo con una sesión firmada vigente", async () => {
    const login = await POST(postRequest(SECRET));
    const cookie = login.cookies.get("__Host-dtd-cbm-estudio");
    expect(cookie?.value).toBeTruthy();

    const response = await GET(
      new NextRequest(URL, {
        headers: { Cookie: `__Host-dtd-cbm-estudio=${cookie?.value}` },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Transporte CBM China-Venezuela");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("rechaza en servidor una sesión que superó las ocho horas", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00-04:00"));
    const login = await POST(postRequest(SECRET));
    const cookie = login.cookies.get("__Host-dtd-cbm-estudio");

    vi.advanceTimersByTime(8 * 60 * 60 * 1000 + 1);
    const response = await GET(
      new NextRequest(URL, {
        headers: { Cookie: `__Host-dtd-cbm-estudio=${cookie?.value}` },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("falla cerrado si el secreto no está configurado", async () => {
    delete process.env.CBM_ESTUDIO_TOKEN;

    const response = await POST(postRequest(SECRET));

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
