/**
 * /studio/admin/oficina-virtual/vista · La mini-vista del cable (SDD-0626 §3.6, Paso 4): la bandera, la cola, los eventos y la
 * bitácora, SOLO LECTURA. Maqueta de la V3: sin botones, sin formularios y sin acciones.
 *
 * - Nace APAGADA: sin `OFICINA_VISTA_ACTIVA` la página no existe (404), también para el superadministrador.
 * - SOLO para el superadministrador (`is_platform_admin`): el layout de `/studio/admin/oficina-virtual` corta con `notFound()`,
 *   y `leerMiniVista` lo vuelve a preguntar a la base ANTES de crear el cliente de servicio (las 4 tablas solo las lee
 *   `service_role`, 0541). Sin ese «sí», aquí también es un 404.
 * - Todo va como texto plano: React lo escapa; no hay HTML ni Markdown renderizado. No muestra el borrador ni el texto
 *   del cliente: eso vive en la revisión, con su propio candado en la base.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { vistaActiva } from "@/lib/studio/oficina/config";
import { configDespachador } from "@/lib/studio/oficina/despachador-config";
import {
  ESTADOS_EVENTO,
  ESTADOS_TAREA,
  LIMITES,
  type CambioDePausa,
  leerMiniVista,
} from "@/lib/studio/oficina/mini-vista";
import { isPlatformAdmin } from "@/lib/studio/platform-admin";
import { requireModuleView } from "@/lib/studio/rbac-guard";

export const metadata = { title: "Oficina_Virtual · mini-vista" };
export const dynamic = "force-dynamic";

const parrafo: React.CSSProperties = { font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "0 0 12px", maxWidth: "76ch" };
const caja: React.CSSProperties = {
  background: "var(--bg-surface)",
  color: "var(--ink)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "var(--s-4, 16px)",
  marginBottom: "var(--s-4, 16px)",
};
const marco: React.CSSProperties = { ...caja, padding: 0, overflowX: "auto" };
const tabla: React.CSSProperties = { width: "100%", borderCollapse: "collapse", font: "400 13px/1.4 var(--f-sans)", color: "var(--ink)" };
const th: React.CSSProperties = {
  textAlign: "left",
  font: "600 12px/1.3 var(--f-sans)",
  color: "var(--ink-soft)",
  padding: "8px 12px",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = { padding: "8px 12px", borderBottom: "1px solid var(--border)", verticalAlign: "top", overflowWrap: "anywhere" };
const mono: React.CSSProperties = { ...td, font: "400 12px/1.4 var(--f-mono)", whiteSpace: "nowrap" };
const titulo2: React.CSSProperties = { fontSize: 20, margin: "24px 0 8px", color: "var(--ink)" };

/** `2026-11-18T10:42:08.123456+00:00` → `2026-11-18 10:42:08` (UTC, como lo guarda la base). */
const hora = (iso: string): string => iso.slice(0, 19).replace("T", " ");
const corto = (id: string | null): string => (id ? id.slice(0, 8) : "—");
const cuenta = (n: number | null): string => (n === null ? "?" : String(n));
const usd = (n: number): string => n.toFixed(4);

function resumenPorEstado<E extends string>(estados: readonly E[], porEstado: Record<E, number | null>): string {
  return estados.map((e) => `${e}: ${cuenta(porEstado[e])}`).join(" · ");
}

function FilaDePausa({ c }: { c: CambioDePausa }) {
  return (
    <tr>
      <td style={mono}>{hora(c.cambiadoEn)}</td>
      <td style={td}>{c.pausada ? "Pausada" : "Despausada"}</td>
      <td style={mono}>{c.quien}</td>
      <td style={td}>{c.motivo}</td>
    </tr>
  );
}

