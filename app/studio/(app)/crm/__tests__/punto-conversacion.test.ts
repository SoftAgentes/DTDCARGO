/**
 * El semáforo de conversación tiene que estar en LAS DOS vistas.
 *
 * Mismo contrato —y misma cicatriz— que `stage-control.test.ts`: el verbo de
 * mover etapa nació sólo en la tabla del Asesor, el Tablero quedó de sólo
 * lectura, y el diagnóstico del founder fue "el ERP no escribe al CRM". Un
 * indicador a medias es peor que ninguno, porque entrena a no mirar la pantalla.
 *
 * Acá se agrega una segunda cosa que fijar: **que la antigüedad no vuelva a
 * competir por el rojo.** Antes de SDD-0288, ≥180 días pintaba `--danger`. Si
 * alguien lo restaura, el Tablero tendría dos rojos con significados distintos
 * y el asesor no podría saber cuál está mirando.
 *
 * Es un test de fuente (no de render) por lo mismo que sus hermanos: lo que se
 * afirma es el CABLEADO, y montar el árbol exigiría el runtime de Server Actions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const DIR = "app/studio/(app)/crm/_components";
const VISTAS = [`${DIR}/KommoClient.tsx`, `${DIR}/KommoBoardView.tsx`] as const;

describe("el punto de conversación está en las dos vistas", () => {
  it.each(VISTAS)("%s monta <PuntoConversacion>", (path) => {
    const code = read(path);
    expect(code).toContain("<PuntoConversacion");
    expect(code).toContain('from "./PuntoConversacion"');
  });

  it.each(VISTAS)("%s le pasa un reloj explícito, no lo deja leerlo adentro", (path) => {
    // La derivada es pura y recibe `ahoraMs`. Si una vista dejara que el
    // componente llamara a Date.now() por su cuenta, dos tarjetas del mismo
    // render podrían caer en minutos distintos.
    expect(read(path)).toMatch(/<PuntoConversacion[\s\S]{0,120}ahoraMs=/);
  });
});

describe("🔴 la antigüedad NO puede recuperar el rojo", () => {
  it.each(VISTAS)("%s pinta la antigüedad en ámbar, nunca en --danger", (path) => {
    const code = read(path);
    const ageTone = code.slice(
      code.indexOf("function ageTone"),
      code.indexOf("function ageTone") + 400,
    );
    expect(ageTone).toContain("var(--warning)");
    expect(ageTone).not.toContain("var(--danger)");
  });
});

describe("el punto sale de la derivada compartida, no de un cálculo suelto", () => {
  it("PuntoConversacion deriva con conversacionDe y colorConversacion", () => {
    const code = read(`${DIR}/PuntoConversacion.tsx`);
    expect(code).toContain("conversacionDe(");
    expect(code).toContain("colorConversacion(");
    // El color NO se escribe a mano en el componente: sale de la derivada, que
    // es donde está probado que sólo "te escribió" es rojo.
    expect(code).not.toContain('background: "var(--danger)"');
  });

  it("las dos fechas viajan en la MISMA constante de columnas", () => {
    // Si el Tablero y la tabla pidieran selects distintos, el punto saldría en
    // una vista y en la otra no — sin que ningún test se enterara.
    const q = read("lib/studio/kommo-queries.ts");
    const cols = q.slice(q.indexOf("const LEAD_COLUMNS"), q.indexOf("const LEAD_COLUMNS") + 500);
    expect(cols).toContain("last_inbound_at");
    expect(cols).toContain("last_outbound_at");
  });
});
