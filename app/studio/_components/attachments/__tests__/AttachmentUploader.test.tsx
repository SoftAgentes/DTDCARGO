import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const add = vi.fn().mockResolvedValue(undefined);
vi.mock("../useAttachmentUpload", () => ({
  useAttachmentUpload: () => ({ records: [], progress: {}, add, retry: vi.fn(), dismissCompleted: vi.fn() }),
}));

describe("AttachmentUploader", () => {
  it("expone un selector etiquetado y envía el archivo a la cola", async () => {
    const { AttachmentUploader } = await import("../AttachmentUploader");
    const rendered = render(<AttachmentUploader ownerKey="t:u" entityId="e" />);
    expect(screen.getByText("Comprobante protegido")).toBeInTheDocument();
    const input = rendered.container.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["%PDF"], "factura.pdf", { type: "application/pdf" })] } });
    expect(add).toHaveBeenCalledTimes(1);
  });
});
