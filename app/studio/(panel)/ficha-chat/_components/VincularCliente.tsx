"use client";

/**
 * «Vincular a cliente» en la Ficha DTD (SDD-0676).
 *
 * Sale en una conversación «Sin ficha», solo para quien puede vincular (lo decide el
 * servidor en `pedirFichaDtd` y lo repite cada acción). Tres pasos, sin salir de la
 * pestaña: buscar (Shipping Mark, nombre o teléfono), elegir y confirmar con el código
 * y el nombre a la vista. Si el chat ya está unido a otra ficha, lo dice y ofrece
 * «Mover aquí» con un motivo escrito.
 *
 * Al navegador solo llegan el código, el nombre y los últimos 4 dígitos del teléfono
 * de cada resultado. El contacto de Chatwoot no viaja desde aquí: el servidor lo lee
 * de la conversación.
 */

import { useEffect, useId, useRef, useState } from "react";
import {
  buscarClientesParaVincular,
  vincularContactoDeConversacion,
  type ClienteParaVincular,
  type VincularError,
} from "@/app/studio/(app)/bandeja/vincular-actions";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { useT } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dict";

const MIN = 3;
const ESPERA_MS = 300;

const CUERPO = { font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 } as const;
const COLUMNA = { display: "flex", flexDirection: "column", gap: "var(--s-2)" } as const;
const FILA = { display: "flex", gap: "var(--s-2)", justifyContent: "flex-end", flexWrap: "wrap" } as const;

type Busqueda =
  | { tipo: "vacia" }
  | { tipo: "buscando" }
  | { tipo: "lista"; clientes: ClienteParaVincular[] }
  | { tipo: "error"; error: VincularError };

