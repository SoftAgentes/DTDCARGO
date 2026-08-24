/**
 * SDD-0281 · Los helpers puros del detalle de compra del portal.
 *
 * Los dos casos que importan son los que le mienten al cliente si se hacen mal:
 *
 *  1. `sumaOculta` — un CBM sin medir NO es 0. Imprimir "0.000 m³" le diría al
 *     cliente que su carga no ocupa nada, cuando lo cierto es que todavía no la
 *     midieron.
 *  2. `compararCajas` — un faltante tiene que salir a la superficie. Mostrar
 *     sólo "7 recibidas" es técnicamente cierto y prácticamente una omisión
 *     cuando el cliente anunció 10.
 */

import { describe, it, expect } from "vitest";
import {
  compararCajas,
  nombreDeProveedor,
  sumaOculta,
} from "../purchase-reception-queries";

describe("sumaOculta", () => {
  it("suma los valores cargados", () => {
    expect(sumaOculta([1.5, 2.25])).toBe(3.75);
  });

  it("🔴 devuelve null si NINGUNO está medido — no 0", () => {
    // 0 diría "no ocupa nada". null deja que la pantalla diga "— m³".
    expect(sumaOculta([null, null])).toBeNull();
    expect(sumaOculta([])).toBeNull();
  });

  it("con medidas parciales suma lo que hay: un total parcial es información", () => {
    expect(sumaOculta([2.4, null, 1.1])).toBe(3.5);
  });

  it("un 0 REAL cuenta como medido y devuelve 0", () => {
    expect(sumaOculta([0])).toBe(0);
  });

  it("no arrastra el error de coma flotante a la pantalla", () => {
    expect(sumaOculta([0.1, 0.2])).toBe(0.3);
  });
});

describe("compararCajas", () => {
  it("nada recibido → sin_llegar", () => {
    expect(compararCajas(10, 0)).toEqual({ estado: "sin_llegar", diferencia: -10 });
  });

  it("🔴 recibido de menos → parcial, con el faltante exacto", () => {
    expect(compararCajas(10, 7)).toEqual({ estado: "parcial", diferencia: -3 });
  });

  it("recibido completo → completo", () => {
    expect(compararCajas(10, 10)).toEqual({ estado: "completo", diferencia: 0 });
  });

  it("llegó de más → excedente (pasa: el proveedor mandó una caja extra)", () => {
    expect(compararCajas(10, 12)).toEqual({ estado: "excedente", diferencia: 2 });
  });

  it("una compra anunciada en 0 cajas con mercancía recibida sale como excedente", () => {
    // Caso de borde real: se anuncia sin saber el bulto y la bodega recibe 3.
    // No se puede llamar "completo" — el número declarado no se cumplió.
    expect(compararCajas(0, 3)).toEqual({ estado: "excedente", diferencia: 3 });
  });
});

describe("nombreDeProveedor", () => {
  it("manda el que registró el cliente", () => {
    expect(nombreDeProveedor("Yiwu Star Trading", "义乌之星")).toEqual({
      principal: "Yiwu Star Trading",
      segundo: "义乌之星",
    });
  });

  it("🔴 no repite el mismo nombre dos veces con etiquetas distintas", () => {
    // Repetirlo no informa: ensucia. Sólo se muestra el segundo si aporta algo.
    expect(nombreDeProveedor("Yiwu Star", "yiwu  star")).toEqual({
      principal: "Yiwu Star",
      segundo: null,
    });
  });

  it("sin registrado cae al que escribió la bodega", () => {
    expect(nombreDeProveedor(null, "义乌之星")).toEqual({
      principal: "义乌之星",
      segundo: null,
    });
  });

  it("sin ninguno de los dos devuelve null (no inventa un guión)", () => {
    expect(nombreDeProveedor(null, null)).toEqual({ principal: null, segundo: null });
    expect(nombreDeProveedor("  ", "  ")).toEqual({ principal: null, segundo: null });
  });

  it("NO compara sin acentos: una diferencia real se muestra", () => {
    // Ser "listo" acá escondería que la bodega recibió de otro proveedor, que es
    // justo lo que vale la pena ver.
    const r = nombreDeProveedor("Fábrica Lin", "Fabrica Lin");
    expect(r.segundo).toBe("Fabrica Lin");
  });
});
