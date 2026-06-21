/**
 * Tests del motor puro de la Academia DTD (SDD-0093, Slice B).
 *
 * Cubre los criterios de aceptación de la capa de datos:
 *  - Regla de aprobación: attended/sessions ≥ 0.75 (bordes + sin NaN).
 *  - countAttended / attendanceRatio.
 *  - buildDiplomaFolio: formato DTD-AC-{YYYY}-{seq4} + padding + reintento.
 *  - validateCohortInput: nombre requerido, sesiones ≥ 1, horas no negativas,
 *    fecha ISO, modalidad/estado válidos, normalización de vacíos a null.
 *  - validateEnrollmentInput: nombre requerido, cohorte requerida, correo válido,
 *    markbox opcional.
 *  - labels/tones de cohort status + modality.
 */

import { describe, it, expect } from "vitest";
import {
  APPROVAL_THRESHOLD,
  attendanceRatio,
  buildDiplomaFolio,
  cohortStatusLabel,
  cohortStatusTone,
  COHORT_MODALITIES,
  COHORT_STATUSES,
  countAttended,
  DIPLOMA_VARIANTS,
  isApproved,
  LESSON_KINDS,
  LESSON_WIDGETS,
  lessonWidgetLabel,
  modalityLabel,
  pickDiplomaVariant,
  validateCohortInput,
  validateCourseInput,
  validateEnrollmentInput,
  validateLessonInput,
  validateModuleInput,
} from "../types";

// ── Regla de aprobación ──────────────────────────────────────

describe("countAttended", () => {
  it("cuenta solo los true", () => {
    expect(countAttended([true, false, true, true])).toBe(3);
    expect(countAttended([false, false])).toBe(0);
    expect(countAttended([])).toBe(0);
  });
});

describe("attendanceRatio / isApproved (≥75%)", () => {
  it("el umbral es 0.75", () => {
    expect(APPROVAL_THRESHOLD).toBe(0.75);
  });

  it("3 de 4 = 75% aprueba (borde exacto)", () => {
    expect(attendanceRatio(3, 4)).toBe(0.75);
    expect(isApproved(3, 4)).toBe(true);
  });

  it("2 de 4 = 50% no aprueba", () => {
    expect(isApproved(2, 4)).toBe(false);
  });

  it("4 de 4 = 100% aprueba", () => {
    expect(isApproved(4, 4)).toBe(true);
  });

  it("1 de 1 aprueba; 0 de 1 no", () => {
    expect(isApproved(1, 1)).toBe(true);
    expect(isApproved(0, 1)).toBe(false);
  });

  it("sessions 0 → ratio 0 y no aprueba (sin NaN, sin división por cero)", () => {
    expect(attendanceRatio(0, 0)).toBe(0);
    expect(Number.isNaN(attendanceRatio(0, 0))).toBe(false);
    expect(isApproved(0, 0)).toBe(false);
  });

  it("ejemplo del Norte: 4 sesiones, asistencias mixtas", () => {
    // María 3/4 aprueba; José 2/4 no.
    expect(isApproved(countAttended([true, true, true, false]), 4)).toBe(true);
    expect(isApproved(countAttended([true, true, false, false]), 4)).toBe(false);
  });
});

// ── Folio del diploma ────────────────────────────────────────

describe("buildDiplomaFolio", () => {
  it("formato DTD-AC-{YYYY}-{seq4} con padding a 4", () => {
    expect(buildDiplomaFolio(2026, 1)).toBe("DTD-AC-2026-0001");
    expect(buildDiplomaFolio(2026, 42)).toBe("DTD-AC-2026-0042");
    expect(buildDiplomaFolio(2026, 1234)).toBe("DTD-AC-2026-1234");
  });

  it("seq grande no se trunca a 4 dígitos", () => {
    expect(buildDiplomaFolio(2026, 12345)).toBe("DTD-AC-2026-12345");
  });

  it("seq < 1 se eleva a 1 (nunca 0000)", () => {
    expect(buildDiplomaFolio(2026, 0)).toBe("DTD-AC-2026-0001");
    expect(buildDiplomaFolio(2026, -5)).toBe("DTD-AC-2026-0001");
  });

  it("el reintento (seq+attempt) produce folios distintos y monótonos", () => {
    const base = 7;
    const f0 = buildDiplomaFolio(2026, base + 0);
    const f1 = buildDiplomaFolio(2026, base + 1);
    expect(f0).toBe("DTD-AC-2026-0007");
    expect(f1).toBe("DTD-AC-2026-0008");
    expect(f0).not.toBe(f1);
  });
});

// ── validateCohortInput ──────────────────────────────────────

