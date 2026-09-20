// @vitest-environment node
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFileMock, getUserMock, zipSyncMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  getUserMock: vi.fn(),
  zipSyncMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
  default: { readFile: readFileMock },
}));
vi.mock("fflate", () => ({ zipSync: zipSyncMock }));
vi.mock("@/lib/auth/session", () => ({ getUser: getUserMock }));

import { GET } from "../route";

function request(bundle: string) {
  return GET(new Request(`http://localhost/interno/marca/d/${bundle}`), {
    params: Promise.resolve({ bundle }),
  });
}

describe("GET /interno/marca/d/[bundle]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ id: "user-1" });
    readFileMock.mockResolvedValue(Buffer.from("asset"));
    zipSyncMock.mockReturnValue(new Uint8Array([80, 75, 3, 4]));
  });

  it("exige sesión antes de leer los assets", async () => {
    getUserMock.mockResolvedValue(null);

    const response = await request("logos");

    expect(response.status).toBe(401);
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("rechaza bundles fuera de la whitelist", async () => {
    const response = await request("../../repo");

    expect(response.status).toBe(404);
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("resuelve cada archivo dentro de una raíz estática y entrega el zip", async () => {
    const response = await request("whatsapp");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toContain(
      'filename="dtd-whatsapp-business-services.zip"',
    );
    expect(readFileMock).toHaveBeenCalledWith(
      path.join(
        process.cwd(),
        "private",
        "marca",
        "herramientas/whatsapp-catalogo-plantillas.html",
      ),
    );
    expect(readFileMock).toHaveBeenCalledWith(
      path.join(process.cwd(), "docs", "marketing", "whatsapp-business.md"),
    );
    expect(readFileMock).toHaveBeenCalledWith(
      path.join(process.cwd(), "public", "brand", "dtdcargo-isologo-primary.png"),
    );
  });

  it("falla de forma segura cuando no hay ningún archivo disponible", async () => {
    readFileMock.mockRejectedValue(new Error("ENOENT"));

    const response = await request("logos");

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("No se pudo armar el paquete.");
    expect(zipSyncMock).not.toHaveBeenCalled();
  });
});
