import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const put = vi.fn();
vi.mock("../attachment-queue", () => ({
  listQueuedAttachments: vi.fn().mockResolvedValue([]),
  reconcileInterruptedAttachments: vi.fn().mockResolvedValue([]),
  putQueuedAttachment: put,
  patchQueuedAttachment: vi.fn(),
  removeCompletedAttachment: vi.fn(),
}));
vi.mock("@uppy/core", () => ({ Uppy: vi.fn() }));
vi.mock("@uppy/tus", () => ({ default: vi.fn() }));

describe("useAttachmentUpload", () => {
  beforeEach(() => put.mockReset());
  it("rechaza antes de persistir un archivo fuera de política", async () => {
    const { useAttachmentUpload } = await import("../useAttachmentUpload");
    const { result } = renderHook(() => useAttachmentUpload({ ownerKey: "t:u", entityId: "e" }));
    await act(async () => {
      await expect(result.current.add(new File(["x"], "x.svg", { type: "image/svg+xml" }))).rejects.toThrow("Formato");
    });
    expect(put).not.toHaveBeenCalled();
  });
});
