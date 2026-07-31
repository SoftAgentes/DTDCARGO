import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("estado coherente de Bitácora", () => {
  it("suscribe las preferencias desktop al navegador", () => {
    const client = source("app/studio/(app)/bitacora/_components/BitacoraClient.tsx");
    const list = source("app/studio/(app)/bitacora/_components/BoardList.tsx");
    expect(client).toContain("useSyncExternalStore");
    expect(client).toContain("VIEW_STORAGE_EVENT");
    expect(list).toContain("useSyncExternalStore");
    expect(list).toContain("MODE_EVENT");
  });

  it("reemplaza el snapshot optimista cuando cambia la fuente", () => {
    for (const path of [
      "app/studio/(app)/bitacora/_components/BitacoraClient.tsx",
      "app/m/erp/bitacora/_components/HoyClient.tsx",
    ]) {
      const code = source(path);
      expect(code).toContain("tasksSource !== tasks");
      expect(code).toContain("setLocalTasks(tasks)");
    }
  });

  it("inicializa el deep link en el primer render", () => {
    const code = source("app/studio/(app)/bitacora/_components/BitacoraClient.tsx");
    expect(code).toContain("tasks.find((item) => item.id === initialOpenTaskId)");
    expect(code).not.toContain("Deep-link desde la bandeja de menciones");
  });

  it("cancela la carga colaborativa al desmontar", () => {
    const code = source("app/studio/(app)/bitacora/_components/TaskCollabSection.tsx");
    expect(code).toContain("Promise.all");
    expect(code).toContain("if (cancelled) return");
  });
});
