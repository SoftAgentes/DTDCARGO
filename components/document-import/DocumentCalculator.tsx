"use client";

/**
 * SDD-0473 · Del documento leído al precio de traerlo.
 *
 * El último tramo del recorrido: el cliente ya cargó su factura y su packing
 * list, el documento tiene peso y CBM, y ahora quiere saber cuánto cuesta el
 * puerta a puerta. No vuelve a escribir metros cúbicos: los toma del documento.
 *
 * Cuatro reglas que esta pantalla NO negocia:
 *
 *  - **El motor es uno solo.** No calcula nada acá. Manda `estimate` al
 *    servidor, que corre `calcularEnvioLCL` — el mismo de `/tarifas`. Si esta
 *    pantalla hiciera su propia cuenta, tarde o temprano diría otro número que
 *    la calculadora pública, y el cliente vería dos precios para un mismo envío.
 *
 *  - **El mínimo se ve.** Cuando la carga es chica, el precio no es CBM ×
 *    tarifa: es el piso facturable. Esconderlo hace que el desglose no cuadre y
 *    el cliente sienta que le cobraron de más. Se muestra como una línea propia.
 *
 *  - **Transporte y mercancía son dos números distintos.** Acá sólo sale el
 *    flete. El valor de lo que compró vive en el documento y se nombra aparte,
 *    nunca sumado: sumarlos sería inventar un costo de importación que no
 *    incluye aranceles.
 *
 *  - **Un dato que falta no se rellena, se señala.** Si el documento no tiene
 *    peso o CBM, el servidor responde `missing_logistics` y esta pantalla
 *    devuelve al cliente al documento en vez de cotizar con ceros.
 *
 * Frontera: vive en `components/`, así que sólo importa de `lib/shared/` y de
 * `lib/calculadora` (tipos del motor público). Nada del ERP.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CalcParams, Ciudad, EnvioCotizacion, EnvioInput } from "@/lib/calculadora";
import { aggregateTransportDeclarations } from "@/lib/shared/document-import";
import {
  createDocumentClient,
  documentText,
  DocumentRequestError,
  type DocumentClient,
  type DocumentLocale,
  type DocumentWorkspace,
} from "./document-client";
import s from "./document-import.module.css";

/** Destino tal como lo publica la acción `destinations`: id y etiqueta, nada más. */
type Destination = { id: string; label: string };

/** Lo que devuelve `estimate`. Espeja `estimateDocuments` en el servidor. */
export type DocumentEstimate = {
  kind: "transport_estimate";
  currency: "USD";
  totals: { cbm: number; grossWeightKg: number; cartons: number | null };
  result: EnvioCotizacion;
  input: EnvioInput;
  rates: {
    rate: { per_cbm: number; min_charge: number | null; valid_until: string | null };
    params: CalcParams;
    city?: Ciudad;
  };
  documentRevisions: { workspaceId: string; revision: number; confirmed: boolean }[];
  generatedAt: string;
  notice: string;
  savedId?: string;
};

/**
 * Códigos que no son "algo salió mal" sino "falta un paso tuyo". Cada uno tiene
 * una salida concreta; mostrarlos como error genérico dejaría al cliente sin
 * saber qué hacer.
 */
const NEEDS_DOCUMENT = ["missing_logistics", "review_required", "transport_review_required", "revision_conflict"];

