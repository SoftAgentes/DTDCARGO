// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { caracasDayBounds, caracasMonthBounds, fechaCaracas, isCalendarDate, validInstant } from "../fechas-caracas";
import { todayCaracasISO } from "@/lib/studio/bitacora/dates";
import { hoyCaracas } from "@/lib/studio/rate-types";

afterEach(() => vi.unstubAllEnvs());
describe("día Caracas · IANA y calendario", () => {
  it.each(["UTC", "America/Caracas", "Asia/Shanghai", "America/Los_Angeles"])("independiente de TZ=%s", tz => {
    vi.stubEnv("TZ", tz);
    for (const [instant, day] of [
      ["2026-10-21T02:30:00Z", "2026-10-20"], ["2026-10-21T03:59:59.999Z", "2026-10-20"],
      ["2026-10-21T04:00:00Z", "2026-10-21"], ["2026-01-01T02:30:00Z", "2025-12-31"],
      ["2024-03-01T02:30:00Z", "2024-02-29"], ["2010-01-01T04:15:00Z", "2009-12-31"],
    ]) {
      expect(fechaCaracas(instant)).toBe(day);
      expect(todayCaracasISO(new Date(instant))).toBe(day);
      expect(hoyCaracas(new Date(instant))).toBe(day);
    }
  });
  it("conserva offset explícito y microsegundos del timestamp sin confundir date-only", () => {
    expect(fechaCaracas("2026-10-20T22:30:00.123456-04:00")).toBe("2026-10-20");
    expect(validInstant("2026-10-21 02:30:00+00:00").toISOString()).toBe("2026-10-21T02:30:00.000Z");
  });
  it.each(["2026-10-20", "2026-02-30T12:00:00Z", "2025-02-29T12:00:00Z", "2026-01-01T24:00:00Z", "2026-01-01T12:00:00", "", "2026-01-01T12:00:00+02:99"])("rechaza instante %j", value => {
    expect(() => fechaCaracas(value)).toThrow(RangeError);
  });
  it("rechaza Invalid Date y valida bisiestos sin normalización", () => {
    expect(() => fechaCaracas(new Date(NaN))).toThrow(RangeError);
    expect(isCalendarDate("2000-02-29")).toBe(true);
    expect(isCalendarDate("1900-02-29")).toBe(false);
    expect(isCalendarDate("0000-01-01")).toBe(false);
    expect(isCalendarDate("2026-04-31")).toBe(false);
  });
  it("límites son inicio incluido/fin excluido y no asumen siempre 24h", () => {
    expect(caracasDayBounds("2026-10-20")).toEqual({ start: "2026-10-20T04:00:00.000Z", end: "2026-10-21T04:00:00.000Z" });
    expect(caracasDayBounds("2010-01-01")).toEqual({ start: "2010-01-01T04:30:00.000Z", end: "2010-01-02T04:30:00.000Z" });
    expect(caracasDayBounds("2016-05-01")).toEqual({ start: "2016-05-01T04:30:00.000Z", end: "2016-05-02T04:00:00.000Z" });
    expect(caracasMonthBounds("2024-02")).toEqual({ start: "2024-02-01T04:00:00.000Z", end: "2024-03-01T04:00:00.000Z" });
    expect(caracasMonthBounds("2025-12")).toEqual({ start: "2025-12-01T04:00:00.000Z", end: "2026-01-01T04:00:00.000Z" });
  });
});
