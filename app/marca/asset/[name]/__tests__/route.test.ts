import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readFileMock,
  getUserMock,
  hasBrandAccessMock,
  resolveBrandTenantIdMock,
  findBrandBookAssetMock,
  downloadMock,
} = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  getUserMock: vi.fn(),
  hasBrandAccessMock: vi.fn(),
  resolveBrandTenantIdMock: vi.fn(),
  findBrandBookAssetMock: vi.fn(),
  downloadMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
  default: { readFile: readFileMock },
}));
vi.mock("@/lib/auth/session", () => ({ getUser: getUserMock }));
vi.mock("@/lib/marca/access", () => ({
  hasBrandAccess: hasBrandAccessMock,
  resolveBrandTenantId: resolveBrandTenantIdMock,
}));
vi.mock("@/lib/marca/catalog-queries", () => ({
  findBrandBookAsset: findBrandBookAssetMock,
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ download: downloadMock }) },
  }),
}));

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
    readFileMock.mockResolvedValue("<html>herramienta</html>");
    resolveBrandTenantIdMock.mockResolvedValue("tenant-1");
    findBrandBookAssetMock.mockResolvedValue({
      id: "asset-1",
      storagePath: "tenant-1/marca/brand-book/brand-book-dtd-v5.0.html",
    });
    downloadMock.mockResolvedValue({
      data: new Blob(["<html>book</html>"], { type: "text/html" }),
      error: null,
    });
  });

  it("exige autorización antes de tocar Storage", async () => {
    hasBrandAccessMock.mockResolvedValue(false);
    getUserMock.mockResolvedValue(null);

    const response = await request("brand-book");

    expect(response.status).toBe(401);
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("rechaza nombres fuera de la whitelist, incluido traversal", async () => {
    const response = await request("../../next.config.ts");

    expect(response.status).toBe(404);
    expect(readFileMock).not.toHaveBeenCalled();
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("lee las herramientas desde el subárbol privado y conserva headers", async () => {
    const response = await request("wa-catalogo");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>herramienta</html>");
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

    const response = await request("wa-guia");

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("No encontrado.");
  });

  // ── SDD-0238: dos niveles de acceso ───────────────────────────

  it("el brand book se abre con el código de /marca, sin sesión del ERP", async () => {
    getUserMock.mockResolvedValue(null);
    hasBrandAccessMock.mockResolvedValue(true);

    const response = await request("brand-book");

    expect(response.status).toBe(200);
    // El cuerpo NO se compara acá: el `Response` de jsdom no lee un Blob como
    // BodyInit (lo convierte a "[object Blob]"), cosa que undici en Node sí
    // hace bien. Lo que importa y sí es verificable es de dónde salió — eso lo
    // cubre el test "el book sale del bucket, NO del filesystem".
    expect(downloadMock).toHaveBeenCalledOnce();
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

  // ── El book vive en Storage, no en git (founder 2026-08-02) ────

  it("el book sale del bucket, NO del filesystem", async () => {
    const response = await request("brand-book");

    expect(response.status).toBe(200);
    expect(downloadMock).toHaveBeenCalledWith(
      "tenant-1/marca/brand-book/brand-book-dtd-v5.0.html",
    );
    // La regresión que importa: si alguien vuelve a leerlo de disco, el archivo
    // no está en el repo y el visor abre vacío en prod.
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("si el book no está cargado, dice qué hacer en vez de mostrar un iframe vacío", async () => {
    findBrandBookAssetMock.mockResolvedValue(null);

    const response = await request("brand-book");

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("HUB de marca");
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("un fallo de Storage no se confunde con 'no existe'", async () => {
    downloadMock.mockResolvedValue({ data: null, error: new Error("network") });

    const response = await request("brand-book");

    expect(response.status).toBe(502);
  });
});
