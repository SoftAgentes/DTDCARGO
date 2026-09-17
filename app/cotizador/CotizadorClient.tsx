"use client";

/**
 * SDD-0473 · Los tres pasos del cotizador público: cargar, revisar, cotizar.
 *
 * Esta pantalla no lee documentos ni calcula precios: eso ya vive en los
 * componentes de `components/document-import/` y en el servidor. Lo que hace es
 * sostener el recorrido de alguien que llega SIN cuenta y sin compra abierta.
 *
 * Cinco reglas que no negocia:
 *
 *  - **Workspace anónimo.** El panel se monta SIN `openParams`: sin compra, el
 *    servidor abre un workspace anónimo que expira en 24 h y se identifica con
 *    un token propio. Meterle un `purchaseCode` acá exigiría sesión y dejaría
 *    fuera al visitante, que es justamente para quien existe esta página.
 *
 *  - **Primero revisar, después cotizar.** El precio sale del peso y el CBM del
 *    documento. Mientras no haya documento no hay paso 3, y las correcciones se
 *    guardan ANTES de pedir el estimado: el servidor cotiza sobre lo guardado,
 *    así que saltarse el guardado mostraría el precio de la carga vieja.
 *
 *  - **Sin precio de respaldo.** Si el servidor dice que no hay servicio o que
 *    no hay tarifa vigente, se repite SU mensaje y se ofrece el asesor. Inventar
 *    un número acá sería cobrarle a alguien por una cuenta que no hicimos.
 *
 *  - **El plazo lo dice el servidor.** El aviso de borrado usa el `expiresAt`
 *    del workspace. Sin esa fecha no se promete ningún plazo.
 *
 *  - **La salida manual nunca se cierra.** `/tarifas` y WhatsApp están a la
 *    vista en todos los pasos, incluso cuando todo funciona.
 *
 * Frontera: es superficie pública. Sólo importa componentes compartidos,
 * `@/lib/shared/*` y tokens de marca; nada de `lib/studio`, `lib/db` ni Supabase.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { computeDocumentTotals, type DocumentDraft } from "@/lib/shared/document-import";
import { DocumentCalculator } from "@/components/document-import/DocumentCalculator";
import { DocumentEditor } from "@/components/document-import/DocumentEditor";
import { DocumentImportPanel } from "@/components/document-import/DocumentImportPanel";
import {
  createDocumentClient,
  DocumentRequestError,
  type DocumentClient,
  type DocumentReceipt,
  type DocumentWorkspace,
} from "@/components/document-import/document-client";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import s from "@/components/document-import/document-import.module.css";

type Paso = "cargar" | "revisar" | "cotizar";

/**
 * Los códigos con los que el servidor dice "hoy no hay servicio". No son un
 * error del visitante ni algo que se arregle reintentando: llevan al asesor.
 */
const SIN_SERVICIO = ["not_configured", "tariff_unavailable"];

const PASOS: { id: Paso; label: string }[] = [
  { id: "cargar", label: "1 Documentos" },
  { id: "revisar", label: "2 Revisión" },
  { id: "cotizar", label: "3 Precio" },
];

const WHATSAPP = buildWhatsAppLink(
  "Hola, estoy cotizando una importación con mi factura proforma y mi packing list. ¿Me ayudan con el precio puerta a puerta?",
);

/** Fecha legible en horario de Venezuela. Si el dato no es una fecha, se muestra crudo. */
function fechaLarga(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-VE", { dateStyle: "long", timeStyle: "short" }).format(fecha);
}

