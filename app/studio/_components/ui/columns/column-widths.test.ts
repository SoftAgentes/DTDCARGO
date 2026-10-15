// @vitest-environment node
/**
 * SDD-0520 · lógica pura de anchos de columna.
 *
 * Lo que se afirma:
 *  - lo que escribe el usuario se recorta a [mínimo, máximo] y se redondea;
 *  - lo guardado que no sirve se IGNORA (no se recorta) columna por columna:
 *    JSON corrupto, no-objeto, columnas desconocidas o fijas, no-números y
 *    valores fuera de rango; lo válido de al lado se conserva;
 *  - el estado y lo guardado son sólo los anchos que el usuario fijó;
 *  - reset de una columna (vuelve a crecer si es `grow`) y de todas;
 *  - teclado: un paso por flecha, Home/End a los extremos, sin pasarse;
 *  - el template sale de un solo lugar; la primera `grow` sin fijar absorbe
 *    el espacio libre y nunca crecen dos a la vez.
 */
import { describe, expect, it } from "vitest";
import {
  COLUMN_WIDTH_STEP,
  NO_COLUMN_WIDTHS,
  clampColumnWidth,
  columnGridTemplate,
  columnsTotalWidth,
  effectiveColumnWidth,
  flexColumnKey,
  isCustomized,
  parseStoredColumnWidths,
  resetColumnWidth,
  serializeColumnWidths,
  setColumnWidth,
  widthForKey,
  type ColumnWidthSpec,
} from "./column-widths";

const SPECS: readonly ColumnWidthSpec[] = [
  { key: "nombre", label: "Nombre", defaultWidth: 260, minWidth: 200, maxWidth: 600, grow: true },
  { key: "rol", label: "Rol", defaultWidth: 120, minWidth: 100, maxWidth: 200 },
  {
    key: "acciones",
    label: "Acciones",
    defaultWidth: 232,
    minWidth: 232,
    maxWidth: 232,
    resizable: false,
    grow: true,
  },
];
const NOMBRE = SPECS[0];

