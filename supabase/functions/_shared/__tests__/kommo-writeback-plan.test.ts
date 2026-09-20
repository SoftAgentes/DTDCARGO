// @vitest-environment node
/**
 * SDD-0256 · Fases 4 y 5 — contratos del drenaje de la outbox.
 *
 * Cada `it` de acá se corrió contra la versión SIN el arreglo y salió ROJO; el
 * detalle de qué se mutó está en el comentario de cada bloque. Un test que sólo
 * ejercita la versión buena no prueba que la vieja estuviera mal — es la
 * categoría de error más repetida del repo (5 casos, cero mecanismo).
 */

import { describe, it, expect } from "vitest";
import {
  esOpReintentable,
  evaluarChequeoOptimista,
  parseIsoASegundos,
  resolveRequest,
  type OutboxRow,
} from "../kommo-writeback-plan";

const fila = (over: Partial<OutboxRow> = {}): OutboxRow => ({
  id: "row-1",
  kommo_lead_id: 4242,
  kommo_contact_id: null,
  op: "patch_stage",
  payload: {},
  kommo_updated_at_at_enqueue: null,
  ...over,
});

// ── B1 · método por op ──────────────────────────────────────────────────────
//
// MUTACIÓN QUE LO VALIDA: devolver `method: "PATCH"` fijo en `resolveRequest`
// (que es exactamente lo que hacía `kommo-writeback/index.ts:166`). Los dos
// casos POST se ponen rojos; los PATCH siguen verdes — o sea, el test
// discrimina la versión vieja de la nueva y no sólo "ejercita la buena".
describe("resolveRequest · el método se deriva de la op", () => {
  it("patch_stage va PATCH al lead, como objeto", () => {
    const r = resolveRequest(fila({ op: "patch_stage" }));
    expect(r).toEqual({
      path: "/api/v4/leads/4242",
      method: "PATCH",
      envolverEnArray: false,
    });
  });

  it("add_note va POST a /notes del lead, envuelto en array", () => {
    const r = resolveRequest(fila({ op: "add_note" }));
    expect(r).toEqual({
      path: "/api/v4/leads/4242/notes",
      method: "POST",
      envolverEnArray: true,
    });
  });

  it("add_task va POST a la colección global (el lead viaja en el cuerpo)", () => {
    const r = resolveRequest(fila({ op: "add_task" }));
    expect(r).toEqual({
      path: "/api/v4/tasks",
      method: "POST",
      envolverEnArray: true,
    });
  });

  it("patch_contact va al contacto, no al lead", () => {
    const r = resolveRequest(
      fila({ op: "patch_contact", kommo_lead_id: null, kommo_contact_id: 77 }),
    );
    expect(r).toEqual({
      path: "/api/v4/contacts/77",
      method: "PATCH",
      envolverEnArray: false,
    });
  });

  it("sin destino se saltea en vez de pegarle a /leads/null", () => {
    expect(resolveRequest(fila({ op: "add_note", kommo_lead_id: null }))).toEqual({
      skip: "add_note sin kommo_lead_id",
    });
    expect(
      resolveRequest(fila({ op: "patch_contact", kommo_contact_id: null })),
    ).toEqual({ skip: "patch_contact sin kommo_contact_id" });
  });
});

// ── B3 · un POST se intenta UNA vez ─────────────────────────────────────────
//
// MUTACIÓN QUE LO VALIDA: hacer que `esOpReintentable` devuelva `true` siempre
// (el default permisivo que uno escribiría sin pensarlo). Los dos casos POST se
// ponen rojos.
describe("esOpReintentable · falla cerrado", () => {
  it("los PATCH se reintentan", () => {
    for (const op of ["patch_price", "patch_stage", "patch_lead", "patch_contact", "patch_owner", "patch_tags"]) {
      expect(esOpReintentable(op)).toBe(true);
    }
  });

  it("los POST NO se reintentan — repetirlos crea otra nota / otra tarea", () => {
    expect(esOpReintentable("add_note")).toBe(false);
    expect(esOpReintentable("add_task")).toBe(false);
  });

  it("una op que nadie declaró tampoco se reintenta (default cerrado)", () => {
    expect(esOpReintentable("op_que_alguien_agregue_manana")).toBe(false);
  });
});

