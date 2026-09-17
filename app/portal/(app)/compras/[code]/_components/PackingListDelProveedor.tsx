import type { PackingListRow } from "@/lib/studio/prealertas/packlist-form";
import { formatPackingQuantity } from "@/lib/studio/prealertas/packlist-form";
import type {
  CotejoDeCajas,
  PackingListDeCompra,
} from "@/lib/portal/packing-list-queries";
import { CheckIcon, WarningIcon } from "@/components/Icon";

/**
 * SDD-0308 · El packing list del proveedor, para el cliente.
 *
 * Server component: no tiene estado y no baja JS. Es una pantalla de LECTURA —
 * el cliente viene a comprobar qué despachó su proveedor, no a editar nada.
 *
 * ## Por qué dos maquetaciones y no una tabla que se encoge
 *
 * TBL-01 §móvil: *"prioriza columnas o usa lista/detalle; no comprime texto
 * hasta ilegibilidad"*. El packing list tiene once campos por fila; una tabla
 * de once columnas en 375px no se lee ni con zoom. Así que:
 *
 *   · **≥ md** → `<table>` semántica, con las columnas numéricas alineadas a la
 *     derecha y las unidades declaradas en el encabezado (TBL-01 §encabezados).
 *     Desborda dentro de su propio contenedor con `overflow-x:auto`, nunca
 *     empujando el ancho de la página.
 *   · **< md** → una tarjeta por fila, con los mismos datos apilados.
 *
 * Las dos leen el MISMO array. No hay una versión móvil recortada: sería un
 * documento distinto según el aparato desde el que se mire.
 *
 * ## Accesibilidad
 *
 * El contenedor con scroll lleva `tabIndex={0}`, `role="region"` y nombre
 * accesible: sin eso, quien navega con teclado no puede desplazarlo y las
 * columnas de la derecha son inalcanzables (A11Y-01 · WCAG 2.1.1).
 *
 * El estado del cotejo NO se comunica sólo por color (WCAG 1.4.1): lleva ícono
 * y la frase escrita con el número exacto.
 *
 * ## Tipografía
 *
 * El nombre chino del producto va en `--font-noto-sc` (VIS-02: chino de
 * interfaz en Noto Sans SC). Las cifras y los códigos en JetBrains Mono, que el
 * layout de `(app)` ya monta. El resto en Archivo, por herencia.
 */

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";
const CJK = "var(--font-noto-sc), 'Noto Sans SC', sans-serif";

/**
 * `1234.5` → `1,234.5`, con los decimales FIJOS que pide cada magnitud.
 *
 * Va en `en-US` a propósito, igual que `medida()` y el valor declarado de la
 * misma página: con `es-VE` esta tabla diría `85,2 kg` tres centímetros debajo
 * de una tarjeta que dice `85.2 kg`. Dos separadores decimales en una pantalla
 * de cifras es peor que cualquiera de los dos.
 *
 * Los decimales son fijos y no "hasta N": las cajas son enteras, el peso lleva
 * uno y el volumen tres. Un `0.5` que a veces se imprime `0.500` y a veces
 * `0.5` desalinea la columna y sugiere precisiones distintas por fila.
 */
