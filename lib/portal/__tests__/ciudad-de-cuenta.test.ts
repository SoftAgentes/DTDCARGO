/**
 * migr 0348 · qué ciudad muestra "Mi perfil › Datos de cuenta".
 *
 * El hueco real: entre el alta y la primera dirección de entrega, el campo se
 * veía VACÍO ("Según tu dirección predeterminada") aunque el cliente ya había
 * declarado su ciudad al registrarse y el dato estaba guardado en `clients.city`.
 *
 * PRUEBAS DE MUTACIÓN (sobre `ciudadDeCuenta` en ../portal-types.ts; cada una
 * tiene que poner ESTE archivo en rojo — si no, el test es decorado):
 *   · invertir la precedencia (devolver la del registro primero) → "la dirección manda"
 *   · devolver `cliente.city` sin el estado                      → "muestra ciudad y estado"
 *   · devolver "" en vez de null cuando no hay nada              → "sin dato devuelve null"
 */
import { describe, expect, it } from "vitest";
import { ciudadDeCuenta } from "../portal-types";

describe("ciudadDeCuenta — precedencia del campo Ciudad del perfil", () => {
  it("la dirección predeterminada manda: es la que de verdad recibe la carga", () => {
    expect(
      ciudadDeCuenta("Maracay", { city: "Valencia", state: "Carabobo" }),
    ).toBe("Maracay");
  });

  it("sin dirección cargada, cae a lo que declaró al registrarse", () => {
    expect(ciudadDeCuenta(null, { city: "Valencia", state: "Carabobo" })).toBe(
      "Valencia, Carabobo",
    );
    // `undefined` es el caso real: `defaultAddress?.city` cuando no hay ninguna.
    expect(ciudadDeCuenta(undefined, { city: "Valencia", state: "Carabobo" })).toBe(
      "Valencia, Carabobo",
    );
  });

  it("muestra ciudad y estado juntos, no sólo la ciudad", () => {
    expect(ciudadDeCuenta(null, { city: "Punta de Mata", state: "Monagas" })).toContain(
      "Monagas",
    );
  });

  it("aguanta un estado vacío sin dejar la coma colgando", () => {
    expect(ciudadDeCuenta(null, { city: "Valencia", state: null })).toBe("Valencia");
  });

  it("sin ningún dato devuelve null, para que la vista pinte su texto de vacío", () => {
    // Las altas anteriores a la 0348 no tienen ciudad: 432 clientes al aplicarla.
    expect(ciudadDeCuenta(null, { city: null, state: null })).toBeNull();
  });
});
