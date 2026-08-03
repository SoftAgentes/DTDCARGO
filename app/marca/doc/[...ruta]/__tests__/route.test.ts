import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  hasBrandAccessMock,
  hasBrandInternalAccessMock,
  submitBrandInternalCodeMock,
  resolveBrandTenantIdMock,
  downloadMock,
  listMock,
} = vi.hoisted(() => ({
  hasBrandAccessMock: vi.fn(),
  hasBrandInternalAccessMock: vi.fn(),
  submitBrandInternalCodeMock: vi.fn(),
  resolveBrandTenantIdMock: vi.fn(),
  downloadMock: vi.fn(),
  listMock: vi.fn(),
}));

vi.mock("@/lib/marca/access", () => ({
  hasBrandAccess: hasBrandAccessMock,
  hasBrandInternalAccess: hasBrandInternalAccessMock,
  submitBrandInternalCode: submitBrandInternalCodeMock,
  resolveBrandTenantId: resolveBrandTenantIdMock,
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ download: downloadMock, list: listMock }) },
  }),
}));

import { GET, POST } from "../route";
import {
  claveProyecto,
  PROYECTO_INDICE,
  PROYECTO_PREFIJO,
  PROYECTO_PREFIJO_INTERNO,
} from "@/lib/marca/proyecto";

function pedir(...ruta: string[]) {
  return GET(new Request(`http://localhost/marca/doc/${ruta.join("/")}`), {
    params: Promise.resolve({ ruta }),
  });
}

function postear(codigo: string, ...ruta: string[]) {
  const body = new FormData();
  body.set("codigo", codigo);
  return POST(
    new Request(`http://localhost/marca/doc/${ruta.join("/")}`, { method: "POST", body }),
    { params: Promise.resolve({ ruta }) },
  );
}

const NO_ENCONTRADO = { data: null, error: { message: "Object not found" } };
const HALLADO = {
  data: new Blob(["<html>pieza</html>"], { type: "text/html" }),
  error: null,
};

