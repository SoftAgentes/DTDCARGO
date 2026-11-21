"use client";

/**
 * PermissionsSection — matriz «Roles y permisos» (SDD-0124 → SDD-0252: matriz
 * editable en DB → SDD-0635 §3.8: legible y con alcance a la vista).
 *
 * Qué cambió con la 0635 (pedido de Sam, 2026-11-15):
 *   - La tabla vive en un contenedor con alto y desplazamiento propios: la fila
 *     de roles queda fija arriba, la columna de módulos a la izquierda y la fila
 *     del grupo debajo de los roles mientras dura su sección. Al desplazar, los
 *     bordes fijos proyectan `--shadow-sticky-top` / `--shadow-sticky-left`
 *     (BD-070). La leyenda va en el pie fijo, siempre a la vista.
 *   - Cada celda dice el nivel con ícono + palabra («Ver y editar», «Solo ver»,
 *     «Sin acceso», «Todo»); en pantallas angostas, «Edita · Ve · No · Todo».
 *     Nada de siglas («V·E» se leía como «B y E»).
 *   - Sin «desvío del default» ni ×: la celda cambiada dice «Cambiado» y su
 *     panel explica lo de fábrica y ofrece «Volver a lo de fábrica».
 *   - Sin ciclo ciego al clic: cada celda abre `PermisoCeldaPanel`, que nombra a
 *     las personas afectadas y solo guarda con «Aplicar a las N».
 *
 * Lo que NO cambia: las acciones (`setRoleModuleAccessAction` /
 * `resetRoleModuleAccessAction`) y sus candados. Celdas fijas (dinero ∪
 * admin-only, `LOCKED_MODULES`) y la columna `admin` no abren panel: el candado
 * real vive en el RPC y en un CHECK de la tabla. `support` nunca edita.
 *
 * Se conserva del 2026-08-07 (feedback del founder): el cambio se nota con el
 * destello de la celda (`.studio-permcell-flash`) y un toast que lo NOMBRA.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { MODULES, type Group } from "@/lib/studio/modules";
import { LOCKED_MODULES, canAccessModule, canEditModule, type RoleModuleOverrides } from "@/lib/studio/rbac";
import { AREA_LABEL } from "@/lib/studio/user-module-grants";
import type { UserModuleGrantView } from "@/lib/studio/user-module-grants-queries";
import { STUDIO_USER_ROLES, ROLE_LABELS, type StudioUserRole, type UserMembershipWithProfile } from "@/lib/studio/user-types";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { resetRoleModuleAccessAction, setRoleModuleAccessAction } from "../actions";
import { NIVEL_ROL_LABEL, PermisoCeldaPanel, personasTxt, type NivelRol } from "./PermisoCeldaPanel";

const GROUP_ORDER: Group[] = ["OPERACIÓN", "COMERCIAL", "FINANZAS", "MARKETING", "SISTEMA"];

type Nivel = NivelRol | "all";

/** Nivel de una celda. Sin `overrides` = lo de fábrica (default de código). */
export function nivelCelda(role: StudioUserRole, moduleId: string, overrides?: RoleModuleOverrides): Nivel {
  if (role === "admin") return "all";
  if (!canAccessModule(role, moduleId, overrides)) return "none";
  return canEditModule(role, moduleId, overrides) ? "edit" : "view";
}

const NIVEL_CORTO: Record<Nivel, string> = { edit: "Edita", view: "Ve", none: "No", all: "Todo" };

function IconoNivel({ n }: { n: Nivel }) {
  const p = { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, "aria-hidden": true } as const;
  if (n === "edit")
    return (
      <svg {...p}>
        <path d="M10.5 2.5l3 3L5.5 13.5H2.5v-3z" />
      </svg>
    );
  if (n === "view")
    return (
      <svg {...p}>
        <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z" />
        <circle cx="8" cy="8" r="2" />
      </svg>
    );
  if (n === "all")
    return (
      <svg {...p}>
        <path d="M8 1.5l5 2v4c0 3.2-2.2 5.6-5 7-2.8-1.4-5-3.8-5-7v-4z" />
      </svg>
    );
  return (
    <svg {...p}>
      <path d="M4 8h8" />
    </svg>
  );
}