export function DocumentCalculator({
  workspaces,
  locale = "es",
  client,
  canSave = false,
  merchandise = null,
  onNeedsDocument,
  onEstimate,
  disabled = false,
}: {
  /**
   * Los documentos que entran en este estimado. Varios sólo desde el portal:
   * el servidor exige sesión para combinar más de uno.
   */
  workspaces: DocumentWorkspace[];
  disabled?: boolean;
  locale?: DocumentLocale;
  /** Inyección explícita para pruebas/fixtures. En producción nace del default. */
  client?: DocumentClient;
  /** Guardar el estimado exige sesión de portal. Apagado por default. */
  canSave?: boolean;
  /**
   * El valor de la mercancía, ya calculado sobre el documento. Se muestra al
   * lado del flete, JAMÁS sumado: son dos cosas distintas y sumarlas daría un
   * "costo total" falso que no incluye aranceles.
   */
  merchandise?: { amount: number; currency: string } | null;
  /** "Volver al documento": la salida cuando falta peso, CBM o revisión. */
  onNeedsDocument?: () => void;
  /** Cada estimado logrado sube al dueño del estado. */
  onEstimate?: (estimate: DocumentEstimate) => void;
}) {
  const t = useCallback(
    (zh: string, es: string, en: string) => documentText(locale, zh, es, en),
    [locale],
  );
  const uid = useId();
  const fallback = useRef<DocumentClient | null>(null);
  if (!client && !fallback.current) fallback.current = createDocumentClient();
  const api = client ?? fallback.current!;

  const [destinations, setDestinations] = useState<Destination[] | null>(null);
  const [cityId, setCityId] = useState("");
  const [packaging, setPackaging] = useState<"estandar" | "especial">("estandar");
  const [received, setReceived] = useState<{ key: string; data: DocumentEstimate } | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const mounted = useRef(true), generation = useRef(0);
  const workspaceIds = workspaces.map(w => w.id);
  const expectedRevisions = workspaces.map(w => ({ workspaceId: w.id, revision: w.revision }));
  const declarations = aggregateTransportDeclarations(workspaces.map(w => w.draft));
  const transportPending = declarations.battery.pending || declarations.specialCargo.pending;
  const binding = JSON.stringify([expectedRevisions, declarations, cityId, packaging, disabled]);
  const latestBinding = useRef(binding); latestBinding.current = binding;
  const estimate = received?.key === binding && !disabled ? received.data : null;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  useEffect(() => { generation.current++; setBusy(false); setReceived(null); setSaved(false); setError(null); }, [binding, api]);

  // El catálogo de destinos viene del servidor, no de una constante local: las
  // ciudades y sus tramos cambian sin tocar este archivo.
  useEffect(() => {
    let alive = true;
    api
      .get<{ cities: Destination[] }>("destinations")
      .then((data) => {
        if (alive) setDestinations(data.cities ?? []);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setDestinations([]);
        setError({
          code: e instanceof DocumentRequestError ? e.code : "unavailable",
          message:
            e instanceof DocumentRequestError
              ? e.message
              : t(
                  "目的地清单暂时无法加载。",
                  "No pudimos cargar los destinos. Intenta de nuevo.",
                  "We could not load the destinations. Try again.",
                ),
        });
      });
    return () => {
      alive = false;
    };
  }, [api, t]);

  // Cambiar cualquier entrada invalida el estimado anterior: dejarlo en pantalla
  // haría creer que ese precio corresponde al destino nuevo.
  const change = <T,>(set: (value: T) => void) => (value: T) => {
    generation.current++;
    set(value);
    setReceived(null);
    setBusy(false);
    setSaved(false);
  };

  async function calculate(save: boolean) {
    if (busy || disabled || transportPending) return;
    const requestGeneration = ++generation.current, requestBinding = binding;
    const current = () => mounted.current && generation.current === requestGeneration && latestBinding.current === requestBinding;
    setBusy(true);
    setError(null);
    try {
      const data = await api.post<DocumentEstimate>("estimate", {
        workspaceIds,
        expectedRevisions,
        cityId,
        packaging,
        ...(save ? { save: true } : {}),
      });
      if (!current()) return;
      if (data.documentRevisions.length !== expectedRevisions.length || expectedRevisions.some(w => !data.documentRevisions.some(r => r.workspaceId === w.workspaceId && r.revision === w.revision))) throw new DocumentRequestError(409, "revision_conflict", t("文件已更新，请载入当前修订版。", "El documento cambió. Carga la revisión compartida antes de cotizar.", "The document changed. Load the shared revision before estimating."));
      setReceived({ key: requestBinding, data });
      setSaved(Boolean(data.savedId));
      onEstimate?.(data);
    } catch (e: unknown) {
      if (!current()) return;
      setReceived(null);
      setSaved(false);
      setError({
        code: e instanceof DocumentRequestError ? e.code : "unavailable",
        message:
          e instanceof DocumentRequestError
            ? e.message
            : t(
                "无法完成计算。",
                "No pudimos calcular el estimado. Intenta de nuevo.",
                "We could not calculate the estimate. Try again.",
              ),
      });
    } finally {
      if (current()) setBusy(false);
    }
  }

  const intl = locale === "zh" ? "zh-CN" : locale === "es" ? "es-VE" : "en-US";
  const pending = t("待补充", "Sin declarar", "Not declared");
  const number = (n: number | null | undefined, decimals = 3) =>
    n === null || n === undefined || !Number.isFinite(n)
      ? pending
      : new Intl.NumberFormat(intl, { maximumFractionDigits: decimals }).format(n);
  const usd = (n: number) =>
    "USD " +
    new Intl.NumberFormat(locale === "es" ? "es-VE" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const quote = estimate?.result;
  /**
   * Las líneas del desglose que efectivamente aplicaron. Las de cero no se
   * muestran: una lista de ceros esconde lo que sí cobró.
   *
   * `ajusteMinimo` va al final y con su propia explicación — es el único
   * concepto que no nace de la carga sino del piso de la tarifa, y sin nombrarlo
   * la suma de las otras líneas no llega al total.
   */
  const lines: { label: string; amount: number; hint?: string }[] = quote
    ? (
        [
          {
            label: t("基础运费", "Flete base", "Base freight"),
            amount: quote.precioBase,
            hint: `${number(estimate!.totals.cbm)} m³ × ${usd(estimate!.rates.rate.per_cbm)}`,
          },
          {
            label: t("超重附加费", "Recargo por densidad", "Density surcharge"),
            amount: quote.recargoExcedente,
            hint: t(
              "重量超出该体积所含额度。",
              "El peso excede lo incluido para ese volumen.",
              "Weight exceeds what that volume includes.",
            ),
          },
          {
            label: t("国内运输", "Entrega nacional", "Domestic delivery"),
            amount: quote.recargoCiudad,
            hint: quote.ciudad?.label,
          },
          {
            label: t("特殊包装", "Embalaje especial", "Special packaging"),
            amount: quote.recargoEmbalaje,
          },
          { label: t("电池附加费", "Recargo por baterías", "Battery surcharge"), amount: quote.recargoBateria },
          { label: t("基地折扣", "Descuento sede", "Branch discount"), amount: quote.descuentoSede },
          {
            label: t("最低计费调整", "Ajuste al mínimo facturable", "Minimum charge adjustment"),
            amount: quote.ajusteMinimo,
            hint: t(
              "货量低于最低计费量，按最低标准收费。",
              "La carga está por debajo del mínimo: se cobra el piso de la tarifa.",
              "The load is below the minimum: the tariff floor applies.",
            ),
          },
        ] as { label: string; amount: number; hint?: string }[]
      ).filter((line) => line.amount !== 0)
    : [];

  if (!workspaceIds.length) return null;

  return (
    <section
      className={[s.root, s.card, s.stack].join(" ")}
      aria-label={t("运费估算", "Estimado de transporte", "Transport estimate")}
    >
      <div className={s.bar}>
        <h3>{t("这批货运到委内瑞拉多少钱", "¿Cuánto cuesta traer esto?", "What does it cost to ship this?")}</h3>
        <p className={s.muted}>
          {t(
            "体积和重量取自你的文件，无需重新填写。",
            "El volumen y el peso salen de tus documentos. No los escribas otra vez.",
            "Volume and weight come from your documents. No need to type them again.",
          )}
        </p>
      </div>

      <div className={s.fields}>
        <label className={s.field} htmlFor={`${uid}-city`}>
          {t("委内瑞拉目的地", "Destino en Venezuela", "Destination in Venezuela")}
          <select
            id={`${uid}-city`}
            value={cityId}
            disabled={disabled || destinations === null}
            onChange={(e) => change(setCityId)(e.target.value)}
          >
            <option value="">
              {destinations === null
                ? t("加载中…", "Cargando…", "Loading…")
                : t("请选择城市", "Elige la ciudad", "Choose the city")}
            </option>
            {(destinations ?? []).map((city) => (
              <option key={city.id} value={city.id}>
                {city.label}
              </option>
            ))}
          </select>
        </label>

        <label className={s.field} htmlFor={`${uid}-packaging`}>
          {t("包装", "Embalaje", "Packaging")}
          <select
            id={`${uid}-packaging`}
            value={packaging}
            disabled={disabled}
            onChange={(e) =>
              change(setPackaging)(e.target.value === "especial" ? "especial" : "estandar")
            }
          >
            <option value="estandar">{t("标准", "Estándar", "Standard")}</option>
            <option value="especial">{t("特殊（加固木箱）", "Especial (reforzado)", "Special (reinforced)")}</option>
          </select>
        </label>

        <dl className={s.summaryList}>
          {(["battery", "specialCargo"] as const).map(key => <div key={key}>
            <dt>{key === "battery" ? t("含电池", "Lleva baterías", "Contains batteries") : t("特殊或受管制货物", "Carga especial o regulada", "Special or regulated cargo")}</dt>
            <dd>{declarations[key].value === true ? t("是", "Sí", "Yes") : declarations[key].value === false ? t("否", "No", "No") : t("待审核", "Pendiente de revisión", "Review pending")}{declarations[key].value === true && declarations[key].pending ? t(" · 部分采购待审核", " · faltan compras por revisar", " · some purchases still need review") : ""}</dd>
          </div>)}
        </dl>
      </div>

      {transportPending && <p className={s.notice}>{t("请在文件中核对并保存电池及受管制货物声明。", "Revisa y guarda la declaración de baterías y carga regulada en el documento.", "Review and save the battery and regulated cargo declarations in the document.")}{onNeedsDocument && <button type="button" className="btn btn-ghost" onClick={onNeedsDocument}>{t("返回文件", "Volver al documento", "Back to the document")}</button>}</p>}

      <div className={s.actions}>
        <button type="button" className="btn btn-primary" disabled={busy || disabled || transportPending || !cityId} onClick={() => void calculate(false)}>
          {busy
            ? t("计算中…", "Calculando…", "Calculating…")
            : t("计算运费", "Calcular el transporte", "Calculate transport")}
        </button>
        {canSave && estimate && !saved && (
          <button type="button" className="btn btn-ghost" disabled={busy || disabled} onClick={() => void calculate(true)}>
            {t("保存此估算", "Guardar este estimado", "Save this estimate")}
          </button>
        )}
        {saved && <span className={s.badge}>{t("已保存", "Guardado", "Saved")}</span>}
      </div>

      {error && (
        <div className={[s.notice, s.error].join(" ")} role="alert">
          <p>{error.message}</p>
          {NEEDS_DOCUMENT.includes(error.code) && onNeedsDocument && (
            <div className={s.actions}>
              <button type="button" className="btn btn-primary" onClick={onNeedsDocument}>
                {t("返回文件", "Volver al documento", "Back to the document")}
              </button>
            </div>
          )}
        </div>
      )}

      {estimate && quote && (
        <div className={[s.stack, s.editor].join(" ")} aria-live="polite">
          {/* Lo que el documento aportó. Va primero: es la prueba de que el
              precio no salió de aire, sino de lo que el cliente cargó. */}
          <p className={s.muted}>
            {t("取自你的文件", "Tomado de tus documentos", "Taken from your documents")}:{" "}
            <strong>{number(estimate.totals.cbm)} m³</strong> ·{" "}
            <strong>{number(estimate.totals.grossWeightKg)} kg</strong> ·{" "}
            <strong>
              {estimate.totals.cartons === null
                ? pending
                : `${number(estimate.totals.cartons, 0)} ${t("箱", "cajas", "cartons")}`}
            </strong>
          </p>

          {quote.alerta && (
            <p className={[s.notice, s.error].join(" ")} role="alert">
              {quote.alerta.mensaje}
            </p>
          )}
          {quote.avisoEntrega && <p className={s.notice}>{quote.avisoEntrega}</p>}
          {quote.cercana && (
            <p className={s.notice}>
              {t("最近的覆盖城市", "La ciudad cubierta más cercana", "Nearest covered city")}:{" "}
              <strong>{quote.cercana.label}</strong>
            </p>
          )}

          {!quote.alerta && (
            <>
              <div>
                {lines.map((line) => (
                  <div key={line.label} className={s.fileRow}>
                    <span className={s.fileName}>
                      {line.label}
                      {line.hint && <small className={s.muted}> · {line.hint}</small>}
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{usd(line.amount)}</span>
                  </div>
                ))}
              </div>

              <div className={s.totals}>
                <span>
                  <strong style={{ fontSize: "1.5rem" }}>{usd(quote.total)}</strong>
                  <small>
                    {quote.sinPeso
                      ? t("起价（运输）", "Desde (transporte)", "From (transport)")
                      : t("运输合计", "Transporte, todo incluido", "Transport, all included")}
                  </small>
                </span>
                {merchandise && (
                  <span>
                    <strong>
                      {merchandise.currency}{" "}
                      {new Intl.NumberFormat(locale === "es" ? "es-VE" : "en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(merchandise.amount)}
                    </strong>
                    <small>{t("货值（不含运费）", "Mercancía (aparte)", "Merchandise (separate)")}</small>
                  </span>
                )}
              </div>

              {/* Los dos números viven juntos en pantalla pero nunca se suman: el
                  costo real de importar incluye aranceles que acá no se calculan. */}
              {merchandise && (
                <p className={s.muted}>
                  {t(
                    "两项金额不相加：货值不含关税和税费。",
                    "Los dos montos no se suman: el valor de la mercancía no incluye aranceles ni impuestos.",
                    "The two amounts are not added: merchandise value excludes duties and taxes.",
                  )}
                </p>
              )}
            </>
          )}

          <p className={s.muted}>{estimate.notice}</p>
        </div>
      )}
    </section>
  );
}
