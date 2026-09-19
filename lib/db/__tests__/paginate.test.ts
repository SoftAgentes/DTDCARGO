// @vitest-environment node
/**
 * Contrato de `fetchAllPaged`. Lo importante no es que pagine: es que **no
 * corte cuando el servidor recorta la página**, que es el bug original.
 */
import { describe, expect, it, vi } from "vitest";

import { fetchAllPaged, MAX_PAGES, PAGE_SIZE } from "../paginate";

/**
 * Servidor de mentira con un tope propio, como el `db-max-rows` de PostgREST:
 * devuelve como mucho `capServidor` filas por request, sin importar el rango.
 */
function servidorFalso(total: number, capServidor: number) {
  const filas = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
  const llamadas: Array<[number, number]> = [];
  const page = (from: number, to: number) => {
    llamadas.push([from, to]);
    const pedido = to - from + 1;
    const trozo = filas.slice(from, from + Math.min(pedido, capServidor));
    return Promise.resolve({ data: trozo, error: null });
  };
  return { page, llamadas };
}

describe("fetchAllPaged", () => {
  it("trae TODO cuando el total supera una página", async () => {
    const { page } = servidorFalso(2500, PAGE_SIZE);
    const { rows, complete } = await fetchAllPaged<{ id: number }>(page);
    expect(rows).toHaveLength(2500);
    expect(complete).toBe(true);
    expect(rows[0].id).toBe(1);
    expect(rows[2499].id).toBe(2500);
  });

  it("⭐ el servidor recorta la página y NO se corta por eso", async () => {
    // Éste es el caso que mata la regla intuitiva "vino menos de lo que pedí
    // ⇒ terminé": pedimos 1000 y el servidor da 400. Con esa regla, esta
    // lectura devolvería 400 de 2500 y nadie se enteraría.
    const { page } = servidorFalso(2500, 400);
    const { rows, complete } = await fetchAllPaged<{ id: number }>(page);
    expect(rows).toHaveLength(2500);
    expect(complete).toBe(true);
  });

  it("avanza por lo RECIBIDO, no por lo pedido", async () => {
    const { page, llamadas } = servidorFalso(900, 400);
    await fetchAllPaged<{ id: number }>(page);
    // 0-999 → 400 filas → arranca en 400, no en 1000.
    expect(llamadas[0][0]).toBe(0);
    expect(llamadas[1][0]).toBe(400);
    expect(llamadas[2][0]).toBe(800);
  });

  it("sin filas devuelve vacío y completo, en un solo request", async () => {
    const { page, llamadas } = servidorFalso(0, PAGE_SIZE);
    const { rows, complete } = await fetchAllPaged<{ id: number }>(page);
    expect(rows).toEqual([]);
    expect(complete).toBe(true);
    expect(llamadas).toHaveLength(1);
  });

  it("un total exacto de una página pide la siguiente antes de decir que terminó", async () => {
    // Sin este request extra, un total que cae justo en el borde sería
    // indistinguible de uno truncado.
    const { page, llamadas } = servidorFalso(PAGE_SIZE, PAGE_SIZE);
    const { rows, complete } = await fetchAllPaged<{ id: number }>(page);
    expect(rows).toHaveLength(PAGE_SIZE);
    expect(complete).toBe(true);
    expect(llamadas).toHaveLength(2);
  });

  it("si se agotan las páginas dice `complete: false` en vez de mentir", async () => {
    const { page } = servidorFalso((MAX_PAGES + 5) * PAGE_SIZE, PAGE_SIZE);
    const { rows, complete } = await fetchAllPaged<{ id: number }>(page);
    expect(complete).toBe(false);
    expect(rows).toHaveLength(MAX_PAGES * PAGE_SIZE);
  });

  it("propaga el error del servidor en vez de devolver filas a medias", async () => {
    const page = vi
      .fn<(from: number, to: number) => Promise<{ data: unknown; error: { message: string } | null }>>()
      .mockResolvedValueOnce({ data: [{ id: 1 }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(fetchAllPaged<{ id: number }>(page)).rejects.toThrow("boom");
  });

  it("`data: null` sin error se trata como página vacía", async () => {
    const page = vi
      .fn<(from: number, to: number) => Promise<{ data: unknown; error: null }>>()
      .mockResolvedValue({ data: null, error: null });
    const { rows, complete } = await fetchAllPaged<{ id: number }>(page);
    expect(rows).toEqual([]);
    expect(complete).toBe(true);
  });
});
