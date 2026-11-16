"use client";

/**
 * Panel de una celda de «Roles y permisos» (SDD-0635 §3.8).
 *
 * Reemplaza el ciclo ciego al clic: se abre junto a la celda, dice a QUIÉNES
 * cambia («Cambia para 2 personas: …»), muestra las tres opciones con una línea
 * cada una, dice en palabras lo de fábrica («De fábrica, Comercial tiene ver y
 * editar en Reclamos. Hoy está cambiado a solo ver») con «Volver a lo de
 * fábrica», y avisa si alguna persona del rol ya lo tiene como extra.
 *
 * Nada se guarda hasta «Aplicar a las N» (MP-01: cambia el acceso de varias
 * personas, se lee el alcance antes). Solo ofrece lo que la base permite hoy:
 * `support` no tiene «Ver y editar»; las celdas fijas y la columna admin no
 * abren este panel (lo decide `PermissionsSection`).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ROLE_LABELS, type StudioUserRole } from "@/lib/studio/user-types";

export type NivelRol = "none" | "view" | "edit";

export const NIVEL_ROL_LABEL: Record<NivelRol | "all", string> = {
  none: "Sin acceso",
  view: "Solo ver",
  edit: "Ver y editar",
  all: "Todo",
};

const NIVEL_ROL_SUB: Record<NivelRol, string> = {
  none: "No le aparece en el menú.",
  view: "Lo abre sin poder cambiar nada.",
  edit: "Puede crear y modificar.",
};

export function personasTxt(n: number): string {
  return `${n} ${n === 1 ? "persona" : "personas"}`;
}

/** «Aplicar a las 3» · «Aplicar a 1 persona» · «Aplicar al rol» (sin personas activas). */
export function aplicarTxt(n: number): string {
  if (n === 0) return "Aplicar al rol";
  return n === 1 ? "Aplicar a 1 persona" : `Aplicar a las ${n}`;
}

/** Lista corta de nombres: hasta 5 y «y N más». */
function nombresCortos(nombres: string[]): string {
  if (nombres.length <= 5) return nombres.join(", ");
  return `${nombres.slice(0, 5).join(", ")} y ${nombres.length - 5} más`;
}

export type ExtraDelRol = { nombre: string; edita: boolean };

/**
 * Un extra «sobra» solo cuando el nivel elegido para el rol ya da todo lo que
 * el extra suma (la misma regla que `estadoModulo` en la ficha): el rol edita,
 * o el rol ve y el extra solo ve. Con el rol en «Solo ver», un extra que edita
 * sigue sumando la edición.
 */
export function extrasQueSobran(conExtra: ExtraDelRol[], sel: NivelRol): ExtraDelRol[] {
  return conExtra.filter((e) => sel === "edit" || (sel === "view" && !e.edita));
}

function AvisoExtras({ conExtra, sel }: { conExtra: ExtraDelRol[]; sel: NivelRol }) {
  const sobran = extrasQueSobran(conExtra, sel);
  const suman = conExtra.filter((e) => !sobran.includes(e));
  const todos = conExtra.map((e) => e.nombre);
  return (
    <p className="studio-mx-aviso">
      {nombresCortos(todos)} ya {todos.length === 1 ? "lo tiene" : "lo tienen"} como acceso extra en su ficha.{" "}
      {sobran.length > 0 && (
        <>Si lo aplicas, el extra de {nombresCortos(sobran.map((e) => e.nombre))} quedará marcado «sobra». </>
      )}
      {suman.length > 0 &&
        (sel === "none"
          ? "Lo conserva aunque el rol no lo tenga."
          : `El extra de ${nombresCortos(suman.map((e) => e.nombre))} sigue sumando: el rol solo ve y el extra también edita.`)}
    </p>
  );
}