describe("clampColumnWidth", () => {
  it.each([
    [150, 200],
    [200, 200],
    [350, 350],
    [600, 600],
    [601, 600],
    [10_000, 600],
    [-50, 200],
    [349.6, 350],
  ])("%s → %s", (input, expected) => {
    expect(clampColumnWidth(NOMBRE, input)).toBe(expected);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "%s no es un ancho: vuelve al default",
    (input) => {
      expect(clampColumnWidth(NOMBRE, input)).toBe(260);
    },
  );
});

describe("parseStoredColumnWidths", () => {
  it.each([
    ["null", null],
    ["vacío", ""],
    ["JSON corrupto", "{nombre: 320"],
    ["texto suelto", "hola"],
    ["arreglo", "[320, 140]"],
    ["número", "42"],
    ["null JSON", "null"],
    ["string JSON", '"320"'],
  ])("%s → nada fijado", (_label, raw) => {
    expect(parseStoredColumnWidths(raw, SPECS)).toEqual({});
  });

  it("aplica lo válido", () => {
    expect(parseStoredColumnWidths('{"nombre":420,"rol":160}', SPECS)).toEqual({
      nombre: 420,
      rol: 160,
    });
  });

  it("los extremos del rango son válidos", () => {
    expect(parseStoredColumnWidths('{"nombre":200,"rol":200}', SPECS)).toEqual({
      nombre: 200,
      rol: 200,
    });
    expect(parseStoredColumnWidths('{"nombre":600,"rol":100}', SPECS)).toEqual({
      nombre: 600,
      rol: 100,
    });
  });

  it("fuera de rango se ignora (no se recorta) y lo válido de al lado se conserva", () => {
    expect(parseStoredColumnWidths('{"nombre":20,"rol":160}', SPECS)).toEqual({ rol: 160 });
    expect(parseStoredColumnWidths('{"nombre":199,"rol":160}', SPECS)).toEqual({ rol: 160 });
    expect(parseStoredColumnWidths('{"nombre":420,"rol":9999}', SPECS)).toEqual({ nombre: 420 });
    expect(parseStoredColumnWidths('{"nombre":420,"rol":201}', SPECS)).toEqual({ nombre: 420 });
  });

  it("valores que no son número se ignoran", () => {
    expect(parseStoredColumnWidths('{"nombre":"420","rol":null,"x":1}', SPECS)).toEqual({});
    expect(parseStoredColumnWidths('{"nombre":{"px":420},"rol":[160]}', SPECS)).toEqual({});
    expect(parseStoredColumnWidths('{"nombre":true}', SPECS)).toEqual({});
  });

  it("columnas desconocidas se ignoran sin colarse en el resultado", () => {
    const parsed = parseStoredColumnWidths(
      '{"fantasma":300,"__proto__":{"rol":1},"rol":140}',
      SPECS,
    );
    expect(parsed).toEqual({ rol: 140 });
    expect(Object.keys(parsed)).toEqual(["rol"]);
  });

  it("una columna fija ignora lo guardado aunque esté en su rango", () => {
    expect(parseStoredColumnWidths('{"acciones":232}', SPECS)).toEqual({});
  });

  it("redondea a px enteros", () => {
    expect(parseStoredColumnWidths('{"nombre":420.4}', SPECS)).toEqual({ nombre: 420 });
  });
});

describe("serializeColumnWidths / isCustomized", () => {
  it("nada fijado → null y no está personalizado", () => {
    expect(serializeColumnWidths(NO_COLUMN_WIDTHS, SPECS)).toBeNull();
    expect(isCustomized(NO_COLUMN_WIDTHS, SPECS)).toBe(false);
  });

  it("guarda lo fijado, aunque coincida con el default, y la ida y vuelta es exacta", () => {
    const w = setColumnWidth(setColumnWidth(NO_COLUMN_WIDTHS, SPECS, "rol", 160), SPECS, "nombre", 260);
    const raw = serializeColumnWidths(w, SPECS);
    expect(raw).toBe('{"nombre":260,"rol":160}');
    expect(isCustomized(w, SPECS)).toBe(true);
    expect(parseStoredColumnWidths(raw, SPECS)).toEqual(w);
  });

  it("no guarda columnas fijas ni desconocidas", () => {
    expect(serializeColumnWidths({ acciones: 999, otra: 50 }, SPECS)).toBeNull();
  });
});

describe("setColumnWidth", () => {
  it("recorta lo que escribe el usuario", () => {
    expect(setColumnWidth(NO_COLUMN_WIDTHS, SPECS, "nombre", 50)).toEqual({ nombre: 200 });
    expect(setColumnWidth(NO_COLUMN_WIDTHS, SPECS, "nombre", 5000)).toEqual({ nombre: 600 });
    expect(setColumnWidth(NO_COLUMN_WIDTHS, SPECS, "nombre", 333.3)).toEqual({ nombre: 333 });
  });

  it("no toca las otras columnas ni muta la entrada", () => {
    const base = { rol: 160 };
    const next = setColumnWidth(base, SPECS, "nombre", 400);
    expect(next).toEqual({ nombre: 400, rol: 160 });
    expect(base).toEqual({ rol: 160 });
  });

  it("columna desconocida o fija: sin cambio", () => {
    expect(setColumnWidth(NO_COLUMN_WIDTHS, SPECS, "fantasma", 400)).toBe(NO_COLUMN_WIDTHS);
    expect(setColumnWidth(NO_COLUMN_WIDTHS, SPECS, "acciones", 400)).toBe(NO_COLUMN_WIDTHS);
  });
});

describe("resetColumnWidth", () => {
  it("una columna vuelve a su default y las demás quedan", () => {
    const w = { nombre: 420, rol: 160 };
    const next = resetColumnWidth(w, "nombre");
    expect(next).toEqual({ rol: 160 });
    expect(effectiveColumnWidth(NOMBRE, next)).toBe(260);
    expect(w).toEqual({ nombre: 420, rol: 160 });
  });

  it("columna que no estaba fijada: sin cambio", () => {
    const w = { rol: 160 };
    expect(resetColumnWidth(w, "nombre")).toBe(w);
  });
});

describe("widthForKey", () => {
  it("las flechas mueven un paso", () => {
    expect(widthForKey(NOMBRE, 300, "ArrowRight")).toBe(300 + COLUMN_WIDTH_STEP);
    expect(widthForKey(NOMBRE, 300, "ArrowLeft")).toBe(300 - COLUMN_WIDTH_STEP);
  });

  it("no se pasa de los extremos", () => {
    expect(widthForKey(NOMBRE, 596, "ArrowRight")).toBe(600);
    expect(widthForKey(NOMBRE, 600, "ArrowRight")).toBe(600);
    expect(widthForKey(NOMBRE, 204, "ArrowLeft")).toBe(200);
    expect(widthForKey(NOMBRE, 200, "ArrowLeft")).toBe(200);
  });

  it("Home y End van al mínimo y al máximo", () => {
    expect(widthForKey(NOMBRE, 300, "Home")).toBe(200);
    expect(widthForKey(NOMBRE, 300, "End")).toBe(600);
  });

  it("otra tecla no es del asa", () => {
    expect(widthForKey(NOMBRE, 300, "Enter")).toBeNull();
    expect(widthForKey(NOMBRE, 300, "ArrowUp")).toBeNull();
    expect(widthForKey(NOMBRE, 300, "Tab")).toBeNull();
  });
});

describe("columnGridTemplate / flexColumnKey / columnsTotalWidth", () => {
  it("sin nada fijado, la primera `grow` absorbe el espacio libre", () => {
    expect(flexColumnKey(SPECS, NO_COLUMN_WIDTHS)).toBe("nombre");
    expect(columnGridTemplate(SPECS, NO_COLUMN_WIDTHS)).toBe(
      "minmax(260px, 1fr) 120px 232px",
    );
  });

  it("al fijarla queda exacta y el espacio libre pasa a la siguiente `grow`", () => {
    const w = { nombre: 420 };
    expect(flexColumnKey(SPECS, w)).toBe("acciones");
    expect(columnGridTemplate(SPECS, w)).toBe("420px 120px minmax(232px, 1fr)");
  });

  it("fijada en su mismo default también queda exacta", () => {
    expect(columnGridTemplate(SPECS, { nombre: 260 })).toBe("260px 120px minmax(232px, 1fr)");
  });

  it("al restablecerla vuelve a crecer", () => {
    expect(columnGridTemplate(SPECS, resetColumnWidth({ nombre: 420 }, "nombre"))).toBe(
      "minmax(260px, 1fr) 120px 232px",
    );
  });

  it("nunca crecen dos a la vez, y sin `grow` todo es exacto", () => {
    for (const w of [NO_COLUMN_WIDTHS, { nombre: 300 }, { nombre: 300, rol: 140 }]) {
      expect(columnGridTemplate(SPECS, w).match(/1fr/g)).toHaveLength(1);
    }
    const sinGrow = SPECS.map((s) => ({ ...s, grow: false }));
    expect(columnGridTemplate(sinGrow, NO_COLUMN_WIDTHS)).toBe("260px 120px 232px");
    expect(flexColumnKey(sinGrow, NO_COLUMN_WIDTHS)).toBeNull();
  });

  it("la suma de anchos en uso es el piso de la tabla", () => {
    expect(columnsTotalWidth(SPECS, { nombre: 420, rol: 160 })).toBe(812);
    expect(columnsTotalWidth(SPECS, NO_COLUMN_WIDTHS)).toBe(612);
  });
});