describe("validateCohortInput", () => {
  it("acepta una cohorte válida y normaliza vacíos a null", () => {
    const { input, fieldErrors } = validateCohortInput({
      courseId: "  ",
      name: "  Asesoría China · Jun 2026 ",
      sessions: 4,
      hours: 16,
      modality: "presencial",
      place: " Valencia ",
      startsAt: "2026-06-20",
      facilitatorName: "  ",
      status: "en_curso",
    });
    expect(fieldErrors).toBeNull();
    expect(input?.name).toBe("Asesoría China · Jun 2026");
    expect(input?.courseId).toBeNull();
    expect(input?.facilitatorName).toBeNull();
    expect(input?.place).toBe("Valencia");
    expect(input?.sessions).toBe(4);
    expect(input?.hours).toBe(16);
    expect(input?.startsAt).toBe("2026-06-20");
  });

  it("nombre vacío → fieldError", () => {
    const { input, fieldErrors } = validateCohortInput({ name: "   " });
    expect(input).toBeNull();
    expect(fieldErrors?.name).toBeTruthy();
  });

  it("sesiones < 1 → fieldError", () => {
    const { fieldErrors } = validateCohortInput({ name: "X", sessions: 0 });
    expect(fieldErrors?.sessions).toBeTruthy();
  });

  it("sesiones por defecto = 1 cuando no viene", () => {
    const { input } = validateCohortInput({ name: "X" });
    expect(input?.sessions).toBe(1);
  });

  it("sesiones decimales se truncan a entero", () => {
    const { input } = validateCohortInput({ name: "X", sessions: 3.9 });
    expect(input?.sessions).toBe(3);
  });

  it("horas negativas → fieldError", () => {
    const { fieldErrors } = validateCohortInput({ name: "X", hours: -2 });
    expect(fieldErrors?.hours).toBeTruthy();
  });

  it("horas omitidas → null", () => {
    const { input } = validateCohortInput({ name: "X" });
    expect(input?.hours).toBeNull();
  });

  it("fecha no-ISO → fieldError", () => {
    const { fieldErrors } = validateCohortInput({ name: "X", startsAt: "20/06/2026" });
    expect(fieldErrors?.startsAt).toBeTruthy();
  });

  it("modalidad inválida → fieldError", () => {
    const { fieldErrors } = validateCohortInput({
      name: "X",
      modality: "hibrida" as never,
    });
    expect(fieldErrors?.modality).toBeTruthy();
  });

  it("estado inválido → fieldError", () => {
    const { fieldErrors } = validateCohortInput({
      name: "X",
      status: "cancelada" as never,
    });
    expect(fieldErrors?.status).toBeTruthy();
  });

  it("conserva el course_id cuando viene", () => {
    const { input } = validateCohortInput({
      name: "X",
      courseId: "11111111-1111-1111-1111-111111111111",
    });
    expect(input?.courseId).toBe("11111111-1111-1111-1111-111111111111");
  });
});

// ── validateEnrollmentInput ──────────────────────────────────

describe("validateEnrollmentInput", () => {
  it("acepta un inscrito válido y normaliza vacíos a null", () => {
    const { input, fieldErrors } = validateEnrollmentInput({
      cohortId: "c-1",
      studentName: "  María Fernanda  ",
      studentCi: " V-18.452.110 ",
      studentEmail: "  maria@correo.com ",
      clientMarkbox: "  DTD-1234 ",
    });
    expect(fieldErrors).toBeNull();
    expect(input?.studentName).toBe("María Fernanda");
    expect(input?.studentCi).toBe("V-18.452.110");
    expect(input?.studentEmail).toBe("maria@correo.com");
    expect(input?.clientMarkbox).toBe("DTD-1234");
  });

  it("nombre vacío → fieldError", () => {
    const { input, fieldErrors } = validateEnrollmentInput({
      cohortId: "c-1",
      studentName: "  ",
    });
    expect(input).toBeNull();
    expect(fieldErrors?.studentName).toBeTruthy();
  });

  it("cohorte faltante → fieldError", () => {
    const { fieldErrors } = validateEnrollmentInput({ studentName: "Ana" });
    expect(fieldErrors?.cohortId).toBeTruthy();
  });

  it("correo inválido → fieldError", () => {
    const { fieldErrors } = validateEnrollmentInput({
      cohortId: "c-1",
      studentName: "Ana",
      studentEmail: "no-es-correo",
    });
    expect(fieldErrors?.studentEmail).toBeTruthy();
  });

  it("correo y markbox son opcionales (null si vacíos)", () => {
    const { input, fieldErrors } = validateEnrollmentInput({
      cohortId: "c-1",
      studentName: "Ana",
    });
    expect(fieldErrors).toBeNull();
    expect(input?.studentEmail).toBeNull();
    expect(input?.clientMarkbox).toBeNull();
  });
});