function Candado() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

/** Contenido de una celda: ícono + palabra (larga y corta; el CSS elige). */
function NivelTxt({ n }: { n: Nivel }) {
  return (
    <>
      <IconoNivel n={n} />
      <span className="studio-mx-w">{NIVEL_ROL_LABEL[n]}</span>
      <span className="studio-mx-ws" aria-hidden>
        {NIVEL_CORTO[n]}
      </span>
    </>
  );
}

/** Mensaje del toast — nombra el cambio y a cuántas personas toca. */
function describeChange(role: StudioUserRole, moduleLabel: string, next: NivelRol, personas: number): string {
  return `${ROLE_LABELS[role]}: ${moduleLabel} ahora en «${NIVEL_ROL_LABEL[next]}» para ${personasTxt(personas)}.`;
}

/** Si la acción lanza (red caída, sesión vencida), la celda vuelve y se dice. */
const ERROR_RED = "No se pudo guardar el cambio. Revisa tu conexión e intenta de nuevo.";

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function PermissionsSection({
  initialOverrides = {},
  members = [],
  grants = [],
  nombres = {},
}: {
  initialOverrides?: RoleModuleOverrides;
  /** Personas ACTIVAS del tenant: para «N personas» y nombrar a quiénes cambia. */
  members?: UserMembershipWithProfile[];
  /** Extras del tenant: para avisar quién ya tiene el módulo como extra. */
  grants?: UserModuleGrantView[];
  nombres?: Record<string, string>;
}) {
  const [overrides, setOverrides] = useState<RoleModuleOverrides>(initialOverrides);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [justSavedKey, setJustSavedKey] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [soloCambiados, setSoloCambiados] = useState(false);
  const [sombra, setSombra] = useState({ x: false, y: false });
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Al desmontar se cancela el destello pendiente: sin esto, el setState de los
  // 700 ms corre sobre un componente ya desmontado (y en las pruebas, sin window).
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);
  const wrapRef = useRef<HTMLDivElement>(null);
  const celdas = useRef(new Map<string, HTMLButtonElement>());
  const [, startTransition] = useTransition();
  const toast = useToast();

  const personasDe = (r: StudioUserRole) =>
    members.filter((m) => m.role === r).map((m) => nombres[m.user_id] ?? m.email);
  const conExtraDe = (r: StudioUserRole, moduleId: string) => {
    const delRol = new Set(members.filter((m) => m.role === r).map((m) => m.user_id));
    return grants
      .filter((g) => g.moduleId === moduleId && !g.expired && delRol.has(g.userId))
      .map((g) => ({ nombre: nombres[g.userId] ?? "una persona", edita: g.canEdit }));
  };

  const cambiada = (r: StudioUserRole, moduleId: string) =>
    r !== "admin" && !LOCKED_MODULES.has(moduleId) && nivelCelda(r, moduleId, overrides) !== nivelCelda(r, moduleId);
  /** Hay un desvío guardado que hoy da lo mismo que fábrica: se ve y se puede limpiar. */
  const igualAFabrica = (r: StudioUserRole, moduleId: string) =>
    r !== "admin" && !LOCKED_MODULES.has(moduleId) && `${r}:${moduleId}` in overrides && !cambiada(r, moduleId);
  const conDesvio = (r: StudioUserRole, moduleId: string) => cambiada(r, moduleId) || igualAFabrica(r, moduleId);
  const nCambiadas = MODULES.reduce((n, m) => n + STUDIO_USER_ROLES.filter((r) => conDesvio(r, m.id)).length, 0);

  const q = normalizar(busqueda.trim());
  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    total: MODULES.filter((m) => m.group === g).length,
    items: MODULES.filter((m) => m.group === g)
      .filter((m) => !q || normalizar(m.label).includes(q))
      .filter((m) => !soloCambiados || STUDIO_USER_ROLES.some((r) => conDesvio(r, m.id))),
  })).filter((x) => x.items.length > 0);

  const flash = (key: string) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setJustSavedKey(key);
    flashTimer.current = setTimeout(() => setJustSavedKey(null), 700);
  };

  const cerrar = useCallback(() => {
    setAbierta((k) => {
      if (k) queueMicrotask(() => celdas.current.get(k)?.focus({ preventScroll: true }));
      return null;
    });
  }, []);

  // Alto real de la fila de roles: la fila del grupo se pega justo debajo,
  // aunque un rol ocupe dos líneas (sin un número fijo que la tape).
  useEffect(() => {
    const w = wrapRef.current;
    const head = w?.querySelector("thead");
    if (!w || !head) return;
    const medir = () => w.style.setProperty("--mx-head-h", `${Math.ceil(head.getBoundingClientRect().height)}px`);
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(head);
    return () => ro.disconnect();
  }, []);

  // El panel es fijo en la ventana: si la tabla o la página se desplazan, o la
  // ventana cambia de tamaño, quedaría lejos de su celda. Se cierra y el foco
  // vuelve a la celda.
  useEffect(() => {
    if (!abierta) return;
    function onMover(e: Event) {
      const t = e.target;
      if (t instanceof Node && document.querySelector(".studio-mx-pop")?.contains(t)) return;
      cerrar();
    }
    window.addEventListener("scroll", onMover, true);
    window.addEventListener("resize", onMover);
    return () => {
      window.removeEventListener("scroll", onMover, true);
      window.removeEventListener("resize", onMover);
    };
  }, [abierta, cerrar]);

  // Esc cierra el panel y devuelve el foco a la celda.
  useEffect(() => {
    if (!abierta) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      cerrar();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [abierta, cerrar]);

  function onScroll() {
    const w = wrapRef.current;
    if (!w) return;
    const s = { x: w.scrollLeft > 0, y: w.scrollTop > 0 };
    if (s.x !== sombra.x || s.y !== sombra.y) setSombra(s);
  }

  function aplicar(role: StudioUserRole, moduleId: string, moduleLabel: string, next: NivelRol) {
    const key = `${role}:${moduleId}`;
    if (pendingKey) return;
    const fabrica = nivelCelda(role, moduleId);
    // Elegir lo de fábrica limpia el desvío en vez de guardar uno igual.
    if (next === fabrica) {
      volverAFabrica(role, moduleId, moduleLabel);
      return;
    }
    const n = personasDe(role).length;
    const valor = { view: next !== "none", edit: next === "edit" };
    setPendingKey(key);
    const previous = overrides;
    setOverrides({ ...overrides, [key]: valor });
    startTransition(async () => {
      let res: { error?: string };
      try {
        res = await setRoleModuleAccessAction(role, moduleId, valor.view, valor.edit);
      } catch {
        res = { error: ERROR_RED };
      }
      setPendingKey(null);
      if (res.error) {
        setOverrides(previous);
        toast.error(res.error);
        return;
      }
      cerrar();
      flash(key);
      toast.success(describeChange(role, moduleLabel, next, n));
    });
  }

  function volverAFabrica(role: StudioUserRole, moduleId: string, moduleLabel: string) {
    const key = `${role}:${moduleId}`;
    if (pendingKey) return;
    const n = personasDe(role).length;
    setPendingKey(key);
    const previous = overrides;
    const rest = { ...overrides };
    delete rest[key];
    setOverrides(rest);
    startTransition(async () => {
      let res: { error?: string };
      try {
        res = await resetRoleModuleAccessAction(role, moduleId);
      } catch {
        res = { error: ERROR_RED };
      }
      setPendingKey(null);
      if (res.error) {
        setOverrides(previous);
        toast.error(res.error);
        return;
      }
      cerrar();
      flash(key);
      toast.success(`${moduleLabel} volvió a lo de fábrica para ${ROLE_LABELS[role]} (${personasTxt(n)}).`);
    });
  }

  const [rolAbierto, modAbierto] = abierta ? (abierta.split(":") as [StudioUserRole, string]) : [null, null];
  const modDef = modAbierto ? MODULES.find((m) => m.id === modAbierto) : null;

  return (
    <div className="studio-mx-page">
      <div className="studio-mx-head">
        <div className="studio-mx-band" role="note">
          <span className="studio-mx-band-ic" aria-hidden>
            !
          </span>
          <p>
            <b>Esta tabla cambia a todas las personas de cada rol.</b> Para darle algo a <b>una sola persona</b>, abre su
            ficha › Acceso (accesos extra).
          </p>
        </div>
        <div className="studio-mx-tools">
          <label className="studio-mx-search">
            <span className="sr-only">Buscar módulo</span>
            <input
              className="studio-input"
              type="search"
              placeholder="Buscar módulo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="perm-filter"
            aria-pressed={soloCambiados}
            onClick={() => setSoloCambiados(!soloCambiados)}
          >
            Solo los cambiados <span className="perm-filter-n">{nCambiadas}</span>
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="studio-mx-wrap"
        data-x={sombra.x ? "true" : undefined}
        data-y={sombra.y ? "true" : undefined}
        tabIndex={0}
        role="region"
        aria-label="Tabla de permisos por rol. Se desplaza en ambos sentidos."
        onScroll={onScroll}
      >
        <table className="studio-mx">
          <caption className="sr-only">Permisos por rol y módulo. Toca una celda para cambiarla para todo el rol.</caption>
          <thead>
            <tr>
              <th scope="col">Módulo</th>
              {STUDIO_USER_ROLES.map((r) => (
                <th key={r} scope="col">
                  <span className="studio-mx-rn">{ROLE_LABELS[r]}</span>
                  <span className="studio-mx-rc">{r === "admin" ? "ve y edita todo" : personasTxt(personasDe(r).length)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 && (
              <tr>
                <td colSpan={1 + STUDIO_USER_ROLES.length} className="studio-mx-vacio">
                  {soloCambiados && !q ? "Ninguna celda está cambiada: todo está como viene de fábrica." : "Ningún módulo coincide."}
                </td>
              </tr>
            )}
            {grouped.map(({ group, total, items }) => (
              <GroupRows
                key={group}
                group={group}
                total={total}
                items={items}
                overrides={overrides}
                pendingKey={pendingKey}
                justSavedKey={justSavedKey}
                abierta={abierta}
                celdas={celdas.current}
                onAbrir={(key) => setAbierta(abierta === key ? null : key)}
              />
            ))}
          </tbody>
        </table>
        <div className="studio-mx-legend" role="note" aria-label="Leyenda">
          {(["edit", "view", "none"] as const).map((n) => (
            <span key={n} className="studio-mx-lg">
              <span className="studio-mx-st" data-n={n}>
                <NivelTxt n={n} />
              </span>
              <span className="studio-mx-lg-long">= {NIVEL_ROL_LABEL[n]}</span>
            </span>
          ))}
          <span className="studio-mx-lg">
            <span className="studio-mx-st" data-n="all">
              <NivelTxt n="all" />
            </span>
            solo Administración
          </span>
          <span className="studio-mx-lg">
            <span className="studio-mx-dot" aria-hidden />
            Cambiado: distinto a lo de fábrica
          </span>
          <span className="studio-mx-lg">
            <Candado /> Fijo: dinero y administración no se cambian aquí
          </span>
          <span className="studio-mx-lg studio-mx-lg-end">
            Toca una celda para cambiarla para <b>todo el rol</b>
          </span>
        </div>
      </div>

      {abierta && rolAbierto && modDef && (
        <PermisoCeldaPanel
          key={abierta}
          role={rolAbierto}
          moduleLabel={modDef.label}
          fabrica={nivelCelda(rolAbierto, modDef.id) as NivelRol}
          actual={nivelCelda(rolAbierto, modDef.id, overrides) as NivelRol}
          cambiado={cambiada(rolAbierto, modDef.id)}
          igualAFabrica={igualAFabrica(rolAbierto, modDef.id)}
          personas={personasDe(rolAbierto)}
          conExtra={conExtraDe(rolAbierto, modDef.id)}
          pending={pendingKey === abierta}
          anchor={celdas.current.get(abierta) ?? null}
          onAplicar={(n) => aplicar(rolAbierto, modDef.id, modDef.label, n)}
          onFabrica={() => volverAFabrica(rolAbierto, modDef.id, modDef.label)}
          onCerrar={cerrar}
        />
      )}
    </div>
  );
}

function GroupRows({
  group,
  total,
  items,
  overrides,
  pendingKey,
  justSavedKey,
  abierta,
  celdas,
  onAbrir,
}: {
  group: Group;
  total: number;
  items: typeof MODULES;
  overrides: RoleModuleOverrides;
  pendingKey: string | null;
  justSavedKey: string | null;
  abierta: string | null;
  celdas: Map<string, HTMLButtonElement>;
  onAbrir: (key: string) => void;
}) {
  return (
    <>
      <tr className="studio-mx-grp">
        <th colSpan={1 + STUDIO_USER_ROLES.length} scope="colgroup">
          {AREA_LABEL[group]}
          <small>{total} módulos</small>
        </th>
      </tr>
      {items.map((m) => {
        const locked = LOCKED_MODULES.has(m.id);
        return (
          <tr key={m.id}>
            <th scope="row">
              {m.label}
              {locked && (
                <span className="studio-mx-lk" title="Fijo: dinero o administración">
                  <Candado />
                  <span className="sr-only">(fijo)</span>
                </span>
              )}
            </th>
            {STUDIO_USER_ROLES.map((r) => {
              const n = nivelCelda(r, m.id, overrides);
              const key = `${r}:${m.id}`;
              const cambio = r !== "admin" && !locked && n !== nivelCelda(r, m.id);
              const igual = r !== "admin" && !locked && !cambio && `${r}:${m.id}` in overrides;
              const nombre = `${ROLE_LABELS[r]}, ${m.label}: ${NIVEL_ROL_LABEL[n]}${cambio ? ", cambiado respecto a lo de fábrica" : ""}${igual ? ", cambio guardado igual a lo de fábrica" : ""}${locked ? ", fijo" : ""}`;
              if (r === "admin") {
                return (
                  <td key={r} className="studio-mx-adm">
                    <span className="studio-mx-st" data-n={n} role="img" aria-label={nombre}>
                      <NivelTxt n={n} />
                    </span>
                  </td>
                );
              }
              if (locked) {
                return (
                  <td key={r}>
                    <span className="studio-mx-st" data-n={n} data-locked="true" role="img" aria-label={nombre} title="Fijo: se cambia en código, no aquí">
                      <NivelTxt n={n} />
                    </span>
                  </td>
                );
              }
              const pending = pendingKey === key;
              return (
                <td key={r}>
                  <span className="studio-mx-cell">
                    <button
                      ref={(el) => {
                        if (el) celdas.set(key, el);
                        else celdas.delete(key);
                      }}
                      type="button"
                      className={`studio-mx-st studio-permcell${justSavedKey === key ? " studio-permcell-flash" : ""}`}
                      data-n={n}
                      aria-haspopup="dialog"
                      aria-expanded={abierta === key}
                      aria-label={`${nombre}. Cambiar para todo el rol`}
                      aria-busy={pending || undefined}
                      disabled={pending}
                      onClick={() => onAbrir(key)}
                    >
                      <NivelTxt n={n} />
                    </button>
                    {cambio && (
                      <span className="studio-mx-chg">
                        <span className="studio-mx-dot" aria-hidden />
                        Cambiado
                      </span>
                    )}
                    {igual && (
                      <span className="studio-mx-chg">
                        <span className="studio-mx-dot" aria-hidden />
                        Cambiado (igual a fábrica)
                      </span>
                    )}
                  </span>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
