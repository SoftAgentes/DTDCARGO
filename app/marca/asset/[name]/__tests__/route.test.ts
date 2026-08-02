import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFileMock, getUserMock, hasBrandAccessMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  getUserMock: vi.fn(),
  hasBrandAccessMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
  default: { readFile: readFileMock },
}));
vi.mock("@/lib/auth/session", () => ({ getUser: getUserMock }));
vi.mock("@/lib/marca/access", () => ({ hasBrandAccess: hasBrandAccessMock }));

import { GET } from "../route";

function request(name: string) {
  return GET(new Request(`http://localhost/marca/asset/${name}`), {
    params: Promise.resolve({ name }),
  });
}

describe("GET /marca/asset/[name]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ id: "user-1" });
    hasBrandAccessMock.mockResolvedValue(true);
    readFileMock.mockResolvedValue("<html>brand</html>");
  });

  it("exige autorización antes de leer el filesystem", async () => {
    hasBrandAccessMock.mockResolvedValue(false);
    getUserMock.mockResolvedValue(null);

    const response = await request("brand-book");

    expect(response.status).toBe(401);
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("rechaza nombres fuera de la whitelist, incluido traversal", async () => {
    const response = await request("../../next.config.ts");

    expect(response.status).toBe(404);
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("lee el asset permitido desde el subárbol privado y conserva headers", async () => {
    const response = await request("wa-catalogo");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>brand</html>");
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(readFileMock).toHaveBeenCalledWith(
      path.join(
        process.cwd(),
        "private",
        "marca",
        "herramientas/whatsapp-catalogo-plantillas.html",
      ),
      "utf8",
    );
  });

  it("responde 404 sin filtrar el error del filesystem", async () => {
    readFileMock.mockRejectedValue(new Error("ENOENT private path"));

    const response = await request("brand-book");

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("No encontrado.");
  });

  // ── SDD-0238: dos niveles de acceso ───────────────────────────

  it("el brand book se abre con el código de /marca, sin sesión del ERP", async () => {
    getUserMock.mockResolvedValue(null);
    hasBrandAccessMock.mockResolvedValue(true);

    const response = await request("brand-book");

    expect(response.status).toBe(200);
  });

  it("las herramientas de WhatsApp NO se abren con el código: son del equipo", async () => {
    // Un diseñador externo pasó el gate de /marca (cookie válida) pero no tiene
    // cuenta del ERP. El catálogo de WhatsApp Business no es material de marca.
    getUserMock.mockResolvedValue(null);
    hasBrandAccessMock.mockResolvedValue(true);

    for (const name of ["wa-catalogo", "wa-guia"]) {
      const response = await request(name);
      expect(response.status).toBe(401);
    }
    expect(readFileMock).not.toHaveBeenCalled();
  });
});