export function VincularCliente({
  conversacionId,
  agenteId,
  onVinculado,
}: {
  conversacionId: number;
  agenteId: number;
  /** Después de vincular: la ficha se vuelve a pedir y ya sale completa. */
  onVinculado: () => void;
}) {
  const t = useT();
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState<Busqueda>({ tipo: "vacia" });
  const [elegido, setElegido] = useState<ClienteParaVincular | null>(null);
  const [error, setError] = useState<VincularError | null>(null);
  const [otra, setOtra] = useState<{ markbox: string; nombre: string } | null | undefined>(undefined);
  const [motivo, setMotivo] = useState("");
  const turno = useRef(0);
  const entrada = useRef<HTMLInputElement>(null);

  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quien lo monta le pone `key` con la conversación: en otro chat nace de cero.
  // Al desmontarse, una búsqueda en espera no se dispara ni pinta.
  useEffect(
    () => () => {
      turno.current += 1;
      if (espera.current) clearTimeout(espera.current);
    },
    [],
  );

  const alEscribir = (valor: string) => {
    setTexto(valor);
    if (espera.current) clearTimeout(espera.current);
    const termino = valor.trim();
    const mio = ++turno.current;
    if (termino.length < MIN) {
      setBusqueda({ tipo: "vacia" });
      return;
    }
    setBusqueda({ tipo: "buscando" });
    espera.current = setTimeout(async () => {
      let siguiente: Busqueda;
      try {
        const r = await buscarClientesParaVincular(termino);
        siguiente = r.ok ? { tipo: "lista", clientes: r.clientes } : { tipo: "error", error: r.error };
      } catch {
        siguiente = { tipo: "error", error: "service" };
      }
      // Una respuesta vieja no pisa la de una búsqueda más nueva.
      if (mio === turno.current) setBusqueda(siguiente);
    }, ESPERA_MS);
  };

  useEffect(() => {
    if (abierto && !elegido) entrada.current?.focus();
  }, [abierto, elegido]);

  if (!abierto) {
    return (
      <div>
        <button type="button" className="studio-btn studio-btn-primary studio-btn-sm" onClick={() => setAbierto(true)}>
          {t("bandeja.vincular.open")}
        </button>
      </div>
    );
  }

  const volverALaBusqueda = () => {
    setElegido(null);
    setError(null);
    setOtra(undefined);
    setMotivo("");
  };

  if (elegido) {
    const mover = error === "otra_ficha";
    const motivoValido = motivo.trim().length >= 4;
    return (
      <section aria-labelledby={`${id}-confirmar`} style={COLUMNA}>
        <h2 id={`${id}-confirmar`} style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)", margin: 0 }}>
          {t("bandeja.vincular.confirm_title")}
        </h2>
        <p style={{ margin: 0, font: "800 15px/1.3 var(--f-display)", color: "var(--ink)", overflowWrap: "anywhere" }}>
          {elegido.markbox}
          <span style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)", marginLeft: "var(--s-2)" }}>{elegido.nombre}</span>
        </p>
        <p style={CUERPO}>{t("bandeja.vincular.confirm_body")}</p>

        {mover ? (
          <>
            <Aviso tono="atencion" compacto>
              {otra
                ? t("bandeja.vincular.other_known", { codigo: otra.markbox, nombre: otra.nombre })
                : t("bandeja.vincular.other_unknown")}
            </Aviso>
            <label className="studio-label" htmlFor={`${id}-motivo`}>
              {t("bandeja.vincular.move_reason")}
            </label>
            <input
              id={`${id}-motivo`}
              className="studio-input"
              maxLength={1000}
              autoComplete="off"
              placeholder={t("bandeja.vincular.move_reason_placeholder")}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </>
        ) : error ? (
          <Aviso tono="error" compacto>
            {t(`bandeja.vincular.error.${error}` as I18nKey)}
          </Aviso>
        ) : null}

        <div style={FILA}>
          <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={volverALaBusqueda}>
            {t("bandeja.vincular.back")}
          </button>
          <ActionButton
            variant={mover ? "warning" : "primary"}
            size="sm"
            idleLabel={mover ? t("bandeja.vincular.move_submit") : t("bandeja.vincular.submit")}
            loadingLabel={mover ? t("bandeja.vincular.moving") : t("bandeja.vincular.submitting")}
            successLabel={t("bandeja.vincular.done")}
            disabled={mover && !motivoValido}
            onAction={async () => {
              const r = await vincularContactoDeConversacion(
                conversacionId,
                agenteId,
                elegido.id,
                mover ? { mover: true, motivo } : undefined,
              );
              if (r.ok) return;
              setError(r.error);
              setOtra(r.error === "otra_ficha" ? (r.otra ?? null) : undefined);
              // El aviso ya explica qué pasó: el botón vuelve a su estado sin flash verde.
              return { error: r.error };
            }}
            onSuccess={onVinculado}
          />
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${id}-titulo`} style={COLUMNA}>
      <h2 id={`${id}-titulo`} style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)", margin: 0 }}>
        {t("bandeja.vincular.open")}
      </h2>
      <label className="studio-label" htmlFor={`${id}-buscar`}>
        {t("bandeja.vincular.search_label")}
      </label>
      <input
        id={`${id}-buscar`}
        ref={entrada}
        className="studio-input"
        type="search"
        autoComplete="off"
        maxLength={80}
        placeholder={t("bandeja.vincular.search_placeholder")}
        aria-describedby={`${id}-estado`}
        value={texto}
        onChange={(e) => alEscribir(e.target.value)}
      />
      <p id={`${id}-estado`} role="status" aria-live="polite" style={CUERPO}>
        {busqueda.tipo === "vacia"
          ? t("bandeja.vincular.hint", { n: MIN })
          : busqueda.tipo === "buscando"
            ? t("bandeja.vincular.searching")
            : busqueda.tipo === "error"
              ? t(`bandeja.vincular.error.${busqueda.error}` as I18nKey)
              : busqueda.clientes.length === 0
                ? t("bandeja.vincular.no_results")
                : t("bandeja.vincular.results", { n: busqueda.clientes.length })}
      </p>
      {busqueda.tipo === "lista" && busqueda.clientes.length > 0 ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
          {busqueda.clientes.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                style={{ width: "100%", justifyContent: "flex-start", textAlign: "left", height: "auto", minHeight: 36, padding: "var(--s-2) var(--s-3)", whiteSpace: "normal" }}
                onClick={() => {
                  setError(null);
                  setOtra(undefined);
                  setElegido(c);
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)", minWidth: 0 }}>
                  <span style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)", overflowWrap: "anywhere" }}>
                    {c.markbox}
                    <span style={{ fontWeight: 500, marginLeft: "var(--s-2)" }}>{c.nombre}</span>
                  </span>
                  <span style={{ font: "400 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                    {[
                      c.telefonoFinal ? t("bandeja.vincular.phone_tail", { final: c.telefonoFinal }) : t("bandeja.vincular.no_phone"),
                      c.codigoAnterior ? t("bandeja.vincular.previous_code", { codigo: c.codigoAnterior }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div style={FILA}>
        <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={() => setAbierto(false)}>
          {t("bandeja.vincular.cancel")}
        </button>
      </div>
    </section>
  );
}