export default async function OficinaMiniVistaPage() {
  // SDD-0624: el gate va también en la página (el layout no se vuelve a ejecutar en la navegación parcial).
  await requireModuleView("admin");
  if (!vistaActiva()) notFound();
  const supabase = await createClient();
  const vista = await leerMiniVista({ esAdmin: () => isPlatformAdmin(supabase), crearAdmin: createAdminClient });
  if (!vista.ok && vista.motivo === "sin_permiso") notFound();

  const tope = configDespachador().topeMensualUsd;

  return (
    <div style={{ maxWidth: 1080 }}>
      <Link href="/studio/admin/oficina-virtual" style={{ font: "500 12px/1 var(--f-sans)", color: "var(--ink-soft)", textDecoration: "none" }}>
        ← Volver a la revisión de borradores
      </Link>
      <span className="studio-eyebrow" style={{ display: "block", marginTop: 12 }}>
        <span style={{ textTransform: "none" }}>Oficina_Virtual</span> · SDD-0626 · Paso 4
      </span>
      <h1 className="studio-display" style={{ fontSize: 30, margin: "8px 0", color: "var(--ink)" }}>
        Mini-vista del cable
      </h1>
      <p style={parrafo}>
        Lo que hay ahora en las tablas del cable. Solo lectura: desde aquí no se cambia nada. Las horas están en UTC. Para
        ver lo último, recarga la página.
      </p>

      {!vista.ok ? (
        <p role="status" style={caja}>
          {vista.motivo === "sin_migracion"
            ? "Faltan las tablas del cable en esta base (migración 0541): todavía no hay nada que mostrar."
            : "No se pudo leer el cable. Intenta de nuevo."}
        </p>
      ) : (
        <>
          <h2 className="studio-display" style={titulo2}>
            La bandera
          </h2>
          <div style={caja}>
            <p style={{ margin: 0, font: "600 16px/1.3 var(--f-sans)" }} data-testid="vista-bandera">
              {vista.datos.pausa.vigente === null
                ? "Sin registro de pausa: la Oficina_Virtual se trata como pausada."
                : vista.datos.pausa.vigente.pausada
                  ? "La Oficina_Virtual está PAUSADA."
                  : "La Oficina_Virtual está DESPAUSADA."}
            </p>
            <p style={{ ...parrafo, margin: "8px 0 0" }}>
              Gasto del mes: {vista.datos.gastoMesUsd === null ? "?" : usd(vista.datos.gastoMesUsd)} USD de un tope de{" "}
              {usd(tope)} USD. Al llegar al 80 % la Oficina_Virtual se pausa sola.
            </p>
          </div>
          <div style={marco}>
            <table style={tabla}>
              <caption style={{ ...parrafo, textAlign: "left", padding: "8px 12px 0", margin: 0 }}>
                Los últimos {LIMITES.pausa} cambios de la pausa, del más nuevo al más viejo.
              </caption>
              <thead>
                <tr>
                  <th style={th}>Cuándo</th>
                  <th style={th}>Quedó</th>
                  <th style={th}>Quién</th>
                  <th style={th}>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {vista.datos.pausa.historial.map((c, i) => (
                  <FilaDePausa key={`${c.cambiadoEn}-${i}`} c={c} />
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="studio-display" style={titulo2}>
            La cola
          </h2>
          <p style={parrafo}>
            Tareas por estado: {resumenPorEstado(ESTADOS_TAREA, vista.datos.cola.porEstado)}. Abajo, las últimas{" "}
            {LIMITES.cola}.
          </p>
          {vista.datos.cola.filas.length === 0 ? (
            <p style={caja}>No hay tareas.</p>
          ) : (
            <div style={marco}>
              <table style={tabla}>
                <thead>
                  <tr>
                    <th style={th}>Creada</th>
                    <th style={th}>Tarea</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Prioridad</th>
                    <th style={th}>Asignada a</th>
                    <th style={th}>Conversación</th>
                    <th style={th}>Título</th>
                  </tr>
                </thead>
                <tbody>
                  {vista.datos.cola.filas.map((t) => (
                    <tr key={t.id}>
                      <td style={mono}>{hora(t.creadoEn)}</td>
                      <td style={mono}>{corto(t.id)}</td>
                      <td style={td}>{t.estado}</td>
                      <td style={td}>{t.prioridad}</td>
                      <td style={mono}>{t.asignadoA ?? "—"}</td>
                      <td style={td}>{t.conversacion ?? "—"}</td>
                      <td style={td}>{t.titulo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="studio-display" style={titulo2}>
            Los eventos
          </h2>
          <p style={parrafo}>
            Eventos por estado: {resumenPorEstado(ESTADOS_EVENTO, vista.datos.eventos.porEstado)}. Abajo, los últimos{" "}
            {LIMITES.eventos}. La referencia dice dónde está el mensaje; el texto no se guarda aquí.
          </p>
          {vista.datos.eventos.filas.length === 0 ? (
            <p style={caja}>No hay eventos.</p>
          ) : (
            <div style={marco}>
              <table style={tabla}>
                <thead>
                  <tr>
                    <th style={th}>Llegó</th>
                    <th style={th}>Tipo</th>
                    <th style={th}>Origen</th>
                    <th style={th}>Prioridad</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {vista.datos.eventos.filas.map((e) => (
                    <tr key={e.id}>
                      <td style={mono}>{hora(e.ts)}</td>
                      <td style={td}>{e.tipo}</td>
                      <td style={td}>{e.origen}</td>
                      <td style={td}>{e.prioridad}</td>
                      <td style={td}>{e.estado}</td>
                      <td style={{ ...mono, whiteSpace: "normal" }}>{e.payloadRef ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="studio-display" style={titulo2}>
            La bitácora
          </h2>
          <p style={parrafo}>
            Los últimos {LIMITES.bitacora} pasos, del más nuevo al más viejo. El resumen se vacía a los 90 días; lo demás
            queda.
          </p>
          {vista.datos.bitacora.filas.length === 0 ? (
            <p style={caja}>No hay pasos anotados.</p>
          ) : (
            <div style={marco}>
              <table style={tabla}>
                <thead>
                  <tr>
                    <th style={th}>Cuándo</th>
                    <th style={th}>Tarea</th>
                    <th style={th}>Corrida</th>
                    <th style={th}>Paso</th>
                    <th style={th}>Quién</th>
                    <th style={th}>Modelo</th>
                    <th style={th}>Costo (USD)</th>
                    <th style={th}>Resumen</th>
                  </tr>
                </thead>
                <tbody>
                  {vista.datos.bitacora.filas.map((p) => (
                    <tr key={p.id}>
                      <td style={mono}>{hora(p.ts)}</td>
                      <td style={mono}>{corto(p.taskId)}</td>
                      <td style={mono}>{corto(p.runId)}</td>
                      <td style={td}>{p.tipo}</td>
                      <td style={mono}>{p.actor}</td>
                      <td style={td}>{p.modelo ?? "—"}</td>
                      <td style={mono}>{usd(p.costoUsd)}</td>
                      <td style={td}>{p.resumen ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
