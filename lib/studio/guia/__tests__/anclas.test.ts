/**
 * SDD-0589 · paso 9.5 · cada ancla de Studio de un recorrido existe en la pantalla
 * que dice el recorrido. Las de Chatwoot (9.4) las cubre el archivo de selectores.
 *
 * Es un contrato sobre el código fuente: busca el atributo `data-guia` con el
 * nombre del ancla en los archivos de la pantalla. Exige un piso de anclas
 * revisadas y tiene su mutante, para que una lista vacía no dé verde.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SELECTORES_CHATWOOT } from "../puente-chatwoot";
import { ANCLA_MARCO_BANDEJA, PASO_QUITAR_ACCESO, RECORRIDOS } from "../recorridos";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const leer = (ruta: string) => readFileSync(resolve(ROOT, ruta), "utf8");

/** Archivos donde vive cada recorrido. */
const PANTALLAS: Record<string, string[]> = {
  dashboard: ["app/studio/(app)/dashboard/page.tsx", "app/studio/(app)/dashboard/_components/DashboardClient.tsx"],
  bandeja: ["app/studio/(app)/bandeja/_components/BandejaClient.tsx", "app/studio/(app)/bandeja/_components/VinculosAdmin.tsx"],
  embudo: ["app/studio/(app)/crm/_components/CrmTableroKanban.tsx"],
  cliente: ["app/studio/(app)/clientes/_components/ChatwootConversacionesCard.tsx"],
  actualizaciones: ["app/studio/(app)/admin/actualizaciones/_components/ActualizacionesPanel.tsx"],
};

/** El ancla aparece como `data-guia="x"` o como literal dentro de `data-guia={…}`. */
function anclaEnFuente(fuente: string, ancla: string): boolean {
  const literal = ancla.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`data-guia=(?:"${literal}"|\\{[^}]*"${literal}"[^}]*\\})`).test(fuente);
}

const deChatwoot = (ancla: string) => Object.hasOwn(SELECTORES_CHATWOOT.anclas, ancla);

describe("anclas de Studio en sus pantallas", () => {
  it("cada recorrido del catálogo dice en qué archivos vive", () => {
    expect(Object.keys(PANTALLAS).sort()).toEqual(RECORRIDOS.map((r) => r.id).sort());
  });

  it("cada ancla de Studio (y cada respaldo) está en la pantalla de su recorrido", () => {
    let revisadas = 0;
    for (const r of RECORRIDOS) {
      const fuente = PANTALLAS[r.id].map(leer).join("\n");
      const anclas = new Set<string>();
      for (const p of r.pasos) {
        if (!deChatwoot(p.ancla)) anclas.add(p.ancla);
        if (p.respaldo) anclas.add(p.respaldo);
      }
      for (const ancla of anclas) {
        expect(anclaEnFuente(fuente, ancla), `${r.id}: falta data-guia="${ancla}"`).toBe(true);
        revisadas += 1;
      }
    }
    // Dashboard 4, Bandeja 2 (el marco y U1), Embudo 4, Cliente 1 y Actualizaciones 3.
    expect(revisadas).toBeGreaterThanOrEqual(14);
  });

  it("U1 está en Vínculos, que BandejaClient solo monta con datos de admin", () => {
    const vinculos = leer("app/studio/(app)/bandeja/_components/VinculosAdmin.tsx");
    expect(anclaEnFuente(vinculos, "usuarios.acceso-bandeja")).toBe(true);
    expect(anclaEnFuente(leer("app/studio/(app)/bandeja/_components/BandejaClient.tsx"), "usuarios.acceso-bandeja")).toBe(false);
  });

  it("U3 tiene su ancla en la ficha de la persona, sin recorrido hasta la 9.6", () => {
    const ficha = leer("app/studio/(app)/usuarios/_components/UserDetailDrawer.tsx");
    expect(anclaEnFuente(ficha, PASO_QUITAR_ACCESO.ancla)).toBe(true);
    // El ancla va en el botón Suspender acceso, no en otro de la ficha.
    expect(ficha).toMatch(/data-guia="usuarios\.baja"\s*>\s*\{disablePending \? "Suspendiendo…" : "Suspender acceso"\}/);
    // La tarjeta (capa 90) quedaría debajo del cajón (capa 100): ningún recorrido la usa todavía.
    expect(RECORRIDOS.flatMap((r) => r.pasos).some((p) => p.ancla === PASO_QUITAR_ACCESO.ancla)).toBe(false);
  });

  it("los pasos de Chatwoot tienen su selector y caen al marco de la Bandeja", () => {
    const deChat = RECORRIDOS.flatMap((r) => r.pasos).filter((p) => deChatwoot(p.ancla));
    expect(deChat.length).toBe(Object.keys(SELECTORES_CHATWOOT.anclas).length);
    for (const p of deChat) expect(p.respaldo, p.id).toBe(ANCLA_MARCO_BANDEJA);
  });

  it("mutante: si se quita el atributo, el contrato lo ve", () => {
    const fuente = leer("app/studio/(app)/crm/_components/CrmTableroKanban.tsx");
    expect(anclaEnFuente(fuente, "embudo.columna-entrada")).toBe(true);
    expect(anclaEnFuente(fuente.replace('"embudo.columna-entrada"', '"embudo.otra"'), "embudo.columna-entrada")).toBe(false);
    expect(anclaEnFuente('data-guia="embudo.tablero-x"', "embudo.tablero")).toBe(false);
    expect(anclaEnFuente("const x = \"embudo.tablero\";", "embudo.tablero")).toBe(false);
  });
});
