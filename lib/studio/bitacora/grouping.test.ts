import { describe, it, expect } from "vitest";
import {
  groupTasksByPerson,
  filterEsperandoCliente,
  countEsperandoCliente,
  UNASSIGNED_KEY,
  type PersonGroupable,
} from "./grouping";

function task(
  id: string,
  estado: string,
  userIds: string[],
  extra: Partial<PersonGroupable> = {},
): PersonGroupable {
  return {
    id,
    estado,
    assignees: userIds.map((u) => ({ user_id: u })),
    titulo: extra.titulo ?? id,
    ...extra,
  };
}

describe("groupTasksByPerson", () => {
  const nameByUserId = { u1: "Ana", u2: "Bruno" };

  const tasks: PersonGroupable[] = [
    task("t1", "hecho", ["u2"]),
    task("t2", "pendiente", ["u2"]),
    task("t3", "en_curso", ["u1"]),
    task("t4", "pendiente", []), // sin asignar
    task("t5", "hecho", ["u1"]),
  ];

  it("agrupa por dueño con done/total por persona + global", () => {
    const { groups, globalDone, globalTotal } = groupTasksByPerson(
      tasks,
      nameByUserId,
    );
    expect(globalTotal).toBe(5);
    expect(globalDone).toBe(2);

    const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
    expect(byKey.u1.name).toBe("Ana");
    expect(byKey.u1.total).toBe(2);
    expect(byKey.u1.done).toBe(1);
    expect(byKey.u2.name).toBe("Bruno");
    expect(byKey.u2.total).toBe(2);
    expect(byKey.u2.done).toBe(1);
    expect(byKey[UNASSIGNED_KEY].name).toBe("Sin asignar");
    expect(byKey[UNASSIGNED_KEY].userId).toBeNull();
    expect(byKey[UNASSIGNED_KEY].total).toBe(1);
    expect(byKey[UNASSIGNED_KEY].done).toBe(0);
  });

  it("ordena grupos alfabéticamente y deja 'Sin asignar' al final", () => {
    const { groups } = groupTasksByPerson(tasks, nameByUserId);
    expect(groups.map((g) => g.name)).toEqual(["Ana", "Bruno", "Sin asignar"]);
    expect(groups[groups.length - 1].key).toBe(UNASSIGNED_KEY);
  });

  it("dentro de un grupo, las abiertas van antes que las hechas", () => {
    const { groups } = groupTasksByPerson(tasks, nameByUserId);
    const ana = groups.find((g) => g.key === "u1")!;
    expect(ana.tasks.map((t) => t.id)).toEqual(["t3", "t5"]); // en_curso, luego hecho
  });

  it("nombre cae a 'Usuario' si el user_id no está en el mapa", () => {
    const { groups } = groupTasksByPerson([task("x", "pendiente", ["u9"])], {});
    expect(groups[0].name).toBe("Usuario");
    expect(groups[0].userId).toBe("u9");
  });

  it("lista vacía → sin grupos y global en cero", () => {
    const { groups, globalDone, globalTotal } = groupTasksByPerson([], {});
    expect(groups).toEqual([]);
    expect(globalDone).toBe(0);
    expect(globalTotal).toBe(0);
  });
});

describe("filtro Esperando al cliente", () => {
  const tasks = [
    { id: "a", tipo: "empleado" },
    { id: "b", tipo: "entregable_cliente" },
    { id: "c", tipo: "entregable_cliente" },
    { id: "d", tipo: "empleado" },
  ];

  it("filterEsperandoCliente devuelve solo entregable_cliente", () => {
    expect(filterEsperandoCliente(tasks).map((t) => t.id)).toEqual(["b", "c"]);
  });

  it("countEsperandoCliente cuenta solo entregable_cliente", () => {
    expect(countEsperandoCliente(tasks)).toBe(2);
    expect(countEsperandoCliente([])).toBe(0);
    expect(
      countEsperandoCliente([{ id: "z", tipo: "empleado" }]),
    ).toBe(0);
  });
});
