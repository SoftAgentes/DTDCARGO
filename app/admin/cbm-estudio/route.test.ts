import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const SECRET = "credencial-interna-de-prueba";
const URL = "https://dtdcargo.com/admin/cbm-estudio";

function postRequest(token: string): NextRequest {
  return new NextRequest(URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
}

describe("/admin/cbm-estudio · sesión sin secreto en URL", () => {
  beforeEach(() => {
    process.env.CBM_ESTUDIO_TOKEN = SECRET;
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