// ── labels / tones ───────────────────────────────────────────

describe("labels y tones de cohorte", () => {
  it("COHORT_STATUSES / COHORT_MODALITIES son los del CHECK de la migración", () => {
    expect([...COHORT_STATUSES]).toEqual(["proximamente", "en_curso", "completado"]);
    expect([...COHORT_MODALITIES]).toEqual(["presencial", "online"]);
  });

  it("cohortStatusLabel cubre los 3 estados", () => {
    expect(cohortStatusLabel("proximamente")).toBe("Próximamente");
    expect(cohortStatusLabel("en_curso")).toBe("En curso");
    expect(cohortStatusLabel("completado")).toBe("Completado");
  });

  it("cohortStatusTone devuelve tonos del sistema", () => {
    expect(cohortStatusTone("proximamente")).toBe("neutral");
    expect(cohortStatusTone("en_curso")).toBe("wine");
    expect(cohortStatusTone("completado")).toBe("success");
  });

  it("modalityLabel", () => {
    expect(modalityLabel("presencial")).toBe("Presencial");
    expect(modalityLabel("online")).toBe("Online");
  });
});

// ── validateCourseInput (Feature A) ──────────────────────────

describe("validateCourseInput", () => {
  it("acepta un curso válido y normaliza vacíos a null", () => {
    const { input, fieldErrors } = validateCourseInput({
      title: "  Domina Yiwu  ",
      slug: " domina-yiwu ",
      tier: "inicial",
      level: "  Principiante ",
      summary: "  El que nunca ha importado  ",
      status: "publicado",
    });
    expect(fieldErrors).toBeNull();
    expect(input?.title).toBe("Domina Yiwu");
    expect(input?.slug).toBe("domina-yiwu");
    expect(input?.level).toBe("Principiante");
    expect(input?.summary).toBe("El que nunca ha importado");
    expect(input?.status).toBe("publicado");
  });

  it("título vacío → fieldError", () => {
    const { input, fieldErrors } = validateCourseInput({ title: "   " });
    expect(input).toBeNull();
    expect(fieldErrors?.title).toBeTruthy();
  });

  it("deriva el slug del título cuando falta", () => {
    const { input, fieldErrors } = validateCourseInput({
      title: "De 0 a Contenedor en 4 Semanas",
    });
    expect(fieldErrors).toBeNull();
    expect(input?.slug).toBe("de-0-a-contenedor-en-4-semanas");
  });

  it("slug con mayúsculas/espacios/acentos (no kebab) → fieldError", () => {
    const { input, fieldErrors } = validateCourseInput({
      title: "X",
      slug: "Domina Yiwu",
    });
    expect(input).toBeNull();
    expect(fieldErrors?.slug).toBeTruthy();
  });

  it("slug con guion al borde no es válido", () => {
    expect(validateCourseInput({ title: "X", slug: "-yiwu" }).fieldErrors?.slug).toBeTruthy();
    expect(validateCourseInput({ title: "X", slug: "yiwu-" }).fieldErrors?.slug).toBeTruthy();
    expect(validateCourseInput({ title: "X", slug: "a--b" }).fieldErrors?.slug).toBeTruthy();
  });

  it("tier inválido → fieldError", () => {
    const { fieldErrors } = validateCourseInput({
      title: "X",
      tier: "premium" as never,
    });
    expect(fieldErrors?.tier).toBeTruthy();
  });

  it("estado inválido → fieldError", () => {
    const { fieldErrors } = validateCourseInput({
      title: "X",
      status: "archivado" as never,
    });
    expect(fieldErrors?.status).toBeTruthy();
  });

  it("level y summary omitidos → null", () => {
    const { input } = validateCourseInput({ title: "X" });
    expect(input?.level).toBeNull();
    expect(input?.summary).toBeNull();
  });
});

// ── validateModuleInput (Feature A) ──────────────────────────

describe("validateModuleInput", () => {
  it("acepta un módulo válido", () => {
    const { input, fieldErrors } = validateModuleInput({
      courseId: "c-1",
      title: "  Encuentra tu producto ",
      sort: 2,
    });
    expect(fieldErrors).toBeNull();
    expect(input?.title).toBe("Encuentra tu producto");
    expect(input?.sort).toBe(2);
    expect(input?.courseId).toBe("c-1");
  });

  it("título vacío → fieldError", () => {
    const { input, fieldErrors } = validateModuleInput({ courseId: "c-1", title: " " });
    expect(input).toBeNull();
    expect(fieldErrors?.title).toBeTruthy();
  });

  it("curso faltante → fieldError", () => {
    const { fieldErrors } = validateModuleInput({ title: "M" });
    expect(fieldErrors?.courseId).toBeTruthy();
  });

  it("sort vacío/NaN → 0; negativo → 0; decimal se trunca", () => {
    expect(validateModuleInput({ courseId: "c", title: "M" }).input?.sort).toBe(0);
    expect(validateModuleInput({ courseId: "c", title: "M", sort: -3 }).input?.sort).toBe(0);
    expect(validateModuleInput({ courseId: "c", title: "M", sort: 4.8 }).input?.sort).toBe(4);
  });
});

