"use client";

/**
 * GrupoFlotante · SDD-0709
 *
 * Con el menú lateral cerrado, cada grupo (Operación, Comercial, Finanzas, Marketing,
 * Sistema) es UN botón con icono. Al oprimirlo se abre al lado una lista flotante con
 * los módulos del grupo que el rol puede ver; los padres (Almacenes, Despacho) salen
 * como subgrupo dentro de la lista. Elegir un módulo navega y cierra la lista.
 *
 * Accesibilidad: botón con `aria-haspopup="menu"` y `aria-expanded`; lista con
 * `role="menu"` navegable con flechas, Inicio y Fin; Esc cierra y devuelve el foco al
 * botón; clic afuera y Tab cierran. Pasar el mouse NO abre: solo muestra el nombre.
 */

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "../../_components/icons";

export interface EntradaMenu {
  id: string;
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
  /** Contador opcional a la derecha (p. ej. la Bandeja dentro de CRM). */
  extra?: ReactNode;
}

export type UnidadMenu =
  | { tipo: "hoja"; entrada: EntradaMenu }
  | { tipo: "sub"; id: string; label: string; icon: IconName; hijos: EntradaMenu[] };

export interface PosicionFlotante {
  top: number;
  left: number;
}

interface Props {
  id: string;
  label: string;
  icon: IconName;
  /** El módulo activo (según la ruta) es de este grupo. */
  activo: boolean;
  unidades: UnidadMenu[];
  abierto: boolean;
  pos: PosicionFlotante | null;
  onAbrir: (pos: PosicionFlotante) => void;
  onCerrar: () => void;
  onTip: (el: HTMLElement | null, label: string) => void;
}

const MARGEN = 12;

export function GrupoFlotante({
  id,
  label,
  icon,
  activo,
  unidades,
  abierto,
  pos,
  onAbrir,
  onCerrar,
  onTip,
}: Props) {
  const botonRef = useRef<HTMLButtonElement | null>(null);
  const listaRef = useRef<HTMLDivElement | null>(null);
  const listaId = useId();

  const posicionDe = (el: HTMLElement): PosicionFlotante => {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.right + 8 };
  };

  // Si la lista no cabe hacia abajo, sube lo justo (nunca por encima del margen).
  useLayoutEffect(() => {
    const lista = listaRef.current;
    if (!abierto || !lista || !pos) return;
    const alto = lista.getBoundingClientRect().height;
    const tope = Math.max(MARGEN, window.innerHeight - MARGEN - alto);
    lista.style.top = `${Math.min(pos.top, tope)}px`;
  }, [abierto, pos]);

  // Al abrir, el foco va al módulo activo (o al primero): el teclado sigue ahí.
  useEffect(() => {
    if (!abierto) return;
    const items = listaRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!items || items.length === 0) return;
    const activoEl = Array.from(items).find((i) => i.getAttribute("aria-current") === "page");
    (activoEl ?? items[0]).focus();
  }, [abierto]);

  // Clic o toque afuera cierra; también cambiar el tamaño de la ventana.
  useEffect(() => {
    if (!abierto) return;
    const afuera = (ev: PointerEvent) => {
      const n = ev.target as Node;
      if (listaRef.current?.contains(n) || botonRef.current?.contains(n)) return;
      onCerrar();
    };
    document.addEventListener("pointerdown", afuera);
    window.addEventListener("resize", onCerrar);
    return () => {
      document.removeEventListener("pointerdown", afuera);
      window.removeEventListener("resize", onCerrar);
    };
  }, [abierto, onCerrar]);

  const cerrarConFoco = () => {
    onCerrar();
    botonRef.current?.focus();
  };

  const teclasLista = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      listaRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const i = items.indexOf(document.activeElement as HTMLElement);
    const ir = (n: number) => {
      e.preventDefault();
      items[(n + items.length) % items.length]?.focus();
    };
    switch (e.key) {
      case "ArrowDown":
        ir(i + 1);
        break;
      case "ArrowUp":
        ir(i < 0 ? items.length - 1 : i - 1);
        break;
      case "Home":
        ir(0);
        break;
      case "End":
        ir(items.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        cerrarConFoco();
        break;
      case "Tab":
        onCerrar();
        break;
    }
  };

  const renderEntrada = (e: EntradaMenu, sangria: boolean) => (
    <Link
      key={e.id}
      href={e.href}
      role="menuitem"
      tabIndex={-1}
      aria-current={e.active ? "page" : undefined}
      className="studio-sb-flot__item"
      data-activo={e.active ? "true" : undefined}
      data-sub={sangria ? "true" : undefined}
      onClick={onCerrar}
    >
      <span className="studio-sb-flot__icono" aria-hidden>
        {Icon[e.icon]?.(sangria ? 16 : 18)}
      </span>
      <span className="studio-sb-flot__texto">{e.label}</span>
      {e.extra}
    </Link>
  );

  return (
    <div className="studio-sb-grupo-cerrado">
      <button
        ref={botonRef}
        type="button"
        className="studio-sb-grupo-btn"
        data-activo={activo ? "true" : undefined}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? listaId : undefined}
        onClick={(e) => {
          if (abierto) {
            onCerrar();
            return;
          }
          onTip(null, label);
          onAbrir(posicionDe(e.currentTarget));
        }}
        onKeyDown={(e) => {
          if (!abierto && (e.key === "ArrowDown" || e.key === "ArrowRight")) {
            e.preventDefault();
            onTip(null, label);
            onAbrir(posicionDe(e.currentTarget));
          }
        }}
        onMouseEnter={(e) => {
          if (!abierto) onTip(e.currentTarget, label);
        }}
        onMouseLeave={(e) => {
          const conFoco =
            document.activeElement === e.currentTarget && e.currentTarget.matches(":focus-visible");
          if (!conFoco) onTip(null, label);
        }}
        onFocus={(e) => {
          if (!abierto && e.currentTarget.matches(":focus-visible")) onTip(e.currentTarget, label);
        }}
        onBlur={() => onTip(null, label)}
        data-grupo={id}
      >
        <span className="studio-sb-icono" aria-hidden style={{ display: "inline-flex" }}>
          {Icon[icon]?.(20)}
        </span>
      </button>

      {abierto && pos && (
        <div
          ref={listaRef}
          id={listaId}
          role="menu"
          aria-label={label}
          className="studio-sb-flot"
          style={{ top: pos.top, left: pos.left, maxHeight: `calc(100vh - ${MARGEN * 2}px)` }}
          onKeyDown={teclasLista}
        >
          <div className="studio-sb-flot__titulo" aria-hidden>
            {label}
          </div>
          {unidades.map((u) =>
            u.tipo === "hoja" ? (
              renderEntrada(u.entrada, false)
            ) : (
              <div key={u.id} role="group" aria-labelledby={`${listaId}-${u.id}`}>
                <div
                  id={`${listaId}-${u.id}`}
                  role="presentation"
                  className="studio-sb-flot__sub"
                >
                  <span aria-hidden style={{ display: "inline-flex" }}>
                    {Icon[u.icon]?.(14)}
                  </span>
                  {u.label}
                </div>
                {u.hijos.map((h) => renderEntrada(h, true))}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