// ── A1 · chequeo optimista ──────────────────────────────────────────────────
//
// MUTACIÓN QUE LO VALIDA: devolver `{ pisar: true }` incondicionalmente al tope
// de `evaluarChequeoOptimista` — que es literalmente el comportamiento de hoy
// (la columna se guarda y nadie la lee). El caso "cambió en Kommo" se pone rojo.
// Segunda mutación, sobre el falso positivo: borrar la rama del eco; el caso
// "el cambio lo causamos nosotros" se pone rojo.
describe("evaluarChequeoOptimista", () => {
  const T0 = "2026-08-14T12:00:00.000Z";
  const t0 = parseIsoASegundos(T0)!;

  it("nada cambió desde que se encoló → se manda", () => {
    expect(
      evaluarChequeoOptimista({
        op: "patch_stage",
        enqueuedAt: T0,
        liveUpdatedAt: t0,
        echoUpdatedAt: null,
      }),
    ).toEqual({ pisar: true });
  });

  it("el asesor lo movió en Kommo después de encolarse → NO se pisa", () => {
    const v = evaluarChequeoOptimista({
      op: "patch_stage",
      enqueuedAt: T0,
      liveUpdatedAt: t0 + 120,
      echoUpdatedAt: null,
    });
    expect(v.pisar).toBe(false);
    if (v.pisar === false) {
      // El motivo tiene que ser legible: lo lee un asesor en la pantalla, no un
      // ingeniero en un log.
      expect(v.motivo).toContain("cambió en el CRM");
      expect(v.motivo).toContain("no se pisó");
    }
  });

  it("el cambio lo causamos NOSOTROS (eco de un write-back propio) → se manda", () => {
    // Sin esta rama, mover de etapa y etiquetar seguido —antes de que vuelva el
    // webhook— saltearía la segunda orden por un cambio propio.
    expect(
      evaluarChequeoOptimista({
        op: "patch_stage",
        enqueuedAt: T0,
        liveUpdatedAt: t0 + 300,
        echoUpdatedAt: t0 + 300,
      }),
    ).toEqual({ pisar: true });
  });

  it("un eco viejo NO tapa un cambio ajeno posterior", () => {
    expect(
      evaluarChequeoOptimista({
        op: "patch_stage",
        enqueuedAt: T0,
        liveUpdatedAt: t0 + 300,
        echoUpdatedAt: t0 + 100,
      }).pisar,
    ).toBe(false);
  });

  it("tolera 1 s de desfase de reloj", () => {
    expect(
      evaluarChequeoOptimista({
        op: "patch_stage",
        enqueuedAt: T0,
        liveUpdatedAt: t0 + 1,
        echoUpdatedAt: null,
      }),
    ).toEqual({ pisar: true });
  });

  it("fail-open: sin snapshot, sin lectura viva o con fecha ilegible, se manda", () => {
    const base = { op: "patch_stage", echoUpdatedAt: null } as const;
    expect(
      evaluarChequeoOptimista({ ...base, enqueuedAt: null, liveUpdatedAt: t0 + 999 }),
    ).toEqual({ pisar: true });
    expect(
      evaluarChequeoOptimista({ ...base, enqueuedAt: T0, liveUpdatedAt: null }),
    ).toEqual({ pisar: true });
    expect(
      evaluarChequeoOptimista({ ...base, enqueuedAt: "no es una fecha", liveUpdatedAt: t0 + 999 }),
    ).toEqual({ pisar: true });
    expect(
      evaluarChequeoOptimista({ ...base, enqueuedAt: T0, liveUpdatedAt: 0 }),
    ).toEqual({ pisar: true });
  });

  it("un POST nunca se saltea por el chequeo: agregar una nota no pisa nada", () => {
    expect(
      evaluarChequeoOptimista({
        op: "add_note",
        enqueuedAt: T0,
        liveUpdatedAt: t0 + 9999,
        echoUpdatedAt: null,
      }),
    ).toEqual({ pisar: true });
  });

  it("patch_contact tampoco: su snapshot sería de otro lead", () => {
    expect(
      evaluarChequeoOptimista({
        op: "patch_contact",
        enqueuedAt: T0,
        liveUpdatedAt: t0 + 9999,
        echoUpdatedAt: null,
      }),
    ).toEqual({ pisar: true });
  });
});

// Los payloads de nota y tarea se arman del lado del ERP (donde se encolan) y
// se prueban en `lib/studio/__tests__/kommo-writeback.test.ts`. Acá sólo se
// decide a dónde van y si se mandan.
