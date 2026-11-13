/**
 * SDD-0625 · Marco claro de las pantallas de Noticias web (mismo que el
 * generador: el contenido usa tokens de marca light dentro del Studio oscuro).
 */
import type { ReactNode } from "react";

export function NoticiasShell({
  eyebrow,
  titulo,
  descripcion,
  children,
  arriba,
}: {
  eyebrow: string;
  titulo: ReactNode;
  descripcion?: ReactNode;
  children: ReactNode;
  arriba?: ReactNode;
}) {
  return (
    <div
      data-theme="light"
      style={{
        background: "var(--color-paper)",
        color: "var(--color-ink)",
        borderRadius: 16,
        padding: "32px 28px 48px",
        boxShadow: "var(--shadow-pop)",
        maxWidth: 1480,
      }}
    >
      {arriba}
      <div style={{ marginBottom: 28 }}>
        <span className="eyebrow" style={{ color: "var(--color-grey-500, #6B6B6B)" }}>
          {eyebrow}
        </span>
        <h1
          style={{
            fontFamily: "var(--font-archivo-black)",
            fontSize: 30,
            margin: "12px 0 10px",
            color: "var(--color-ink, #0F1E3D)",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            fontWeight: 900,
          }}
        >
          {titulo}
        </h1>
        {descripcion ? (
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--color-grey-500, #6B6B6B)", margin: 0, maxWidth: "76ch" }}>
            {descripcion}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
