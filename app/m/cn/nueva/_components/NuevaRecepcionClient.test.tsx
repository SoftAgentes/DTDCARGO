import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../actions", () => ({
  createReceiptFromOperarioAction: vi.fn(async () => ({})),
}));

vi.mock("../photo-actions", () => ({
  uploadReceiptPhotoAction: vi.fn(async () => ({ ok: true })),
}));

import { NuevaRecepcionClient } from "./NuevaRecepcionClient";

describe("NuevaRecepcionClient — seguridad React del flujo de fotos", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("permite seleccionar dos veces el mismo archivo con un id estable", async () => {
    const { container } = render(
      <NuevaRecepcionClient
        initialLang="es"
        clients={[]}
        cities={[]}
        defaultWarehouseId="warehouse-cn"
      />,
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    const inputId = input?.id;
    const photo = new File(["foto"], "caja.jpg", { type: "image/jpeg" });

    fireEvent.change(input!, { target: { files: [photo] } });
    const rerenderedInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(rerenderedInput?.id).toBe(inputId);
    fireEvent.change(rerenderedInput!, { target: { files: [photo] } });

    expect(screen.getAllByRole("button", { name: /quitar foto/i })).toHaveLength(2);
  });

  it("captura las fotos al enviar y no muta la ref durante render", () => {
    const source = readFileSync(resolve(__dirname, "NuevaRecepcionClient.tsx"), "utf8");
    const submitStart = source.indexOf("const submit = () => {");
    const snapshot = source.indexOf("photosRef.current = reception.photos", submitStart);
    const action = source.indexOf("startTransition(() => formAction(fd))", submitStart);
    const step4 = source.slice(
      source.indexOf("function Step4Confirm"),
      source.indexOf("function SummaryRow"),
    );

    expect(source.match(/photosRef\.current = reception\.photos/g)).toHaveLength(1);
    expect(snapshot).toBeGreaterThan(submitStart);
    expect(snapshot).toBeLessThan(action);
    expect(source).toContain("const inputId = useId();");
    expect(step4).not.toContain("clients");
  });
});
