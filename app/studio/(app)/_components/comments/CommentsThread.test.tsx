import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/app/studio/_components/ui/ToastProvider";
import type { CommentWithMeta } from "@/lib/studio/comments/types";

const mockRefresh = vi.fn();
const mockDeleteComment = vi.fn();
const mockRestoreComment = vi.fn();
const mockPostComment = vi.fn();
const mockToggleReaction = vi.fn();
const mockEditComment = vi.fn();
const mockListDeletedComments = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));
vi.mock("@/app/studio/_components/ui/usePlatformMod", () => ({
  useIsMac: () => false,
}));
vi.mock("@/app/studio/(app)/_actions/comments", () => ({
  postComment: (...args: unknown[]) => mockPostComment(...args),
  toggleReaction: (...args: unknown[]) => mockToggleReaction(...args),
  editComment: (...args: unknown[]) => mockEditComment(...args),
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  restoreComment: (...args: unknown[]) => mockRestoreComment(...args),
  listDeletedCommentsAction: (...args: unknown[]) =>
    mockListDeletedComments(...args),
}));

import { CommentsThread } from "./CommentsThread";

const CURRENT_USER = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Ana Pérez",
  avatar: "AP",
  role: "Admin",
};

function comment(
  id: string,
  authorId: string,
  authorName: string,
): CommentWithMeta {
  return {
    id,
    tenant_id: "t1",
    entity_type: "shipment",
    entity_id: "30000000-0000-4000-8000-000000000003",
    entity_code: "DTDU-1",
    author_id: authorId,
    body: `Comentario de ${authorName}`,
    parent_id: null,
    edited_at: null,
    created_at: "2026-07-23T12:00:00Z",
    deleted_at: null,
    author: { name: authorName, avatar: "US", role: "Operaciones" },
    reactions: {},
    myReactions: [],
    mentionedUserIds: [],
  };
}

function renderThread(comments: CommentWithMeta[]) {
  render(
    <ToastProvider>
      <CommentsThread
        entityType="shipment"
        entityId="30000000-0000-4000-8000-000000000003"
        entityCode="DTDU-1"
        entityLabel="embarque"
        users={[CURRENT_USER]}
        currentUser={CURRENT_USER}
        initialComments={comments}
        canEditComments
        canModerateComments
        canRestoreComments
      />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  mockDeleteComment.mockResolvedValue({
    ok: true,
    code: "deleted",
    commentId: "c1",
    correlationId: "20000000-0000-4000-8000-000000000002",
    undoExpiresAt: "2026-07-23T12:00:10.000Z",
    undoRemainingMs: 10_000,
  });
  mockRestoreComment.mockResolvedValue({
    ok: true,
    code: "restored",
    commentId: "c1",
  });
  mockListDeletedComments.mockResolvedValue({
    ok: true,
    page: { comments: [], nextCursor: null },
  });
});

afterEach(cleanup);

describe("CommentsThread · ciclo de permanencia", () => {
  it("elimina el comentario propio y ofrece Deshacer sólo tras respuesta durable", async () => {
    renderThread([comment("c1", CURRENT_USER.id, CURRENT_USER.name)]);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar comentario" }));

    await waitFor(() =>
      expect(mockDeleteComment).toHaveBeenCalledWith(
        "c1",
        expect.any(String),
      ),
    );
    expect(screen.getByText("Comentario eliminado.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    await waitFor(() =>
      expect(mockRestoreComment).toHaveBeenCalledWith(
        "c1",
        expect.any(String),
        "20000000-0000-4000-8000-000000000002",
        "undo",
      ),
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("moderar un comentario ajeno exige motivo dentro del diálogo", async () => {
    renderThread([
      comment(
        "c2",
        "40000000-0000-4000-8000-000000000004",
        "Luis Rojas",
      ),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Moderar" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Luis Rojas/)).toBeInTheDocument();
    fireEvent.change(
      within(dialog).getByLabelText("Motivo de moderación"),
      { target: { value: "Contenido duplicado" } },
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Moderar" }));

    await waitFor(() =>
      expect(mockDeleteComment).toHaveBeenCalledWith(
        "c2",
        expect.any(String),
        "Contenido duplicado",
      ),
    );
  });

  it("la recuperación admin permanece colapsada y refresca cada vez que se abre", async () => {
    mockListDeletedComments
      .mockResolvedValueOnce({
        ok: true,
        page: { comments: [], nextCursor: null },
      })
      .mockResolvedValueOnce({
        ok: true,
        page: {
          comments: [
            {
              ...comment("c3", CURRENT_USER.id, CURRENT_USER.name),
              deleted_at: "2026-07-23T12:05:00Z",
              deleted_by: CURRENT_USER.id,
              deletion_mode: "self",
              deletion_reason: null,
              lifecycle_correlation_id:
                "20000000-0000-4000-8000-000000000002",
              last_lifecycle_operation_id:
                "50000000-0000-4000-8000-000000000005",
              lifecycle_contract_version: 1,
              lifecycleState: "deleted_restorable",
            },
          ],
          nextCursor: null,
        },
      });

    renderThread([]);
    expect(mockListDeletedComments).not.toHaveBeenCalled();

    const deletedCommentsButton = screen.getByRole("button", {
      name: "Comentarios eliminados",
    });
    fireEvent.click(deletedCommentsButton);

    await waitFor(() =>
      expect(mockListDeletedComments).toHaveBeenCalledWith(
        "shipment",
        "30000000-0000-4000-8000-000000000003",
        null,
      ),
    );
    expect(
      screen.getByText("No hay comentarios eliminados en este registro."),
    ).toBeInTheDocument();

    fireEvent.click(deletedCommentsButton);
    fireEvent.click(deletedCommentsButton);

    await waitFor(() => expect(mockListDeletedComments).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Comentario de Ana Pérez")).toBeInTheDocument();
  });

  it("devuelve el foco al panel estable después de restaurar", async () => {
    const user = userEvent.setup();
    mockListDeletedComments.mockResolvedValueOnce({
      ok: true,
      page: {
        comments: [
          {
            ...comment("c3", CURRENT_USER.id, CURRENT_USER.name),
            deleted_at: "2026-07-23T12:05:00Z",
            deleted_by: CURRENT_USER.id,
            deletion_mode: "self",
            deletion_reason: null,
            lifecycle_correlation_id:
              "20000000-0000-4000-8000-000000000002",
            last_lifecycle_operation_id:
              "50000000-0000-4000-8000-000000000005",
            lifecycle_contract_version: 1,
            lifecycleState: "deleted_restorable",
          },
        ],
        nextCursor: null,
      },
    });

    renderThread([]);
    const deletedCommentsButton = screen.getByRole("button", {
      name: "Comentarios eliminados",
    });
    await user.click(deletedCommentsButton);
    const restoreButton = await screen.findByRole("button", {
      name: "Restaurar",
    });
    await user.click(restoreButton);
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Restaurar" }));

    await waitFor(() =>
      expect(mockRestoreComment).toHaveBeenCalledWith(
        "c3",
        expect.any(String),
        "20000000-0000-4000-8000-000000000002",
        "ordinary",
        undefined,
      ),
    );
    await waitFor(() => expect(deletedCommentsButton).toHaveFocus());
  });
});
