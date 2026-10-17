/**
 * SDD-0547 · el bot local de deploy ya no promete un deploy de Vercel.
 *
 * Después de subir, el mensaje depende de a dónde fue:
 *  - a `main`: el servidor la publica sola (SDD-0541) y el avance se ve en
 *    /studio/debug, «Publicaciones del servidor»;
 *  - a una rama: no se publica sola; se lleva a producción con una PR.
 * Las server actions y el modal se reemplazan por dobles: acá solo importa el
 * flujo de la pantalla.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { GitPushResult, GitStatusSnapshot } from "@/lib/studio/deploy/types";

const getDeployStatusAction = vi.fn();
const gitPushAction = vi.fn();
vi.mock("../../../(app)/_actions/deployActions", () => ({
  getDeployStatusAction: () => getDeployStatusAction(),
  gitPushAction: (input: unknown) => gitPushAction(input),
}));
vi.mock("../../wiring/ProfileModal", () => ({
  ModalShell: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ),
}));

import { DeployButton } from "../DeployWebBot";

const SNAPSHOT: GitStatusSnapshot = {
  currentBranch: "main",
  hasChanges: true,
  scopeTag: "[studio]",
  pendingFiles: [{ path: "app/studio/x.tsx", status: " M" }],
};

function exito(branch: string): GitPushResult {
  return {
    ok: true,
    branch,
    commitSha: "c2fabdcc17e3ca28c62238764a82aa46ca515cca",
    commitShaShort: "c2fabdc",
    commitMessage: "[studio] wip",
    scopeTag: "[studio]",
    filesChanged: 1,
  };
}

async function subir(destino: "Preview" | "Producción") {
  render(<DeployButton />);
  expect(screen.getByRole("button", { name: /Push/ })).toHaveAttribute(
    "title",
    "Subir cambios pendientes a GitHub",
  );
  fireEvent.click(screen.getByRole("button", { name: /Push/ }));
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(destino) }));
  fireEvent.click(
    screen.getByRole("button", { name: destino === "Producción" ? /Subir a producción/ : /Subir a preview/ }),
  );
  await screen.findByText("Subido a GitHub");
}

beforeEach(() => {
  getDeployStatusAction.mockReset().mockResolvedValue({ ok: true, snapshot: SNAPSHOT });
  gitPushAction.mockReset();
});

describe("DeployWebBot · mensaje después de subir", () => {
  it("a main: lo publica el servidor y el avance está en Publicaciones del servidor", async () => {
    gitPushAction.mockResolvedValue(exito("main"));
    await subir("Producción");
    expect(gitPushAction).toHaveBeenCalledWith({ type: "production", commitMessage: undefined });
    expect(screen.getByText(/el servidor la publica sola en unos 5/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "/studio/debug" })).toHaveAttribute("href", "/studio/debug");
    expect(screen.getByText(/Publicaciones del servidor/)).toBeInTheDocument();
    expect(screen.queryByText(/abre una PR/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/vercel/i);
  });

  it("a una rama: no se publica sola y se pide una PR", async () => {
    gitPushAction.mockResolvedValue(exito("preview/2026-10-17-1340"));
    await subir("Preview");
    expect(gitPushAction).toHaveBeenCalledWith({ type: "preview", commitMessage: undefined });
    expect(screen.getByText(/no se publica sola: para llevarla a\s+producción, abre una PR/)).toBeInTheDocument();
    expect(screen.queryByText(/el servidor la publica sola/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/vercel/i);
  });

  it("el destino Preview ya no promete una URL temporal", async () => {
    render(<DeployButton />);
    fireEvent.click(screen.getByRole("button", { name: /Push/ }));
    const preview = await screen.findByRole("button", { name: /Preview/ });
    expect(preview).toHaveTextContent("rama en GitHub");
    expect(preview).not.toHaveTextContent(/URL temporal/);
  });
});