// ── validateLessonInput (Feature A) ──────────────────────────

describe("validateLessonInput", () => {
  it("acepta una lección válida y normaliza", () => {
    const { input, fieldErrors } = validateLessonInput({
      moduleId: "m-1",
      courseId: "c-1",
      title: "  Leer una ficha en 1688 ",
      kind: "video",
      videoUrl: "  https://youtu.be/x ",
      durationMin: 12,
      freePreview: true,
      widget: "alibaba_address",
      status: "publicado",
      sort: 3,
    });
    expect(fieldErrors).toBeNull();
    expect(input?.title).toBe("Leer una ficha en 1688");
    expect(input?.videoUrl).toBe("https://youtu.be/x");
    expect(input?.durationMin).toBe(12);
    expect(input?.freePreview).toBe(true);
    expect(input?.widget).toBe("alibaba_address");
    expect(input?.status).toBe("publicado");
    expect(input?.sort).toBe(3);
  });

  it("módulo o curso faltante → fieldError", () => {
    expect(validateLessonInput({ courseId: "c", title: "L" }).fieldErrors?.moduleId).toBeTruthy();
    expect(validateLessonInput({ moduleId: "m", title: "L" }).fieldErrors?.courseId).toBeTruthy();
  });

  it("título vacío → fieldError", () => {
    const { fieldErrors } = validateLessonInput({ moduleId: "m", courseId: "c", title: " " });
    expect(fieldErrors?.title).toBeTruthy();
  });

  it("kind inválido → fieldError", () => {
    const { fieldErrors } = validateLessonInput({
      moduleId: "m",
      courseId: "c",
      title: "L",
      kind: "pdf" as never,
    });
    expect(fieldErrors?.kind).toBeTruthy();
  });

  it("widget inválido → fieldError; vacío → null", () => {
    expect(
      validateLessonInput({
        moduleId: "m",
        courseId: "c",
        title: "L",
        widget: "calculadora" as never,
      }).fieldErrors?.widget,
    ).toBeTruthy();
    const { input } = validateLessonInput({ moduleId: "m", courseId: "c", title: "L" });
    expect(input?.widget).toBeNull();
  });

  it("duración negativa → fieldError; omitida → null", () => {
    expect(
      validateLessonInput({ moduleId: "m", courseId: "c", title: "L", durationMin: -1 })
        .fieldErrors?.durationMin,
    ).toBeTruthy();
    expect(
      validateLessonInput({ moduleId: "m", courseId: "c", title: "L" }).input?.durationMin,
    ).toBeNull();
  });

  it("freePreview default false; widget whitelist y kinds reflejan la migración", () => {
    const { input } = validateLessonInput({ moduleId: "m", courseId: "c", title: "L" });
    expect(input?.freePreview).toBe(false);
    expect([...LESSON_KINDS]).toEqual(["video", "texto", "descarga", "quiz"]);
    expect([...LESSON_WIDGETS]).toEqual(["alibaba_address"]);
  });

  it("lessonWidgetLabel: null = Ninguna; alibaba_address = etiqueta", () => {
    expect(lessonWidgetLabel(null)).toBe("Ninguna");
    expect(lessonWidgetLabel("alibaba_address")).toContain("Alibaba");
  });
});

// ── pickDiplomaVariant (Feature B) ───────────────────────────

describe("pickDiplomaVariant", () => {
  it("siempre devuelve una de las 4 variantes (A/B/C/D)", () => {
    for (let i = 0; i < 200; i++) {
      const folio = `DTD-AC-2026-${String(i).padStart(4, "0")}`;
      expect(DIPLOMA_VARIANTS).toContain(pickDiplomaVariant(folio));
    }
  });

  it("es estable: mismo folio → misma variante", () => {
    const folio = "DTD-AC-2026-0042";
    expect(pickDiplomaVariant(folio)).toBe(pickDiplomaVariant(folio));
  });

  it("string vacío no rompe (cae en la primera variante)", () => {
    expect(DIPLOMA_VARIANTS).toContain(pickDiplomaVariant(""));
  });

  it("reparte entre varias variantes (no colapsa a una sola)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(pickDiplomaVariant(`DTD-AC-2026-${i}`));
    expect(seen.size).toBeGreaterThan(1);
  });
});
