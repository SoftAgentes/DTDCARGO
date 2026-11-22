import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BitacoraTask } from "@/lib/studio/bitacora/bitacora-queries";
import { BoardKanban } from "./BoardKanban";

afterEach(cleanup);

const task: BitacoraTask = {
  id: "task-1",
  tenant_id: "tenant-1",
  meeting_id: null,
  titulo: "Revisar documentos",
  descripcion: null,
  estado: "pendiente",
  prioridad: "alta",
  tipo: "empleado",
  assigned_role: null,
  para_agente: false,
  client_id: null,
  responsable_nombre: null,
  due_date: null,
  orden: 0,
  completed_at: null,
  created_by: "user-1",
  created_at: "2026-07-31T12:00:00Z",
  updated_at: "2026-07-31T12:00:00Z",
  assignees: [],
  checklist: [],
};

function renderBoard(onMove = vi.fn()) {
  render(
    <BoardKanban
      tasks={[task]}
      nameByUserId={{}}
      canEdit
      hoyISO="2026-07-31"
      onMove={onMove}
      onOpen={() => {}}
    />,
  );
  return onMove;
}

describe("BoardKanban · DND-01", () => {
  it("permite elegir cualquier destino con teclado/touch sin arrastrar", async () => {
    const user = userEvent.setup();
    const onMove = renderBoard();
    const selector = screen.getByRole("combobox", {
      name: "Mover Revisar documentos a otro estado",
    });
    await user.selectOptions(selector, "hecho");
    expect(onMove).toHaveBeenCalledWith("task-1", "hecho", "pendiente");
  });

  it("mantiene un control de apertura independiente del drag", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <BoardKanban
        tasks={[task]}
        nameByUserId={{}}
        canEdit
        hoyISO="2026-07-31"
        onMove={() => {}}
        onOpen={onOpen}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Abrir tarea Revisar documentos" }),
    );
    expect(onOpen).toHaveBeenCalledWith(task);
  });

  it("anuncia pickup y muestra placeholders de destinos válidos", () => {
    renderBoard();
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
    };
    const card = screen
      .getByRole("button", { name: "Abrir tarea Revisar documentos" })
      .closest("article");
    expect(card).not.toBeNull();
    fireEvent.dragStart(card!, { dataTransfer });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Levantaste Revisar documentos",
    );
    expect(screen.getByTestId("drop-placeholder-en_curso")).toBeVisible();
    expect(screen.getByTestId("drop-placeholder-en_revision")).toBeVisible();
    expect(screen.getByTestId("drop-placeholder-hecho")).toBeVisible();
    expect(screen.queryByTestId("drop-placeholder-pendiente")).toBeNull();
  });

  it("el drop conserva el estado de origen para la escritura condicional", () => {
    const onMove = renderBoard();
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
    };
    const card = screen
      .getByRole("button", { name: "Abrir tarea Revisar documentos" })
      .closest("article");
    fireEvent.dragStart(card!, { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "Columna Hecho" }), {
      dataTransfer,
    });
    expect(onMove).toHaveBeenCalledWith("task-1", "hecho", "pendiente");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Moviendo Revisar documentos a Hecho",
    );
  });
});

describe("BoardKanban · pie de la tarjeta angosta", () => {
  it("el pie y su grupo de datos parten en líneas en vez de enciman textos", () => {
    renderBoard();
    const selector = screen.getByRole("combobox", {
      name: "Mover Revisar documentos a otro estado",
    });
    const pie = selector.closest("label")!.parentElement as HTMLElement;
    expect(pie.style.flexWrap).toBe("wrap");
    const datos = pie.firstElementChild as HTMLElement;
    expect(datos.style.flexWrap).toBe("wrap");
    expect(datos.textContent).toContain("Sin asignar");
    // El selector baja a su propia línea cuando no cabe y se alinea a la derecha.
    expect(selector.closest("label")!.style.marginLeft).toBe("auto");
  });
});
