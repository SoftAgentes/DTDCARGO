import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFileMock, getUserMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
  default: { readFile: readFileMock },
}));
vi.mock("@/lib/auth/session", () => ({ getUser: getUserMock }));

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
    readFileMock.mockResolvedValue("<html>brand</html>");
  });

  it("exige sesión antes de leer el filesystem", async () => {
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
});
