import { describe, expect, it } from "vitest";
import {
  COMMENT_EXCEPTIONAL_RESTORE_WINDOW_MS,
  COMMENT_ORDINARY_RESTORE_WINDOW_MS,
  COMMENT_UNDO_WINDOW_MS,
  deriveCommentLifecycleState,
  parseCommentLifecycleResult,
  restoreModeForState,
} from "../lifecycle-types";

const NOW = Date.parse("2026-07-23T12:00:00.000Z");

function ago(milliseconds: number): string {
  return new Date(NOW - milliseconds).toISOString();
}

describe("ciclo de permanencia de comentarios", () => {
  it("clasifica exactamente los bordes de 10 s, 30 días y 90 días", () => {
    expect(deriveCommentLifecycleState(null, NOW)).toBe("active");
    expect(deriveCommentLifecycleState(ago(COMMENT_UNDO_WINDOW_MS), NOW)).toBe(
      "deleted_undoable",
    );
    expect(
      deriveCommentLifecycleState(ago(COMMENT_UNDO_WINDOW_MS + 1), NOW),
    ).toBe("deleted_restorable");
    expect(
      deriveCommentLifecycleState(
        ago(COMMENT_ORDINARY_RESTORE_WINDOW_MS),
        NOW,
      ),
    ).toBe("deleted_restorable");
    expect(
      deriveCommentLifecycleState(
        ago(COMMENT_ORDINARY_RESTORE_WINDOW_MS + 1),
        NOW,
      ),
    ).toBe("deleted_exceptional");
    expect(
      deriveCommentLifecycleState(
        ago(COMMENT_EXCEPTIONAL_RESTORE_WINDOW_MS),
        NOW,
      ),
    ).toBe("deleted_exceptional");
    expect(
      deriveCommentLifecycleState(
        ago(COMMENT_EXCEPTIONAL_RESTORE_WINDOW_MS + 1),
        NOW,
      ),
    ).toBe("retained_not_ordinary_restorable");
  });

  it("mapea ventanas visibles a modo de restauración sin habilitar >90 días", () => {
    expect(restoreModeForState("deleted_undoable")).toBe("ordinary");
    expect(restoreModeForState("deleted_restorable")).toBe("ordinary");
    expect(restoreModeForState("deleted_exceptional")).toBe("exceptional");
    expect(restoreModeForState("retained_not_ordinary_restorable")).toBeNull();
  });

  it("normaliza la respuesta de la RPC sin filtrar detalles internos", () => {
    expect(
      parseCommentLifecycleResult({
        ok: true,
        code: "deleted",
        comment_id: "c1",
        correlation_id: "corr",
        undo_expires_at: "2026-07-23T12:00:10Z",
      }),
    ).toMatchObject({
      ok: true,
      code: "deleted",
      commentId: "c1",
      correlationId: "corr",
    });
    expect(
      parseCommentLifecycleResult({ ok: false, code: "not_allowed" }),
    ).toMatchObject({
      ok: false,
      error: "No tienes permiso para realizar esta acción.",
    });
  });
});