function num(v: number, dec = 0): string {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

/** Importe con su moneda. El packing list puede venir en USD, RMB o EUR. */
function money(v: number, moneda: string): string {
  if (!Number.isFinite(v)) return "—";
  return `${moneda} ${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** `2026-08-26` → `26 ago 2026`. Sin `new Date(iso)` a secas: eso corre la fecha un día. */
function fecha(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  try {
    return new Date(y, m - 1, d).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

/** Nombre visible de una fila: el español manda; el chino es el respaldo. */
function nombreDeFila(r: PackingListRow): string {
  return r.es.trim() || r.zh.trim() || r.code.trim() || "Sin descripción";
}

export function PackingListDelProveedor({
  packing,
  cotejo,
}: {
  packing: PackingListDeCompra;
  /** Cotejo contra las cajas anunciadas. `null` = no hay nada que comparar. */
  cotejo: CotejoDeCajas | null;
}) {
  const t = packing.totales;
  const fechaDoc = fecha(packing.fechaDocumento);

  return (
    <section
      aria-labelledby="packing-list-titulo"
      className="mt-6 card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8"
    >
      {/* ── Cabecera del documento ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="packing-list-titulo"
            className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500"
          >
            Packing list del proveedor
          </h2>
          <p className="mt-2.5 text-[14px] text-grey-700 max-w-[60ch] leading-[1.55]">
            Lo llenó{" "}
            <span className="font-semibold text-ink">
              {packing.empresa?.trim() || "tu proveedor"}
            </span>
            {packing.contacto?.trim() ? ` (${packing.contacto.trim()})` : ""} en
            el enlace que le compartiste. Es el detalle de lo que despachó.
          </p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1.5 flex-shrink-0">
          {packing.folio ? (
            <code
              className="text-[13px] font-bold text-ink"
              style={{ fontFamily: MONO }}
            >
              {packing.folio}
            </code>
          ) : null}
          {fechaDoc ? (
            <span className="text-[12px] text-grey-500">{fechaDoc}</span>
          ) : null}
          {packing.version > 1 ? (
            // Una versión >1 no es un detalle técnico: significa que el
            // proveedor CORRIGIÓ lo que había mandado antes. El cliente que vio
            // la versión anterior necesita saber que está mirando otra cosa.
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{
                background:
                  "color-mix(in srgb, var(--color-status-warning) 20%, transparent)",
                color: "var(--color-ink)",
              }}
            >
              Corregido · versión {packing.version}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── ¿Cuadra con lo que anunciaste? ── */}
      {cotejo ? <Cotejo cotejo={cotejo} /> : null}

      {/* ── Totales ── */}
      <dl className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Total label="Cajas" value={num(t.ctns)} />
        <Total label="Unidades" value={formatPackingQuantity(t, (v) => num(v))} />
        <Total label="Peso" value={`${num(t.weight, 1)} kg`} />
        <Total label="Volumen" value={`${num(t.cbm, 3)} CBM`} />
        <Total label="Valor" value={money(t.amount, packing.moneda)} destacado />
      </dl>

      {/* ── Detalle: tabla en escritorio ── */}
      {packing.filas.length > 0 ? (
        <>
          <div
            role="region"
            aria-labelledby="packing-list-titulo"
            tabIndex={0}
            className="hidden md:block mt-7 -mx-1 px-1 overflow-x-auto rounded-[12px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-grey-200">
                  <Th>Caja</Th>
                  <Th>Producto</Th>
                  <Th align="right">Cajas</Th>
                  <Th align="right">Uds/caja</Th>
                  <Th align="right">Unidades</Th>
                  <Th align="right">Precio</Th>
                  <Th align="right">Monto</Th>
                  <Th align="right">Peso (kg)</Th>
                  <Th align="right">CBM</Th>
                </tr>
              </thead>
              <tbody>
                {packing.filas.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-grey-200 last:border-b-0 align-top"
                  >
                    <Td>
                      {/* `text-ink` explícito, no heredado: en el tema oscuro
                          del portal `--color-white` y `--color-ink` VOLTEAN, y
                          un texto sin clase de color hereda un navy fijo que no
                          voltea con ellos. Medido: 1,11:1 sobre la tarjeta
                          oscura — invisible. Con el token, 13,08:1. */}
                      <span
                        style={{ fontFamily: MONO }}
                        className="text-[12px] text-ink"
                      >
                        {r.carton.trim() || "—"}
                      </span>
                      {r.same ? (
                        // Caja Padre (SDD-0097): esta fila viaja DENTRO de la
                        // caja de la fila líder. Sin decirlo, el cliente suma
                        // las cajas de la columna y le da de más.
                        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-grey-500">
                          Misma caja
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="text-[13px] font-semibold text-ink">
                        {nombreDeFila(r)}
                      </span>
                      {r.zh.trim() && r.es.trim() ? (
                        <span
                          className="mt-0.5 block text-[12px] text-grey-700"
                          style={{ fontFamily: CJK }}
                          lang="zh-Hans"
                        >
                          {r.zh}
                        </span>
                      ) : null}
                      <SubLinea fila={r} />
                    </Td>
                    <TdNum>{r.same ? "—" : num(r.ctns)}</TdNum>
                    <TdNum>{r.same ? "—" : num(r.perctn)}</TdNum>
                    <TdNum>{num(r.qty)}</TdNum>
                    <TdNum>{money(r.unit, packing.moneda)}</TdNum>
                    <TdNum strong>{money(r.amount, packing.moneda)}</TdNum>
                    <TdNum>{r.same ? "—" : num(r.weight, 1)}</TdNum>
                    <TdNum>{r.same ? "—" : num(r.vol, 3)}</TdNum>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-grey-300">
                  <td colSpan={2} className="py-3 pr-3">
                    <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-grey-500">
                      Total
                    </span>
                  </td>
                  <TdNum strong>{num(t.ctns)}</TdNum>
                  <TdNum>—</TdNum>
                  <TdNum strong>{formatPackingQuantity(t, (v) => num(v))}</TdNum>
                  <TdNum>—</TdNum>
                  <TdNum strong>{money(t.amount, packing.moneda)}</TdNum>
                  <TdNum strong>{num(t.weight, 1)}</TdNum>
                  <TdNum strong>{num(t.cbm, 3)}</TdNum>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── Detalle: tarjetas en teléfono ── */}
          <ul className="md:hidden mt-7 flex flex-col gap-3">
            {packing.filas.map((r, i) => (
              <li
                key={i}
                className="rounded-[12px] border border-grey-200 p-4"
                style={{ background: "var(--color-paper)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[13.5px] font-semibold text-ink">
                      {nombreDeFila(r)}
                    </span>
                    {r.zh.trim() && r.es.trim() ? (
                      <span
                        className="mt-0.5 block text-[12.5px] text-grey-700"
                        style={{ fontFamily: CJK }}
                        lang="zh-Hans"
                      >
                        {r.zh}
                      </span>
                    ) : null}
                    <SubLinea fila={r} />
                  </div>
                  <span
                    className="flex-shrink-0 text-[12px] font-bold text-ink"
                    style={{ fontFamily: MONO }}
                  >
                    {r.carton.trim() || "—"}
                  </span>
                </div>

                {r.same ? (
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-grey-500">
                    Va dentro de la caja anterior
                  </p>
                ) : null}

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                  {!r.same ? (
                    <DatoMovil label="Cajas" value={num(r.ctns)} />
                  ) : null}
                  <DatoMovil label="Unidades" value={num(r.qty)} />
                  <DatoMovil
                    label="Precio"
                    value={money(r.unit, packing.moneda)}
                  />
                  <DatoMovil
                    label="Monto"
                    value={money(r.amount, packing.moneda)}
                    strong
                  />
                  {!r.same ? (
                    <>
                      <DatoMovil label="Peso" value={`${num(r.weight, 1)} kg`} />
                      <DatoMovil label="CBM" value={num(r.vol, 3)} />
                    </>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        </>
      ) : (
        // "Sin líneas" es distinto de "sin packing list": el proveedor mandó el
        // documento pero no cargó mercancía. TBL-01 §vacío pide distinguirlos.
        <p className="mt-6 text-[14px] text-grey-700 leading-[1.55]">
          Tu proveedor envió el documento pero todavía no cargó las líneas de
          mercancía. Escríbele para que las complete.
        </p>
      )}

      {/* ── Nota del proveedor ── */}
      {packing.nota?.trim() ? (
        <div className="mt-7 pt-6 border-t border-grey-200">
          <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
            Nota del proveedor
          </div>
          <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.55] whitespace-pre-line">
            {packing.nota.trim()}
          </p>
        </div>
      ) : null}
    </section>
  );
}

/**
 * El cotejo cajas anunciadas ↔ cajas del packing list.
 *
 * Mismo criterio que el bloque de recepción: **el desajuste se dice con todas
 * las letras y con el número exacto.** Mostrar sólo "7 cajas" sería cierto y
 * prácticamente una omisión.
 *
 * El color acompaña; el ícono y la frase son los que comunican (WCAG 1.4.1).
 * El tono va sobre el TEXTO en `--color-ink`, no en el color de estado: sobre
 * papel claro `--color-status-success` mide 4,33:1, por debajo del umbral de
 * cuerpo (ver la nota de contraste en `StatementLedgerTable`).
 */
function Cotejo({ cotejo }: { cotejo: CotejoDeCajas }) {
  const cuadra = cotejo.estado === "cuadra";
  const faltan = cotejo.estado === "de-menos";
  const tono = cuadra ? "var(--color-status-success)" : "var(--color-status-warning)";

  const frase = cuadra
    ? `Coincide con las ${cotejo.anunciadas} cajas que anunciaste.`
    : faltan
      ? `Anunciaste ${cotejo.anunciadas} cajas y el packing list trae ${cotejo.enPackingList}: son ${Math.abs(cotejo.diferencia)} menos.`
      : `Anunciaste ${cotejo.anunciadas} cajas y el packing list trae ${cotejo.enPackingList}: son ${cotejo.diferencia} más.`;

  return (
    <div
      className="mt-5 flex items-start gap-2.5 rounded-[12px] border-l-[3px] px-4 py-3"
      style={{
        background: `color-mix(in srgb, ${tono} 10%, transparent)`,
        borderColor: tono,
      }}
    >
      <span style={{ color: tono }} className="flex-shrink-0 mt-px">
        {cuadra ? <CheckIcon size={16} /> : <WarningIcon size={16} />}
      </span>
      <p className="text-[13.5px] text-ink leading-[1.5]">
        {frase}
        {!cuadra ? (
          <span className="block mt-1 text-[13px] text-grey-700">
            No siempre es un error — el proveedor pudo reagrupar la mercancía en
            menos cajas. Lo que mande de verdad se cuenta al recibirlo en Yiwu.
          </span>
        ) : null}
      </p>
    </div>
  );
}

/** Marca, código y HS: identifican el producto, pero no son su nombre. */
function SubLinea({ fila }: { fila: PackingListRow }) {
  const partes = [
    fila.brand.trim(),
    fila.code.trim(),
    fila.hs.trim() ? `HS ${fila.hs.trim()}` : "",
  ].filter(Boolean);
  if (partes.length === 0) return null;
  return (
    <span className="mt-1 block text-[11.5px] text-grey-500">
      {partes.join(" · ")}
    </span>
  );
}

function Total({
  label,
  value,
  destacado = false,
}: {
  label: string;
  value: string;
  destacado?: boolean;
}) {
  return (
    <div
      className="rounded-[12px] px-3.5 py-3"
      style={{
        background: destacado
          ? "color-mix(in srgb, var(--color-wine) 10%, transparent)"
          : "var(--color-paper)",
      }}
    >
      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-grey-500">
        {label}
      </dt>
      <dd
        className="mt-1.5 text-[15px] font-bold"
        style={{
          fontFamily: MONO,
          // `--color-wine-text` es wine COMO TEXTO (BD-026) y no voltea en el
          // portal oscuro; `--color-wine` sí lo haría.
          color: destacado ? "var(--color-wine-text)" : "var(--color-ink)",
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`py-2.5 pr-3 text-[10.5px] font-bold uppercase tracking-[0.1em] text-grey-500 whitespace-nowrap ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="py-3 pr-3">{children}</td>;
}

function TdNum({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={`py-3 pr-3 text-right whitespace-nowrap text-[12.5px] ${
        strong ? "font-bold text-ink" : "text-grey-700"
      }`}
      style={{ fontFamily: MONO }}
    >
      {children}
    </td>
  );
}

function DatoMovil({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-grey-500">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-[13px] ${strong ? "font-bold text-ink" : "text-grey-700"}`}
        style={{ fontFamily: MONO }}
      >
        {value}
      </dd>
    </div>
  );
}