export function CotizadorClient({
  client,
  pollMs,
}: {
  /** Inyección explícita sólo para pruebas y fixtures. En producción nace del default. */
  client?: DocumentClient;
  /** Ritmo del sondeo de lectura. Sólo lo pasan las pruebas. */
  pollMs?: number;
}) {
  const [base] = useState<DocumentClient>(() => client ?? createDocumentClient());
  const [ws, setWs] = useState<DocumentWorkspace | null>(null);
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  // Un workspace recién abierto NO es un documento: llega vacío. Esto se
  // enciende cuando hay algo que revisar y ya no se apaga, para que vaciar un
  // campo durante la revisión no eche al visitante de vuelta al paso 1.
  const [hayDocumento, setHayDocumento] = useState(false);
  const [pasoPedido, setPasoPedido] = useState<Paso>("cargar");
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [bloqueo, setBloqueo] = useState<string | null>(null);

  /**
   * Un transporte ÚNICO para toda la pantalla: el token anónimo que guarda el
   * panel al abrir el workspace tiene que viajar también en el estimado y en el
   * guardado. Dos clientes distintos serían dos identidades y el servidor
   * respondería 404 a la segunda.
   *
   * Encima observa los fallos para levantar el aviso de "no hay servicio". Los
   * mira, no se los traga: el error se relanza y cada componente muestra el suyo.
   */
  const transport = useMemo<DocumentClient>(() => {
    const mirar = <T,>(pendiente: Promise<T>): Promise<T> =>
      pendiente.catch((error: unknown) => {
        if (error instanceof DocumentRequestError && SIN_SERVICIO.includes(error.code)) {
          setBloqueo(error.message);
        }
        throw error;
      });
    return {
      ...base,
      get: <T,>(action: string, params?: Record<string, string>) => mirar(base.get<T>(action, params)),
      post: <T,>(action: string, body?: Record<string, unknown>) => mirar(base.post<T>(action, body)),
    };
  }, [base]);

  function aplicar(next: DocumentWorkspace) {
    setWs(next);
    setDraft(next.draft);
    setSucio(false);
    if (next.draft.products.length > 0 || next.draft.groups.length > 0) setHayDocumento(true);
  }

  /**
   * El panel promete un `DocumentWorkspace`, pero `apply` responde el RECIBO del
   * servidor (`{revision, confirmed, …}`): sin `id` y sin borrador. Adoptarlo tal
   * cual dejaría la pantalla sin documento, así que cuando llega sin borrador se
   * relee el workspace en vez de vaciarla.
   */
  function adoptar(next: DocumentWorkspace) {
    if (next && typeof next.id === "string" && next.draft) {
      aplicar(next);
      return;
    }
    const id = ws?.id;
    if (!id) return;
    void transport
      .get<{ workspace: DocumentWorkspace }>("workspace", { workspaceId: id })
      .then(({ workspace }) => aplicar(workspace))
      .catch(() =>
        setAviso(
          "Aplicamos lo que leímos, pero no pudimos recargar el documento. Vuelve a abrir la página para verlo.",
        ),
      );
  }

  async function guardar(): Promise<boolean> {
    if (!ws || !draft) return false;
    setGuardando(true);
    setAviso(null);
    try {
      // El servidor responde un recibo, no el workspace: de ahí sale la revisión
      // nueva y en pantalla queda el borrador que acabamos de mandar.
      const recibo = await transport.post<DocumentReceipt>("save", {
        workspaceId: ws.id,
        draft,
        expectedRevision: ws.revision,
        commandId: transport.id(),
      });
      setWs({ ...ws, revision: recibo.revision });
      setSucio(false);
      return true;
    } catch (error) {
      setAviso(
        error instanceof DocumentRequestError && error.status === 409
          ? "Este documento cambió en otra pestaña. Lo que escribiste sigue en pantalla: vuelve a abrir la página para ver la versión guardada antes de continuar."
          : "No pudimos guardar tus correcciones. Siguen en pantalla; inténtalo de nuevo.",
      );
      return false;
    } finally {
      setGuardando(false);
    }
  }

  /**
   * La única puerta al precio. El estimado se calcula sobre el documento
   * GUARDADO, así que si hay correcciones sin guardar se guardan primero; si el
   * guardado falla, no se avanza: mejor sin precio que con el precio de otra carga.
   */
  async function cotizar() {
    if (sucio && !(await guardar())) return;
    setPasoPedido("cotizar");
  }

  const listo = hayDocumento && ws !== null && draft !== null;
  const paso: Paso = listo ? pasoPedido : "cargar";

  const totales = draft ? computeDocumentTotals(draft) : null;
  const montos = Object.entries(totales?.amounts ?? {}).filter(
    ([, monto]) => Number.isFinite(monto) && monto > 0,
  );
  // Con dos monedas no hay un valor de mercancía que mostrar: convertirlas sería
  // inventar una tasa y elegir una sería esconder la otra.
  const merchandise = montos.length === 1 ? { amount: montos[0][1], currency: montos[0][0] } : null;

  return (
    <div className={[s.root, s.stack].join(" ")}>
      <div className={s.tabs} role="group" aria-label="Pasos del cotizador">
        {PASOS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="btn btn-ghost"
            aria-pressed={paso === item.id}
            disabled={guardando || (item.id !== "cargar" && !listo)}
            onClick={() => {
              if (item.id === "cotizar") void cotizar();
              else setPasoPedido(item.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {bloqueo && (
        <p className={[s.notice, s.error].join(" ")} role="alert">
          {bloqueo} No te vamos a mostrar un precio de respaldo: escríbele a un asesor y te lo cierra
          él con tus archivos en la mano.
        </p>
      )}

      {ws?.expiresAt && (
        <p className={s.notice}>
          Estás cotizando sin cuenta: tu documento se guarda temporalmente y se borra solo el{" "}
          <time dateTime={ws.expiresAt}>{fechaLarga(ws.expiresAt)}</time>. Si quieres conservarlo y
          compartirlo con tu proveedor, <Link href="/registro">abre tu cuenta</Link> y sigue desde el
          portal.
        </p>
      )}

      {paso === "cargar" && (
        <DocumentImportPanel
          workspace={ws}
          onWorkspace={adoptar}
          onReview={listo ? () => setPasoPedido("revisar") : undefined}
          locale="es"
          client={transport}
          pollMs={pollMs}
        />
      )}

      {paso === "revisar" && draft && (
        <section className={s.stack} aria-label="Revisión del documento">
          <div className={s.bar}>
            <h2>Revisa lo que leímos</h2>
            <span className={s.muted}>
              Revisión {ws?.revision ?? 0}
              {sucio ? " · con cambios sin guardar" : ""}
            </span>
          </div>
          <p className={s.muted}>
            Nada de esto es definitivo: corrige lo que haga falta. El peso bruto y el CBM son los
            que mandan en el precio del transporte; el valor de la mercancía va aparte.
          </p>

          <DocumentEditor
            draft={draft}
            onChange={(next) => {
              setDraft(next);
              setSucio(true);
            }}
            locale="es"
            disabled={guardando}
            revision={ws?.revision}
          />

          {aviso && (
            <p className={[s.notice, s.error].join(" ")} role="alert">
              {aviso}
            </p>
          )}

          <div className={s.actions}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={guardando}
              onClick={() => void cotizar()}
            >
              {guardando
                ? "Guardando…"
                : sucio
                  ? "Guardar y ver cuánto cuesta"
                  : "Ver cuánto cuesta"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={guardando}
              onClick={() => setPasoPedido("cargar")}
            >
              Cargar otro archivo
            </button>
          </div>

          {totales && (
            <p className={s.muted}>
              {draft.products.length} productos · {totales.cartons ?? "pendiente"} cajas ·{" "}
              {totales.grossWeightKg ?? "pendiente"} kg · {totales.cbm ?? "pendiente"} m³
            </p>
          )}
        </section>
      )}

      {paso === "cotizar" && ws && (
        <section className={s.stack} aria-label="Precio del transporte">
          <DocumentCalculator
            workspaceIds={[ws.id]}
            locale="es"
            client={transport}
            merchandise={merchandise}
            onNeedsDocument={() => setPasoPedido("revisar")}
          />
          <div className={s.actions}>
            <button type="button" className="btn btn-ghost" onClick={() => setPasoPedido("revisar")}>
              Volver a revisar el documento
            </button>
          </div>
        </section>
      )}

      {/* Las dos salidas siguen abiertas en todos los pasos, también cuando todo
          funciona: quien prefiere escribir sus propios metros cúbicos o hablar
          con una persona no tiene por qué pelear con esta pantalla. */}
      <footer className={s.stack}>
        <p className={s.muted}>
          ¿Prefieres poner tú mismo los metros cúbicos?{" "}
          <Link href="/tarifas">Usa la calculadora de siempre</Link>.
        </p>
        <p className={s.muted}>
          ¿Prefieres que lo vea una persona?{" "}
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
            Escríbele a un asesor por WhatsApp
          </a>{" "}
          con tus archivos.
        </p>
      </footer>
    </div>
  );
}
