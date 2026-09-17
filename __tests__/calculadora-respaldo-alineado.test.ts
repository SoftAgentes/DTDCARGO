/**
 * SDD-0475 · el respaldo del calculador no se mueve solo.
 *
 * `CONFIG.tarifaBaseCBM` y `CONFIG.pesoIncluidoKg` son **espejos** de lo que vive
 * en el ERP (`rates.per_cbm` de la fila pública y
 * `calculator_settings.peso_incluido_kg`). Cuando la RPC no responde —Supabase
 * caído, o la vigencia de la tarifa vencida, que es lo normal cada mes— el sitio
 * cotiza con estas constantes. Si no coinciden con el ERP, el precio cambia **en
 * silencio**: sin error, sin log, sin que nadie se entere.
 *
 * NO ES HIPOTÉTICO. Pasó dos veces:
 *   · `pesoIncluidoKg`: el ERP tenía 1.000 kg desde el 2026-07-06 y el código
 *     seguía en 500. Ante una caída, se habría cobrado excedente al doble de
 *     clientes. Corregido el 2026-08-05.
 *   · `tarifaBaseCBM`: la migr 0336 subió la tarifa pública a $850 el 2026-09-04
 *     y avisaba en su cabecera que ese día había que subir la constante. No se
 *     hizo. Trece días cotizando 6,25% por debajo ante cualquier caída — lo que
 *     arregla SDD-0475.
 *
 * QUÉ HACE ESTE TEST: anclar los valores. No puede comparar contra la DB (el CI
 * corre sin credenciales, y por eso el paso `migrations-applied` de verify sale
 * SKIP), así que hace lo único que sirve desde acá: **convertir un cambio
 * silencioso en uno deliberado**. Los demás tests usan `CONFIG.tarifaBaseCBM`
 * como referencia, así que mover el número no rompe nada — que es justamente
 * cómo se coló la desalineación. Con este archivo, cambiarlo obliga a venir acá
 * y decir por qué.
 *
 * SI ESTE TEST TE SALIÓ ROJO: no lo "arregles" cambiando el número esperado sin
 * más. Comprobá primero qué dice el ERP (`/studio/tarifas`, o la RPC
 * `public_cbm_rate`) y alineá el código con eso. El arreglo de fondo —una alerta
 * cuando una tarifa pública esté por vencer— es SDD-0164 y sigue pendiente.
 */
import { describe, it, expect } from "vitest";
import { CONFIG } from "@/lib/calculadora";

describe("respaldo del calculador · espejo del ERP (SDD-0475)", () => {
  it("la tarifa base por CBM está en $850, como la fila pública del ERP", () => {
    // Verificado contra producción el 2026-09-17: la RPC public_cbm_rate
    // devuelve { per_cbm: 850, min_charge: 50, valid_until: "2026-10-04" }.
    expect(CONFIG.tarifaBaseCBM).toBe(850);
  });

  it("la gracia de peso está en 1.000 kg/m³, como calculator_settings", () => {
    // Ojo: 1.000 es el valor VIGENTE del ERP, y es lo que este respaldo tiene
    // que espejar para no cambiar el precio ante una caída. No confundir con la
    // regla que se le PROMETE al cliente en el material público, que son 500
    // kg/m³ porque los 1.000 son una excepción temporal (founder 2026-09-17,
    // SDD-0474). Son dos cosas distintas a propósito: acá manda lo que se
    // factura.
    expect(CONFIG.pesoIncluidoKg).toBe(1000);
  });

  it("el piso mínimo está en $50, como min_charge del ERP", () => {
    expect(CONFIG.minimoFacturable).toBe(50);
  });

  it("los tres son números positivos y finitos", () => {
    // Un undefined colado acá no da error: da NaN en el precio y el cliente ve
    // «$NaN» o un total en cero.
    for (const v of [CONFIG.tarifaBaseCBM, CONFIG.pesoIncluidoKg, CONFIG.minimoFacturable]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  it("el piso mínimo es menor que la tarifa de un CBM (si no, nadie pagaría la tarifa)", () => {
    // Relación de sentido: el mínimo cobrable existe para envíos chicos. Si
    // superara el precio de 1 m³, todo envío de menos de 1 m³ pagaría el piso y
    // la tarifa por CBM dejaría de aplicar en el tramo que más se usa.
    expect(CONFIG.minimoFacturable).toBeLessThan(CONFIG.tarifaBaseCBM);
  });
});
