// @vitest-environment node
/**
 * El orquestador del lote de enlaces de acceso (SDD-0274 · Slice 4).
 *
 * QUÉ DEFIENDE, y qué se rompería en silencio:
 *
 *   - **No se detiene en el primer fallo.** Un lote con `break` cuando rebota
 *     el segundo correo deja sin enviar a los que siguen y la UI dice "listo".
 *     Es el bug clásico de los envíos masivos y no lo caza ningún tipo.
 *   - **Cada destinatario trae su propio veredicto.** Sin eso la UI no puede
 *     nombrar quién falló — ERR-01 pide el error cerca de su causa, y en un
 *     lote las causas son filas distintas.
 *   - **El tope corta ANTES de mandar nada.** Chequearlo dentro del bucle ya
 *     habría mandado correos cuando corta.
 *   - **Los repetidos se mandan una sola vez.** La lista viene de la UI; un
 *     duplicado ahí serían dos correos a la misma persona.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ACCESS_LINK_BULK_MAX,
  orquestarLoteDeAcceso,
} from "@/lib/studio/access-link-bulk";

const enviarUno = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  enviarUno.mockResolvedValue({ ok: true });
});

describe("orquestarLoteDeAcceso", () => {
  it("le manda a cada persona de la lista, en orden", async () => {
    const res = await orquestarLoteDeAcceso(["a", "b", "c"], enviarUno);

    expect(enviarUno).toHaveBeenCalledTimes(3);
    expect(enviarUno.mock.calls.map((c) => c[0])).toEqual(["a", "b", "c"]);
    expect(res.resultados.every((r) => r.ok)).toBe(true);
  });

  it("un fallo NO corta el lote, y el resultado dice quién falló", async () => {
    enviarUno.mockImplementation(async (id: string) =>
      id === "b" ? { error: "Ese correo rebotó." } : { ok: true },
    );

    const res = await orquestarLoteDeAcceso(["a", "b", "c"], enviarUno);

    // Los tres recibieron su intento, aunque el segundo fallara.
    expect(enviarUno).toHaveBeenCalledTimes(3);
    const malo = res.resultados.find((r) => r.userId === "b");
    expect(malo?.ok).toBe(false);
    expect(malo?.error).toMatch(/rebotó/i);
    expect(res.resultados.filter((r) => r.ok).map((r) => r.userId)).toEqual(["a", "c"]);
  });

  it("un fallo sin mensaje igual sale como fallo, no como éxito mudo", async () => {
    enviarUno.mockResolvedValue({ errorCode: "user_signin_required" });

    const res = await orquestarLoteDeAcceso(["a"], enviarUno);

    expect(res.resultados[0].ok).toBe(false);
    expect(res.resultados[0].error).toBeTruthy();
  });

  it("los repetidos se mandan una sola vez", async () => {
    const res = await orquestarLoteDeAcceso(["a", "a", "b", "  a  "], enviarUno);

    expect(enviarUno).toHaveBeenCalledTimes(2);
    expect(res.resultados.map((r) => r.userId)).toEqual(["a", "b"]);
  });

  it("por encima del tope no manda NADA", async () => {
    const muchos = Array.from({ length: ACCESS_LINK_BULK_MAX + 1 }, (_, i) => `u${i}`);

    const res = await orquestarLoteDeAcceso(muchos, enviarUno);

    expect(res.error).toContain(String(ACCESS_LINK_BULK_MAX));
    expect(res.resultados).toHaveLength(0);
    // Lo importante: cortó ANTES de mandar, no a mitad de camino.
    expect(enviarUno).not.toHaveBeenCalled();
  });

  it("justo en el tope sí manda", async () => {
    const justos = Array.from({ length: ACCESS_LINK_BULK_MAX }, (_, i) => `u${i}`);

    const res = await orquestarLoteDeAcceso(justos, enviarUno);

    expect(res.error).toBeUndefined();
    expect(enviarUno).toHaveBeenCalledTimes(ACCESS_LINK_BULK_MAX);
  });

  it("una lista vacía no manda nada y lo dice", async () => {
    const res = await orquestarLoteDeAcceso(["", "   "], enviarUno);

    expect(res.error).toBeTruthy();
    expect(enviarUno).not.toHaveBeenCalled();
  });
});