describe("GET /marca/doc/[...ruta]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasBrandAccessMock.mockResolvedValue(true);
    hasBrandInternalAccessMock.mockResolvedValue(false);
    resolveBrandTenantIdMock.mockResolvedValue("tenant-1");
    downloadMock.mockResolvedValue(HALLADO);
    listMock.mockResolvedValue({ data: [], error: null });
  });

  it("exige autorización antes de tocar Storage", async () => {
    hasBrandAccessMock.mockResolvedValue(false);

    const res = await pedir("Logo Oficial.html");

    expect(res.status).toBe(401);
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("lee la clave del proyecto conservando la estructura de carpetas", async () => {
    await pedir("assets", "logo", "isologo.png");

    // La estructura de carpetas es lo único que hace funcionar los enlaces
    // relativos entre documentos: si la subida la aplanara, `Logo Oficial.html`
    // dejaría de resolver desde el book.
    const clave = downloadMock.mock.calls[0][0] as string;
    expect(clave).toBe(`tenant-1/proyecto/${claveProyecto("assets/logo/isologo.png")}`);
    expect(clave.split("/")).toHaveLength(5);
  });

  it("descarta los segmentos de traversal en vez de consultarlos", async () => {
    await pedir("..", "secreto.html");

    expect(downloadMock).toHaveBeenCalledWith(
      `tenant-1/proyecto/${claveProyecto("secreto.html")}`,
    );
  });

  it("sirve el SVG como adjunto — inline sería XSS en nuestro origen", async () => {
    const res = await pedir("motivo.svg");

    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("cachea los assets pero nunca los documentos", async () => {
    const doc = await pedir("Logo Oficial.html");
    const img = await pedir("foto.png");

    expect(doc.headers.get("Cache-Control")).toBe("private, no-store");
    expect(img.headers.get("Cache-Control")).toBe("private, max-age=3600");
  });

  it("un documento ausente da la página de aviso, no un 404", async () => {
    // Es una pieza de producto que se decidió no publicar: existe, no se
    // comparte. Un 404 le diría al visitante que se equivocó de enlace.
    downloadMock.mockResolvedValue(NO_ENCONTRADO);

    const res = await pedir("DTD Studio · ERP.html");
    const cuerpo = await res.text();

    expect(res.status).toBe(200);
    expect(cuerpo).toContain("no está publicada aquí");
    expect(cuerpo).toContain("DTD Studio · ERP.html");
  });

  it("el enlace al catálogo sale del iframe con target=_top", async () => {
    // EL FALLO QUE ESTO PREVIENE (visto en producción): el aviso se pinta
    // dentro del <iframe> del visor. Sin `target`, el navegador carga /marca
    // DENTRO del marco, y /marca declara `frame-ancestors 'none'` → lo bloquea
    // y el visitante queda encerrado mirando el ícono de archivo roto.
    downloadMock.mockResolvedValue(NO_ENCONTRADO);

    const cuerpo = await (await pedir("Operario · App.html")).text();

    expect(cuerpo).toMatch(/href="\/marca"[^>]*target="_top"/);
  });

  it("ofrece volver al documento anterior, no sólo al catálogo", async () => {
    // Quien llega acá venía leyendo el Brand Book: lo que espera es volver AL
    // BOOK. El iframe tiene su propio historial, así que `back()` lo devuelve
    // al documento exacto — y el botón se esconde si no hay a dónde volver,
    // porque un botón que no hace nada es peor que no tenerlo.
    downloadMock.mockResolvedValue(NO_ENCONTRADO);

    const cuerpo = await (await pedir("Operario · App.html")).text();

    expect(cuerpo).toContain("Volver al Brand Book");
    expect(cuerpo).toContain("history.back()");
    expect(cuerpo).toContain("history.length > 1");
  });

  it("el nombre del documento va escapado", async () => {
    downloadMock.mockResolvedValue(NO_ENCONTRADO);

    const cuerpo = await (await pedir('<img src=x onerror=alert(1)>.html')).text();

    expect(cuerpo).not.toContain("<img src=x");
  });

  it("un asset ausente sí es 404 — es una imagen rota, no una decisión", async () => {
    downloadMock.mockResolvedValue(NO_ENCONTRADO);

    const res = await pedir("assets", "falta.png");

    expect(res.status).toBe(404);
  });

  it("si falta el ÍNDICE avisa que no se subió, no que sea interno", async () => {
    // El fallo real que esto evita: sin la subida hecha, el visor mostraba
    // "esta pieza es interna de producto" sobre el documento principal —
    // mandaba a pedir un permiso en vez de a correr el script.
    downloadMock.mockResolvedValue(NO_ENCONTRADO);

    const res = await pedir(PROYECTO_INDICE);
    const cuerpo = await res.text();

    expect(res.status).toBe(503);
    expect(cuerpo).toContain("upload-brand-proyecto");
    expect(cuerpo).not.toContain("interno");
  });

  it("no expone el visor a los indexadores", async () => {
    const res = await pedir("Logo Oficial.html");

    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
});

describe("la segunda capa: piezas de producto (SDD-0242)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasBrandAccessMock.mockResolvedValue(true);
    hasBrandInternalAccessMock.mockResolvedValue(false);
    resolveBrandTenantIdMock.mockResolvedValue("tenant-1");
    listMock.mockResolvedValue({ data: [], error: null });
  });

  it("SIN el código interno no consulta siquiera la carpeta de producto", async () => {
    // El corazón del diseño: la pieza no está "prohibida por un if", está en una
    // clave que la ruta no mira. Si esta prueba se cae porque alguien agregó una
    // consulta condicional, el permiso volvió a ser un `if` que se puede olvidar.
    downloadMock.mockResolvedValue(NO_ENCONTRADO);

    await pedir("DTD Studio · ERP.html");

    const consultadas = downloadMock.mock.calls.map((c) => c[0] as string);
    expect(consultadas).toHaveLength(1);
    expect(consultadas[0]).toContain(`/${PROYECTO_PREFIJO}/`);
    expect(consultadas.some((k) => k.includes(PROYECTO_PREFIJO_INTERNO))).toBe(false);
  });

  it("CON el código interno sirve la pieza desde la carpeta de producto", async () => {
    hasBrandInternalAccessMock.mockResolvedValue(true);
    downloadMock.mockResolvedValueOnce(NO_ENCONTRADO).mockResolvedValueOnce(HALLADO);

    const res = await pedir("Operario · App.html");

    expect(res.status).toBe(200);
    expect(downloadMock.mock.calls[1][0]).toBe(
      `tenant-1/${PROYECTO_PREFIJO_INTERNO}/${claveProyecto("Operario · App.html")}`,
    );
  });

  it("una pieza que existe detrás del código ofrece el formulario", async () => {
    downloadMock.mockResolvedValue(NO_ENCONTRADO);
    listMock.mockResolvedValue({ data: [{ name: "x" }], error: null });

    const cuerpo = await (await pedir("Cotizador de Fletes · DTD-Cargo.html")).text();

    expect(cuerpo).toContain("código de producto");
    expect(cuerpo).toContain('name="codigo"');
  });

  it("una pieza que NO existe en ningún lado no ofrece formulario ni inventa motivo", async () => {
    // El aviso no puede convertirse en un oráculo: si ofreciera el campo
    // siempre, se probarían rutas inventadas para ver cuáles existen.
    downloadMock.mockResolvedValue(NO_ENCONTRADO);
    listMock.mockResolvedValue({ data: [], error: null });

    const cuerpo = await (await pedir("Inventada.html")).text();

    expect(cuerpo).toContain("no está publicada aquí");
    expect(cuerpo).not.toContain('name="codigo"');
  });

  it("el formulario postea a su propia URL, no a /api — la CSP del iframe", async () => {
    downloadMock.mockResolvedValue(NO_ENCONTRADO);
    listMock.mockResolvedValue({ data: [{ name: "x" }], error: null });

    const cuerpo = await (await pedir("Operario · App.html")).text();

    expect(cuerpo).toMatch(/method="post"\s+action=""/);
    expect(cuerpo).not.toContain("/api/marca");
  });
});

describe("POST /marca/doc/[...ruta] — el desbloqueo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasBrandAccessMock.mockResolvedValue(true);
    resolveBrandTenantIdMock.mockResolvedValue("tenant-1");
  });

  it("exige la primera capa antes de mirar el código", async () => {
    hasBrandAccessMock.mockResolvedValue(false);

    const res = await postear("123456", "Operario · App.html");

    expect(res.status).toBe(401);
    expect(submitBrandInternalCodeMock).not.toHaveBeenCalled();
  });

  it("acierto → 303 de vuelta al documento, sin la query de error", async () => {
    // 303 y no 302: tras el redirect el navegador hace GET, así que recargar no
    // reenvía el código ni gasta otro intento del contador.
    submitBrandInternalCodeMock.mockResolvedValue({ status: "ok", sessionDays: 0.5 });

    const res = await postear("123456", "Operario · App.html");

    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe(
      `/marca/doc/${encodeURIComponent("Operario · App.html")}`,
    );
  });

  it("una forma inválida no gasta un intento del contador", async () => {
    const res = await postear("12ab", "Operario · App.html");

    expect(submitBrandInternalCodeMock).not.toHaveBeenCalled();
    expect(res.headers.get("Location")).toContain("e=");
  });

  it("código errado vuelve con los intentos que quedan", async () => {
    submitBrandInternalCodeMock.mockResolvedValue({ status: "wrong", attemptsLeft: 2 });

    const res = await postear("999999", "Operario · App.html");

    expect(decodeURIComponent(res.headers.get("Location") ?? "")).toContain(
      "Te quedan 2 intentos",
    );
  });

  it("bloqueado dice cuánto falta, no sólo que falló", async () => {
    submitBrandInternalCodeMock.mockResolvedValue({
      status: "locked",
      until: new Date(Date.now() + 5 * 60_000),
    });

    const res = await postear("999999", "Operario · App.html");

    expect(decodeURIComponent(res.headers.get("Location") ?? "")).toMatch(/en \d+ min/);
  });
});