export function PermisoCeldaPanel({
  role,
  moduleLabel,
  fabrica,
  actual,
  cambiado,
  igualAFabrica = false,
  personas,
  conExtra,
  pending,
  anchor,
  onAplicar,
  onFabrica,
  onCerrar,
}: {
  role: StudioUserRole;
  moduleLabel: string;
  /** Nivel de fábrica (default de código, sin desvío). */
  fabrica: NivelRol;
  /** Nivel de hoy (con el desvío por rol, si lo hay). */
  actual: NivelRol;
  /** Hoy es distinto a lo de fábrica. */
  cambiado: boolean;
  /** Hay un desvío guardado, pero hoy da lo mismo que lo de fábrica. */
  igualAFabrica?: boolean;
  /** Nombres de las personas activas del rol. */
  personas: string[];
  /** Personas del rol que ya tienen este módulo como extra vigente, y si ese extra edita. */
  conExtra: ExtraDelRol[];
  pending: boolean;
  /** Celda que abrió el panel (para ubicarlo). */
  anchor: HTMLElement | null;
  onAplicar: (nivel: NivelRol) => void;
  onFabrica: () => void;
  onCerrar: () => void;
}) {
  const [sel, setSel] = useState<NivelRol>(actual);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const rol = ROLE_LABELS[role];
  const titulo = `${moduleLabel} · todo el rol ${rol}`;
  const opciones: NivelRol[] = ["none", "view", "edit"];
  const off = (n: NivelRol) => n === "edit" && role === "support";
  const habilitadas = opciones.filter((n) => !off(n));

  // Ubicación junto a la celda, sin salirse de la ventana.
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const b = anchor.getBoundingClientRect();
    const w = ref.current.offsetWidth || 340;
    const h = ref.current.offsetHeight || 380;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(12, Math.min(b.left - 120, vw - w - 12));
    let top = b.bottom + 6;
    if (top + h > vh - 12) top = Math.max(12, b.top - h - 6);
    setPos({ left, top });
  }, [anchor]);

  // Foco a la opción marcada al abrir.
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')?.focus();
  }, []);

  // Clic fuera (que no sea la celda que lo abrió) cierra.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor?.contains(t)) return;
      onCerrar();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [anchor, onCerrar]);

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const i = Math.max(0, habilitadas.indexOf(sel));
    const paso = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const sig = habilitadas[(i + paso + habilitadas.length) % habilitadas.length];
    setSel(sig);
    queueMicrotask(() => ref.current?.querySelector<HTMLButtonElement>(`[data-n="${sig}"]`)?.focus());
  }

  const n = personas.length;
  return (
    <div
      ref={ref}
      className="studio-mx-pop"
      role="dialog"
      aria-modal="false"
      aria-labelledby="studio-mx-pop-t"
      style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden", left: 0, top: 0 }}
    >
      <h3 id="studio-mx-pop-t">{titulo}</h3>
      <p className="studio-mx-afecta">
        {n === 0 ? (
          <>Hoy no hay personas activas con este rol: aplica a quien lo reciba después.</>
        ) : (
          <>
            Cambia para <b>{personasTxt(n)}</b>: {nombresCortos(personas)}.
          </>
        )}
      </p>
      <div className="studio-mx-opts" role="radiogroup" aria-label={`Permiso de ${rol} en ${moduleLabel}`} onKeyDown={onKey}>
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            data-n={o}
            className="studio-mx-opt"
            aria-checked={sel === o}
            tabIndex={sel === o ? 0 : -1}
            disabled={off(o) || pending}
            onClick={() => setSel(o)}
          >
            <b>
              {NIVEL_ROL_LABEL[o]}
              {o === fabrica ? " · de fábrica" : ""}
            </b>
            <span>{off(o) ? "Soporte nunca edita." : NIVEL_ROL_SUB[o]}</span>
          </button>
        ))}
      </div>
      <p className="studio-mx-fab">
        De fábrica, {rol} tiene <b>{NIVEL_ROL_LABEL[fabrica].toLowerCase()}</b> en {moduleLabel}.
        {cambiado && (
          <>
            {" "}
            Hoy está cambiado a <b>{NIVEL_ROL_LABEL[actual].toLowerCase()}</b>.{" "}
            <button type="button" className="studio-mx-link" disabled={pending} onClick={onFabrica}>
              Volver a lo de fábrica
            </button>
          </>
        )}
        {!cambiado && igualAFabrica && (
          <>
            {" "}
            Hay un cambio guardado que hoy da lo mismo.{" "}
            <button type="button" className="studio-mx-link" disabled={pending} onClick={onFabrica}>
              Volver a lo de fábrica
            </button>
          </>
        )}
      </p>
      {conExtra.length > 0 && <AvisoExtras conExtra={conExtra} sel={sel} />}
      <div className="studio-mx-actions">
        <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" disabled={pending} onClick={onCerrar}>
          Cancelar
        </button>
        <button
          type="button"
          className="studio-btn studio-btn-primary studio-btn-sm"
          disabled={pending || sel === actual}
          aria-busy={pending}
          onClick={() => onAplicar(sel)}
        >
          {pending ? "Aplicando…" : aplicarTxt(n)}
        </button>
      </div>
    </div>
  );
}
