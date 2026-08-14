"use client";

import { useMemo, useState } from "react";
import {
  CONFIG,
  CIUDADES,
  DEFAULT_PARAMS,
  CONSOLIDADO_CBM_RATE,
  CONSOLIDADO_DESTINO,
  CONSOLIDADO_CBM_MINIMO,
  CONSOLIDADO_MIN_CBM_MENSAJE,
  calcularEnvioLCL,
  cbmFromDimensions,
  whatsappTextFromCotizacion,
  avisoCampoPesoVacio,
  mensajeEstimadoSinPeso,
  coberturaDestino,
  describirVolumenEnCajas,
  mensajeDestinoSinTarifa,
  mensajeDestinoSinCobertura,
  vecinaDeDestino,
  type EnvioInput,
  type EnvioCotizacion,
  type CalcParams,
  type CalcModo,
  type Ciudad,
} from "@/lib/calculadora";
import Link from "next/link";
import { DecimalInput } from "@/components/DecimalInput";
import { CbmAyuda } from "@/components/CbmAyuda";
import { CONTACT } from "@/lib/design-tokens";
import { ArrowIcon, WhatsAppIcon } from "@/components/Icon";
import { EstimadoModal, type EstimadoContact } from "@/components/EstimadoModal";
import { DestinoCombobox } from "@/components/DestinoCombobox";
import { trackWhatsAppConversion } from "@/components/Analytics";
import { buildEstimadoWhatsAppMessage } from "@/lib/public/estimado-web";
import { reportCalcEvent } from "@/lib/public/calc-event-report";

/**
 * Calculadora LCL DDP — UI del formulario + render del resultado.
 *
 * Diseño Cloud Design (Fase 2, 2026-06-06): una sola card en 2 columnas con
 * divisor — izquierda = entrada (header + tarifa + carga + opciones + destino),
 * derecha = resultado (contenedor que se llena + panel del total + desglose +
 * badge + nudge + CTA). 100% EN VIVO: sin botón "Calcular", el estimado se
 * recalcula con cada cambio. Toda la lógica de pricing vive en lib/calculadora.ts.
 */
type ServerRate = {
  per_cbm: number;
  min_charge: number | null;
  valid_until: string | null;
} | null;

/**
 * Aviso de un campo (CBM/peso) con severidad — mapea a los 3 tonos del Norte:
 * `danger` (bloqueo real: deriva al asesor/FCL) = rojo · `info` (dato de precio,
 * NO es un problema, ej. recargo por excedente) = wine · `warning` (ámbar
 * genérico, fallback). El `BigInput` pinta el borde + el texto según el tono.
 */
type CalcWarning = { text: string; tone: "danger" | "warning" | "info" } | null;

/**
 * Modalidad que calcula el form (el tipo vive en `lib/calculadora`, que es
 * donde se aplica la diferencia de reglas):
 *  · `ddp`          = Puerta a Puerta (DDP): tarifa pública de la DB, ciudad de
 *                     destino en Venezuela, todo incluido hasta la puerta.
 *  · `consolidado`  = LCL Consolidado: tarifa fija `CONSOLIDADO_CBM_RATE`
 *                     (dato del founder), SIN ciudad — llega hasta puerto y te
 *                     entregamos tu propio BL; aduana e impuestos van por
 *                     cuenta del cliente. Mismos recargos que el DDP, con UNA
 *                     regla propia: por debajo de `CONSOLIDADO_CBM_MINIMO`
 *                     (1 m³) no cotiza y deriva al asesor.
 */
export type { CalcModo };

export function CalculadoraForm({
  serverRate,
  serverConfig,
  ciudades,
  directWhatsApp = false,
  modo = "ddp",
}: {
  serverRate?: ServerRate;
  serverConfig?: CalcParams | null;
  ciudades?: Ciudad[];
  /**
   * CTA en modo WhatsApp DIRECTO (Fase 3 · /tarifas): el botón "Enviar por
   * WhatsApp" es un `<a>` a wa.me con el texto del estimado, sin abrir el modal
   * de captura ni pegarle a `/api/public/estimacion` (la calc NO guarda nada).
   * En false (legacy) mantiene el flujo con EstimadoModal.
   */
  directWhatsApp?: boolean;
  /** Modalidad calculada. Default `ddp` = comportamiento histórico intacto. */
  modo?: CalcModo;
}) {
  const esConsolidado = modo === "consolidado";

  // Tarifa base real o default de CONFIG (cero regresión si no hay pública).
  const ddpRate =
    serverRate?.per_cbm && serverRate.per_cbm > 0
      ? serverRate.per_cbm
      : CONFIG.tarifaBaseCBM;
  const ddpMinCharge =
    serverRate?.min_charge && serverRate.min_charge > 0
      ? serverRate.min_charge
      : CONFIG.minimoFacturable;

  // Consolidado: tarifa fija del founder y SIN piso en USD — su mínimo es de
  // VOLUMEN (1 m³, `CONSOLIDADO_CBM_MINIMO`): por debajo no cotiza y deriva al
  // asesor, así que 1 × 580 = $580 ya queda muy por encima de cualquier piso.
  const baseRate = esConsolidado ? CONSOLIDADO_CBM_RATE : ddpRate;
  const minCharge = esConsolidado ? 0 : ddpMinCharge;
  const minChargeOverride = esConsolidado
    ? undefined
    : (serverRate?.min_charge ?? undefined);
  // Punto de cruce: CBM donde el cálculo iguala al mínimo. Derivado de la tarifa.
  // En consolidado queda en 0 (no hay piso) → el aviso que aplica es el de 1 m³.
  const crossoverCbm = baseRate > 0 ? minCharge / baseRate : 0;
  const params = serverConfig ?? DEFAULT_PARAMS;
  // Consolidado: destino sintético (hasta puerto) → sin selector de ciudad y
  // sin recargo por distancia. DDP: catálogo de la DB o el array por default.
  const cityList = useMemo(
    () =>
      esConsolidado
        ? [CONSOLIDADO_DESTINO]
        : ciudades && ciudades.length > 0
          ? ciudades
          : CIUDADES,
    [esConsolidado, ciudades],
  );
  // Preseleccionada: Valencia, la sede. Va EXPLÍCITA y no por posición.
  //
  // Antes esto buscaba `casco-central`, la opción agrupada que murió con
  // SDD-0237, y caía a `cityList[0]`. Con los 178 destinos ordenados por
  // sort_order, el primero pasó a ser **Acarigua** — no Valencia. Confiar en la
  // posición dejaba la calculadora abriendo en una ciudad arbitraria que
  // depende de cómo el admin ordene la lista.
  const defaultCiudadId =
    cityList.find((c) => c.id === "valencia")?.id ?? cityList[0]?.id ?? "valencia";

  const [form, setForm] = useState<EnvioInput>({
    // El motor necesita la modalidad para aplicar la puerta de 1 m³ del
    // consolidado (lib/calculadora · CONSOLIDADO_CBM_MINIMO).
    modo,
    cbmTotal: 0,
    pesoKg: 0,
    embalaje: "estandar",
    ciudadId: defaultCiudadId,
    bateria: false,
    cargaEspecial: false,
    tarifaCBMOverride: baseRate,
    minChargeOverride,
  });

  // SDD-0061 Fase B1 · modal de captura del estimado web (nota + nombre + tel).
  const [modalOpen, setModalOpen] = useState(false);
  // SDD-0061 Fase B2 · código del estimado guardado (para el CTA de registro).
  const [savedEstimateCode, setSavedEstimateCode] = useState<string | null>(null);

  function update<K extends keyof EnvioInput>(key: K, value: EnvioInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Panel "CBM por medidas": para el cliente que no sabe su CBM y lo deriva de
  // las dimensiones de una caja × cantidad. Oculto por defecto. Mientras está
  // abierto, "CBM total" es read-only y se DERIVA de las medidas (un solo
  // sentido: medidas → CBM, sin efecto ni loop). Al cerrar, congelamos el
  // último valor en el form para que quede editable a mano.
  const [cbmPanelOpen, setCbmPanelOpen] = useState(false);
  const [dims, setDims] = useState({ alto: 0, ancho: 0, largo: 0, cajas: 1 });

  // CBM derivado de las medidas (puro, en render — no useEffect → sin warning
  // de cascading renders ni riesgo de loop).
  const cbmDesdeMedidas = cbmFromDimensions(
    dims.alto,
    dims.ancho,
    dims.largo,
    dims.cajas,
  );

  // Form efectivo que alimenta el cálculo: con el panel abierto Y con medidas
  // válidas (cbmDesdeMedidas > 0), el CBM total viene de las medidas. Si el panel
  // está abierto pero aún NO hay medidas, se conserva el CBM manual de `form` —
  // así abrir el panel por curiosidad no borra ni oculta un valor ya escrito
  // (bug "a veces no muestra el cálculo": abrir/cerrar el panel sin medir dejaba
  // el CBM en 0 y el estimado desaparecía).
  const effectiveForm = useMemo<EnvioInput>(
    () =>
      cbmPanelOpen && cbmDesdeMedidas > 0
        ? { ...form, cbmTotal: cbmDesdeMedidas }
        : form,
    [cbmPanelOpen, cbmDesdeMedidas, form],
  );

  // Cerrar el panel: congela el CBM calculado SOLO si hubo medidas (> 0); si no,
  // deja intacto el valor manual previo. Abrir: solo despliega; el CBM lo deriva
  // el render cuando haya medidas.
  function toggleCbmPanel(open: boolean) {
    if (!open && cbmDesdeMedidas > 0) update("cbmTotal", cbmDesdeMedidas);
    setCbmPanelOpen(open);
  }

  // Estimado SIEMPRE en vivo (no hay botón Calcular). Si falta CBM/peso, la
  // función devuelve una alerta "carga_invalida" que tratamos como estado vacío.
  const cotizacion = useMemo(
    () => calcularEnvioLCL(effectiveForm, params, cityList),
    [effectiveForm, params, cityList],
  );

  // Destino elegido, para la nota de cobertura bajo el selector. NO sale de
  // `cotizacion.ciudad`: el motor devuelve `ciudad: null` en cuanto hay una
  // alerta, y justo los dos casos que la nota tiene que explicar (sin cobertura
  // y sin tarifa) son alertas. Con el form vacío tampoco habría ciudad.
  const ciudadElegida = useMemo(
    () => cityList.find((c) => c.id === form.ciudadId) ?? null,
    [cityList, form.ciudadId],
  );

  // Ciudades donde el cliente NO paga el tramo nacional. Se DERIVAN del mismo
  // catálogo que alimenta el selector — nunca se escriben a mano. Si el founder
  // suma o quita una ciudad de la zona sin costo desde el Admin, esta lista se
  // mueve sola, sin deploy. Escribirla a mano garantizaba que un día dijera algo
  // distinto de lo que cobra el motor.
  const ciudadesIncluidas = useMemo(
    () => cityList.filter((c) => c.casco),
    [cityList],
  );
  // ¿Hay suficiente para mostrar algo? **Sólo el CBM (SDD-0257).**
  //
  // Antes esto exigía además el peso, y de ahí salía el bug que lo motivó: el
  // cliente escribía 12 m³, veía el contenedor llenarse al 18% —`ContainerFill`
  // usa sólo el CBM— y del otro lado no aparecía nada. Ni precio, ni desglose,
  // ni botón de WhatsApp: TODO el CTA vive detrás de este booleano. No se leía
  // como "me falta un dato", se leía como que se trancó, y el cliente se iba.
  const tieneCarga = effectiveForm.cbmTotal > 0;
  // Hay precio, pero es un piso: falta el peso. Lo decide el motor, no la UI.
  const sinPeso = cotizacion.sinPeso;

  // Aviso del CBM: mínimo (punto de cruce) o máximo (contenedor). Usa el CBM
  // efectivo (derivado de medidas si el panel está abierto).
  const effectiveCbm = effectiveForm.cbmTotal;
  const cbmWarning: CalcWarning =
    effectiveCbm > params.cbmMaxContenedor
      ? { text: "Eso es más que un contenedor. Consulta con tu asesor.", tone: "danger" }
      : // Consolidado: por debajo de 1 m³ no hay precio, hay asesor. Es bloqueo
        // real (el BL propio es un fijo de hasta USD 300) → tono `danger`.
        esConsolidado && effectiveCbm > 0 && effectiveCbm < CONSOLIDADO_CBM_MINIMO
        ? { text: CONSOLIDADO_MIN_CBM_MENSAJE, tone: "danger" }
        : effectiveCbm > 0 && effectiveCbm < crossoverCbm
          ? {
              // El punto de cruce se sigue calculando igual (piso ÷ tarifa),
              // pero se DICE en cajas. "0.0625 m³" no le dice nada a nadie: el
              // cliente no sabe si es mucho o poco ni qué hacer con el dato.
              text: `Nuestro mínimo son ${describirVolumenEnCajas(crossoverCbm)} — por debajo, el envío sale $${minCharge}.`,
              tone: "info",
            }
          : null;

  // Aviso del peso: tope absoluto de contenedor + recargo por densidad (peso por
  // CBM). Founder 2026-07-06: el exceso de densidad ya NO deriva al asesor — el
  // $/kg excedente se cobra de forma CONTINUA sobre `pesoIncluidoKg`/CBM, sin
  // corte en `pesoMaxKg` (el monto lo computa lib/calculadora.ts). El único
  // bloqueo real es el peso absoluto por contenedor. Usa `effectiveCbm`
  // (contempla el panel "CBM por medidas").
  const pesoIngresado = form.pesoKg ?? 0;
  const pesoWarning = ((): CalcWarning => {
    if (pesoIngresado > params.pesoMaxContenedorKg)
      return {
        text: "Esto es más que el peso permitido por contenedor; consulta a tu asesor.",
        tone: "danger",
      };
    // SDD-0257 — falta el peso pero YA hay precio. Tono `info` (wine), NUNCA
    // rojo: el campo no está mal llenado, está pendiente. El techo lo dicta el
    // motor (`pesoMaxSinRecargoKg`), que es el mismo número que sostiene el
    // "Desde $X" del panel — no se re-deriva acá.
    if (sinPeso && cotizacion.pesoMaxSinRecargoKg > 0)
      return {
        text: avisoCampoPesoVacio(cotizacion.pesoMaxSinRecargoKg),
        tone: "info",
      };
    if (effectiveCbm <= 0 || pesoIngresado <= 0) return null;
    // Tope de peso por envío (anti-monopolio), density-aware: deriva al asesor
    // solo si es pesado Y denso (densidad > equilibrio del contenedor). Un envío
    // pesado pero liviano no monopoliza el peso → sigue cotizando.
    const equilibrioDensidad =
      params.cbmMaxContenedor > 0
        ? params.pesoMaxContenedorKg / params.cbmMaxContenedor
        : Infinity;
    if (
      pesoIngresado > params.pesoMaxEnvioKg &&
      pesoIngresado / effectiveCbm > equilibrioDensidad
    )
      return {
        text: "Por el peso de esta carga la cotizamos a medida — escríbele a tu asesor.",
        tone: "danger",
      };
    const fmt = (n: number) => parseFloat(n.toFixed(2)).toString();
    const maxSinRecargo = effectiveCbm * params.pesoIncluidoKg;
    // Excedente de densidad → NO es un problema, es info del recargo (wine). El
    // MONTO ($) y el $/kg NO van acá (founder 2026-07-12): el $/kg se ajusta con
    // el cambio que definamos, así que el dinero vive SOLO en el desglose de la
    // derecha ("Excedente de peso"). Acá dejamos únicamente el dato físico (kg).
    if (pesoIngresado > maxSinRecargo) {
      const exceso = pesoIngresado - maxSinRecargo;
      return {
        text: `El máximo de peso sin recargo para ${fmt(effectiveCbm)} m³ es ${fmt(maxSinRecargo)} kg. Te pasas por ${fmt(exceso)} kg.`,
        tone: "info",
      };
    }
    return null;
  })();

  // Confirmar desde el modal: ya tenemos el EST del ERP (o null), abrimos wa.me.
  function handleConfirm(contact: EstimadoContact, estimateCode: string | null) {
    const base = whatsappTextFromCotizacion(cotizacion, effectiveForm);
    const text = buildEstimadoWhatsAppMessage({
      baseMessage: base,
      nota: contact.nota,
      estimateCode,
    });
    const url = `https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(text)}`;
    // window.open NO pasa por el listener global de <a> — conversión manual.
    trackWhatsAppConversion("calculadora");
    window.open(url, "_blank", "noopener,noreferrer");
    setSavedEstimateCode(estimateCode);
    setModalOpen(false);
  }

  return (
    <>
    <div
      className="card-shadow rounded-[20px] overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #16233F 0%, #0B1428 100%)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* ── COLUMNA IZQUIERDA · ENTRADA ──
            En consolidado (LCL) el orden se invierte (`lg:order-2`, solo desde
            el breakpoint de 2 columnas): el contenedor que se llena cambia de
            lado para marcar visualmente que es otra lógica de precio que el
            puerta a puerta — mismo criterio del mockup Cloud Design
            "Tarifas · DTD-Cargo.html". */}
        <div
          className={`p-6 lg:p-9 flex flex-col gap-5 ${esConsolidado ? "lg:order-2" : "lg:order-1"}`}
        >
          {/* Wordmark + eyebrow */}
          <div className="flex items-center justify-between gap-3">
            <span
              className="text-[19px] leading-none"
              style={{ fontFamily: "var(--font-brand-display)" }}
            >
              <span style={{ color: "var(--wine-on-dark, #E8748A)" }}>DTD</span>{" "}
              <span className="text-white">Cargo</span>
            </span>
            <span
              className="text-[11px] font-bold tracking-[0.14em] uppercase"
              style={{ color: "var(--wine-on-dark, #E8748A)" }}
            >
              {esConsolidado
                ? "Calculadora LCL consolidado"
                : "Calculadora puerta a puerta"}
            </span>
          </div>

          {/* Título + subtítulo */}
          <div>
            <h2
              className="text-[26px] lg:text-[30px] leading-[1.1] tracking-[-0.01em] text-white"
              style={{ fontFamily: "var(--font-archivo-black)" }}
            >
              {esConsolidado
                ? "Cotiza tu carga consolidada hasta puerto"
                : "Cotiza tu carga China → Venezuela"}
            </h2>
            <p
              className="mt-2.5 text-[14px] leading-[1.5]"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              {esConsolidado ? (
                <>
                  Tu carga viaja consolidada y te entregamos{" "}
                  <strong className="text-white">tu propio Bill of Lading</strong>{" "}
                  en Venezuela. Indica tu volumen y peso y te damos un estimado al
                  instante.
                </>
              ) : (
                <>
                  Puerta a puerta, pagas al llegar. Indica tu volumen y peso y te
                  damos un estimado al instante.
                </>
              )}
            </p>
          </div>

          {/* Tarifa de CBM */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label
                htmlFor="tarifa-cbm"
                className="text-[11px] font-bold tracking-[0.12em] uppercase"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                Tarifa de CBM
              </label>
              <span
                className="text-[9.5px] font-bold tracking-[0.08em] uppercase rounded-[6px] px-2 py-[3px]"
                style={{
                  color: "var(--wine-on-dark, #E8748A)",
                  background: "rgba(255,255,255,0.08)",
                }}
              >
                Auto · editable
              </span>
            </div>
            <div
              className="flex items-center gap-2 rounded-[12px] px-3.5 h-[52px] border border-white/[0.14] focus-within:border-white/40 transition-colors"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <span className="text-[16px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>$</span>
              <DecimalInput
                id="tarifa-cbm"
                value={form.tarifaCBMOverride ?? 0}
                onValueChange={(n) =>
                  update("tarifaCBMOverride", n > 0 ? n : baseRate)
                }
                placeholder={String(baseRate)}
                className="num flex-1 min-w-0 bg-transparent text-[18px] font-semibold text-white outline-none"
              />
              <span className="text-[12px] whitespace-nowrap" style={{ color: "rgba(255,255,255,0.5)" }}>
                USD/CBM
              </span>
            </div>
            <p className="text-[11.5px] mt-1.5 leading-[1.4]" style={{ color: "rgba(255,255,255,0.45)" }}>
              {esConsolidado
                ? "Tarifa base del consolidado. Ajústala si tu cotización es distinta."
                : "La genera el sistema. Ajústala si tu cotización es distinta."}
            </p>
          </div>

          {/* CBM total + Peso total */}
          <div className="grid grid-cols-2 gap-3">
            <BigInput
              label="CBM total"
              suffix="m³"
              value={effectiveForm.cbmTotal}
              onChange={(v) => update("cbmTotal", v)}
              placeholder="12"
              warning={cbmWarning}
              readOnly={cbmPanelOpen}
              // "¿Qué es un CBM?" se responde acá mismo; el "cómo lo saco" lo
              // resuelve el panel de medidas de más abajo.
              help={<CbmAyuda />}
              // El tag "auto · medidas" solo cuando el valor DE VERDAD viene de
              // las medidas (cbmDesdeMedidas > 0). Con el panel abierto pero aún
              // sin medir, el campo muestra el CBM manual conservado → poner el
              // tag ahí sería engañoso (implica derivado cuando no lo es).
              tag={
                cbmPanelOpen && cbmDesdeMedidas > 0 ? "auto · medidas" : undefined
              }
            />
            <BigInput
              label="Peso total"
              suffix="kg"
              value={pesoIngresado}
              onChange={(v) => update("pesoKg", v)}
              placeholder="4800"
              warning={pesoWarning}
              // El peso dejó de ser obligatorio (SDD-0257) y hay que DECIRLO:
              // el cliente que lo deja vacío tiene que saber que no está
              // rompiendo nada, no adivinarlo porque igual salió un precio.
              tag={sinPeso ? "opcional" : undefined}
            />
          </div>

          {/* Panel "¿No sabes tu CBM?" — derivar el CBM de las medidas. Oculto
              por defecto; el link discreto lo despliega. Mientras está abierto,
              "CBM total" queda read-only y se alimenta SOLO desde acá. */}
          <CbmPorMedidas
            open={cbmPanelOpen}
            dims={dims}
            onToggle={toggleCbmPanel}
            onDimChange={(key, value) =>
              setDims((prev) => ({ ...prev, [key]: value }))
            }
          />

          {/* Opciones (switches) */}
          <div className="flex flex-col gap-2.5">
            <SwitchField
              label="Embalaje especial"
              hint="Madera o paleta"
              badge={`+$${params.recargoEmbalajeEspecial}`}
              checked={form.embalaje === "especial"}
              onChange={(v) => update("embalaje", v ? "especial" : "estandar")}
            />
            <SwitchField
              label="Lleva baterías"
              hint="Recargo por manejo de litio"
              badge={`×${params.recargoBateriaMult}`}
              checked={!!form.bateria}
              onChange={(v) => update("bateria", v)}
            />
            <SwitchField
              label="Carga especial o de alto valor"
              hint="Frágil, peligrosa o con permisos — la vemos a medida"
              checked={!!form.cargaEspecial}
              onChange={(v) => update("cargaEspecial", v)}
            />
          </div>

          {/* Destino · solo en puerta a puerta. El consolidado llega HASTA
              PUERTO en Venezuela, así que no hay ciudad que elegir: en su lugar
              se explica el alcance real del servicio (BL propio + aduana por
              cuenta del cliente). Copy grounded en la ficha `lcl-consolidado`
              de lib/servicios-detalle.ts. */}
          {esConsolidado ? (
            <div className="rounded-[14px] p-4" style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}>
              <span className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
                Destino
              </span>
              <p className="mt-1.5 text-[14px] font-semibold text-white leading-[1.35]">
                Hasta puerto en Venezuela · con tu propio BL
              </p>
              <p className="mt-1.5 text-[12px] leading-[1.5]" style={{ color: "rgba(255,255,255,0.65)" }}>
                El consolidado llega <strong className="text-white">hasta puerto</strong>{" "}
                y ahí te entregamos tu propio Bill of Lading, separado dentro del
                Bill Master del contenedor. La{" "}
                <strong className="text-white">aduana y los impuestos en Venezuela
                corren por tu cuenta</strong> (o los sumas aparte como servicio de
                aduana).
              </p>
            </div>
          ) : (
            <div>
              <label
                htmlFor="ciudad"
                className="text-[11px] font-bold tracking-[0.12em] uppercase mb-2 block"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                Destino en Venezuela
              </label>
              <DestinoCombobox
                id="ciudad"
                ciudades={cityList}
                value={form.ciudadId}
                onChange={(id) => update("ciudadId", id)}
              />
              <NotaCobertura ciudad={ciudadElegida} ciudades={cityList} />
            </div>
          )}
        </div>

        {/* ── COLUMNA DERECHA · RESULTADO ──
            El divisor vive acá (no en la entrada) para que siempre quede del
            lado que mira a la columna de entrada, sin importar en qué orden
            caiga cada una. */}
        <div
          className={`p-6 lg:p-9 flex flex-col gap-4 ${esConsolidado ? "lg:order-1" : "lg:order-2"}`}
          style={{
            background: "rgba(0,0,0,0.15)",
            borderLeft: esConsolidado ? "none" : "1px solid rgba(255,255,255,0.1)",
            borderRight: esConsolidado ? "1px solid rgba(255,255,255,0.1)" : "none",
          }}
        >
          <ContainerFill cbm={effectiveForm.cbmTotal} max={params.cbmMaxContenedor} />
          <ResultPanel
            cotizacion={cotizacion}
            input={effectiveForm}
            tieneCarga={tieneCarga}
            pesoIncluidoKg={params.pesoIncluidoKg}
            onEstimar={() => setModalOpen(true)}
            directWhatsApp={directWhatsApp}
            modo={modo}
          />
        </div>
      </div>

      {/* Nota al pie · ancho completo */}
      <div className="px-6 lg:px-9 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        {esConsolidado ? (
          <p className="text-[11.5px] leading-[1.5]" style={{ color: "rgba(255,255,255,0.45)" }}>
            <strong style={{ color: "rgba(255,255,255,0.65)" }}>* Hasta puerto:</strong> el servicio
            llega hasta entregarte tu Bill of Lading en Venezuela; la aduana y los
            impuestos corren por tu cuenta.{" "}
            <strong style={{ color: "rgba(255,255,255,0.65)" }}>Pueden aplicar restricciones.</strong>{" "}
            Este estimado es aproximado y refleja nuestra tarifa base de
            consolidado.
          </p>
        ) : (
          <p className="text-[11.5px] leading-[1.5]" style={{ color: "rgba(255,255,255,0.45)" }}>
            <strong style={{ color: "rgba(255,255,255,0.65)" }}>* Pagas al llegar:</strong> pagas
            el flete cuando tu carga llega a Venezuela. <strong style={{ color: "rgba(255,255,255,0.65)" }}>Pueden
            aplicar restricciones.</strong>{" "}
            Este estimado es aproximado y refleja nuestra tarifa base DDP (puerta a
            puerta).
          </p>
        )}
        {/* Condiciones del cliente (sutil, sin números internos) — desplegable */}
        <details className="mt-2.5 group">
          <summary
            className="text-[11.5px] font-semibold cursor-pointer list-none inline-flex items-center gap-1.5 min-h-[44px] transition-colors rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            style={{ color: "var(--wine-on-dark, #E8748A)" }}
          >
            <span aria-hidden="true" className="text-[9px] leading-none transition-transform group-open:rotate-90">▶</span>
            ¿Qué incluye tu estimado?
          </summary>
          <ul
            className="mt-2 pl-4 flex flex-col gap-1.5 text-[11.5px] leading-[1.45] list-disc"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            <li>Un buen margen de peso por cada m³ — la mayoría de las cargas entra sin recargo.</li>
            <li>Si tu carga es más densa, suma un pequeño ajuste por el peso extra; igual te da el precio al instante.</li>
            <li>Pesamos y medimos tu carga al recibirla; la tarifa final se ajusta a lo real.</li>
          </ul>
        </details>
      </div>
    </div>

      {/* Ciudades con la entrega incluida — SDD-0237.
          Ocupa el lugar de lo que "casco central" trataba de comunicar, pero
          sin la palabra: el cliente no tiene por qué saber qué es un casco, y
          la frase escondía que en 8 ciudades el tramo sale gratis. No va en el
          consolidado: ahí no hay ciudad, la carga llega hasta puerto. */}
      {!esConsolidado && ciudadesIncluidas.length > 0 && (
        <EntregaIncluida ciudades={ciudadesIncluidas} />
      )}

      {/* SDD-0061 Fase B2 — confirmación post-estimado + CTA opcional de registro
          (baja fricción). Solo si el ERP devolvió código (si falló, no hay qué
          vincular). En modo directWhatsApp NO hay captura → no se muestra. */}
      {!directWhatsApp && savedEstimateCode && (
        <div className="mt-4 card-shadow bg-white border border-grey-200 rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine">
              Estimado guardado ·{" "}
              <span style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}>
                {savedEstimateCode}
              </span>
            </div>
            <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.45]">
              <strong className="text-ink">Regístrate y obtén tu Shipping Mark.</strong>{" "}
              Vinculamos este estimado a tu cuenta automáticamente.
            </p>
          </div>
          <Link
            href={`/registro?est=${encodeURIComponent(savedEstimateCode)}`}
            className="btn btn-primary flex-shrink-0"
          >
            Crear cuenta <ArrowIcon />
          </Link>
        </div>
      )}

      {/* Modal de captura del estimado — solo en el flujo legacy. En /tarifas
          (directWhatsApp) la calc no guarda nada, así que no se monta. */}
      {!directWhatsApp && (
        <EstimadoModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onConfirm={handleConfirm}
          buildPayload={() => ({
            calc: "lcl",
            origin: "China",
            destination: cotizacion.ciudad?.label ?? "Venezuela",
            cbm: effectiveForm.cbmTotal,
            // `null`, no `0` (SDD-0257): en el ERP "0 kg" se lee como un peso
            // medido y "sin dato" es otra cosa. El campo acepta null.
            weightKg: pesoIngresado > 0 ? pesoIngresado : null,
            packaging: effectiveForm.embalaje === "especial" ? "madera" : "carton",
            totalUsd: cotizacion.total,
            subtotalUsd: cotizacion.total,
          })}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────

/**
 * Las ciudades donde la entrega nacional va INCLUIDA ($0 para el cliente).
 *
 * DTD sí le paga ese tramo al transportista: no es un descuento, es adquisición
 * de clientes (founder, 1-ago-2026). Por eso se anuncia — regalar el tramo y no
 * decirlo no compra nada.
 *
 * La lista llega DERIVADA del catálogo, no escrita a mano: es la promesa que
 * más fácil se desincroniza del motor, y una ciudad de más acá es una promesa
 * que el precio no cumple.
 *
 * Estilo claro a propósito: cuelga por debajo de la card navy de la calculadora,
 * sobre el fondo de la página, hermano de la card "¿Tu carga llena un
 * contenedor?" que va justo después en /tarifas.
 */
function EntregaIncluida({ ciudades }: { ciudades: Ciudad[] }) {
  return (
    <section
      aria-labelledby="entrega-incluida-titulo"
      className="mt-4 card-shadow rounded-[16px] border border-grey-200 bg-white px-5 py-4 lg:px-6 lg:py-5"
    >
      <h3
        id="entrega-incluida-titulo"
        className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine-text m-0"
      >
        Entrega incluida
      </h3>
      <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.55] m-0">
        En estas ciudades{" "}
        <strong className="text-ink">no te cobramos el tramo nacional</strong> —
        la entrega hasta tu puerta ya viene en el flete.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2 list-none p-0 m-0">
        {ciudades.map((c) => (
          <li
            key={c.id}
            className="text-[13px] font-semibold text-ink rounded-[8px] border border-grey-200 bg-paper px-2.5 py-1.5"
          >
            {c.label}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12.5px] text-grey-500 leading-[1.5] m-0">
        En el resto del país la entrega se cobra por metro cúbico, según el
        volumen de tu carga y no según la distancia. Escoge tu ciudad arriba y el
        estimado ya la incluye.
      </p>
    </section>
  );
}

/**
 * Nota bajo el selector de destino cuando el destino elegido NO cotiza solo.
 *
 * Aparece APENAS eliges la ciudad, sin esperar a que llenes CBM y peso: para
 * los dos casos que explica ("no llegamos" y "sin tarifa confirmada"), el
 * precio no va a existir nunca, y enterarse después de medir la carga es peor.
 * Por eso clasifica con `coberturaDestino()` en vez de leer `cot.alerta` — el
 * motor exige carga válida antes de llegar a la rama de la tarifa.
 *
 * El copy NO se escribe acá: sale de los mismos constructores que usa el motor
 * (`lib/calculadora.ts`), así el aviso del selector y el del panel de resultado
 * no pueden decir cosas distintas.
 */
function NotaCobertura({
  ciudad,
  ciudades,
}: {
  ciudad: Ciudad | null;
  ciudades: Ciudad[];
}) {
  if (!ciudad) return null;
  const cobertura = coberturaDestino(ciudad);
  if (cobertura === "cubierta") return null;

  const mensaje =
    cobertura === "sin_cobertura"
      ? mensajeDestinoSinCobertura(ciudad.label, vecinaDeDestino(ciudad, ciudades))
      : mensajeDestinoSinTarifa(ciudad.label);

  return (
    // `role="status"` — el aviso aparece y desaparece al cambiar el destino sin
    // que nada lo anuncie; un lector de pantalla se perdía el cambio entero.
    <p
      role="status"
      className="mt-2 rounded-[12px] px-3 py-2.5 text-[12px] leading-[1.45]"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "rgba(255,255,255,0.72)",
      }}
    >
      {mensaje}
    </p>
  );
}

/**
 * Input grande con sufijo (m³/kg) y aviso inline ámbar. Número en mono.
 * `readOnly` lo bloquea (lo alimenta otra fuente, ej. el panel de medidas) y
 * `tag` muestra el origen del valor (ej. "auto · medidas") junto al label.
 */
function BigInput({
  label,
  suffix,
  value,
  onChange,
  placeholder,
  warning,
  readOnly,
  tag,
  help,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  warning?: CalcWarning;
  readOnly?: boolean;
  tag?: string;
  /** Control de ayuda opcional junto al label (ej. el "?" del CBM). */
  help?: React.ReactNode;
}) {
  // Severidad → tono (alineado al Norte): danger = rojo (bloqueo), info = wine
  // (dato de precio), warning = ámbar (fallback).
  //
  // ⚠️ Ni `info` ni `danger` pueden usar su token crudo acá: los dos son colores
  // pensados para fondo CLARO y esta card es navy. Medido en el navegador el
  // 2026-08-13 sobre la card (#16233F, la parada clara de su gradiente):
  //
  //   tono     token crudo            texto (AA 4,5:1)   borde (AA 3:1)
  //   danger   #c2353f                 2,88 ✗             2,88 ✗
  //   info     #7F0F1A (wine)          1,57 ✗             1,47 ✗
  //   warning  #b8893a (ámbar)         4,96 ✓             4,96 ✓
  //
  // El texto pequeño pide 4,5:1 (BRAND.md, regla 6) y el borde 3:1 (WCAG 2.1
  // §1.4.11: es no-textual, pero SÍ transmite el estado). Sólo el ámbar aguanta
  // los dos; los otros dos usan sus hermanos para fondo oscuro:
  // `--wine-on-dark` (#d59fa7 → 6,94:1) y `--danger-on-dark` (#f6929a → 7,05:1).
  //
  // Un solo color por tono para el borde Y el texto — antes eran dos ramas
  // separadas y por eso el borde se quedó atrás cuando se arregló el texto.
  // Van como `style` y no como clase porque los tokens viven en CSS, no en
  // Tailwind; el fallback del `var()` cubre a `/tarifas/embed`, que se renderiza
  // fuera de toda clase de superficie y por tanto sin los alias.
  const toneColor =
    warning?.tone === "danger"
      ? "var(--danger-on-dark, #f6929a)"
      : warning?.tone === "info"
        ? "var(--wine-on-dark, #E8748A)"
        : "var(--color-status-warning, #b8893a)";
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
          {label}
        </span>
        {help}
        {tag && (
          <span
            className="text-[9px] font-bold tracking-[0.06em] uppercase rounded-[5px] px-1.5 py-[2px] whitespace-nowrap"
            style={{ color: "var(--wine-on-dark, #E8748A)", background: "rgba(255,255,255,0.08)" }}
          >
            {tag}
          </span>
        )}
      </span>
      <div
        className={`flex items-center gap-2 rounded-[12px] border px-3.5 h-[60px] transition-colors ${
          warning ? "" : "border-white/[0.14] focus-within:border-white/40"
        }`}
        style={{
          borderColor: warning ? toneColor : undefined,
          background: readOnly ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.04)",
        }}
      >
        {readOnly ? (
          <span className="num flex-1 min-w-0 text-[24px] font-bold text-white truncate">
            {value > 0 ? value : <span style={{ color: "rgba(255,255,255,0.3)" }}>{placeholder}</span>}
          </span>
        ) : (
          <DecimalInput
            value={value}
            onValueChange={onChange}
            placeholder={placeholder}
            className="num flex-1 min-w-0 bg-transparent text-[24px] font-bold text-white outline-none"
          />
        )}
        <span className="text-[13px] whitespace-nowrap" style={{ color: "rgba(255,255,255,0.5)" }}>{suffix}</span>
      </div>
      {warning && (
        <span
          className="text-[11px] leading-[1.35] font-medium"
          style={{ color: toneColor }}
        >
          {warning.text}
        </span>
      )}
    </label>
  );
}

type DimsKey = "alto" | "ancho" | "largo" | "cajas";
type Dims = Record<DimsKey, number>;

/**
 * Panel colapsable "¿No sabes tu CBM?". Un único toggle (flecha ▶ que rota al
 * abrir) despliega y colapsa 4 campos (alto/ancho/largo en cm + cantidad de
 * cajas) — abre Y cierra desde el mismo control, sin un botón de cierre aparte.
 * El CBM se deriva en vivo en el padre (efecto de un sentido) y se asigna a
 * "CBM total" — acá solo se editan las medidas. Cerrar libera el CBM para
 * edición manual (conserva el valor).
 */
function CbmPorMedidas({
  open,
  dims,
  onToggle,
  onDimChange,
}: {
  open: boolean;
  dims: Dims;
  onToggle: (open: boolean) => void;
  onDimChange: (key: DimsKey, value: number) => void;
}) {
  const cbmCaja = cbmFromDimensions(dims.alto, dims.ancho, dims.largo, 1);
  const cbmTotal = cbmFromDimensions(dims.alto, dims.ancho, dims.largo, dims.cajas);

  return (
    <div className="flex flex-col gap-3">
      {/* Toggle único: abre Y cierra desde el mismo control. La flecha ▶ rota a
          ▼ (90°) cuando el panel está abierto. Reemplaza el par link-abrir +
          texto-gris-cerrar que escondía el cierre (diseño Norte v2.5). */}
      <button
        type="button"
        onClick={() => onToggle(!open)}
        aria-expanded={open}
        className="self-start inline-flex items-center gap-2 text-[13px] font-bold hover:text-white transition-colors rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{ color: "var(--wine-on-dark, #E8748A)" }}
      >
        <span
          aria-hidden="true"
          className="text-[10px] leading-none transition-transform duration-150"
          style={{ transform: open ? "rotate(90deg)" : "none" }}
        >
          ▶
        </span>
        {open
          ? "Prefiero escribir el CBM a mano"
          : "¿No sabes tu CBM? Calcúlalo con las medidas"}
      </button>

      {open && (
        <div
          className="rounded-[14px] p-4 flex flex-col gap-3.5"
          style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.15)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
              Medidas de tu caja
            </span>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>en centímetros</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <DimInput label="Alto" suffix="cm" value={dims.alto} onChange={(v) => onDimChange("alto", v)} placeholder="40" />
            <DimInput label="Ancho" suffix="cm" value={dims.ancho} onChange={(v) => onDimChange("ancho", v)} placeholder="30" />
            <DimInput label="Largo" suffix="cm" value={dims.largo} onChange={(v) => onDimChange("largo", v)} placeholder="60" />
          </div>

          <DimInput
            label="Cantidad de cajas"
            value={dims.cajas}
            onChange={(v) => onDimChange("cajas", v)}
            placeholder="1"
          />

          <p className="text-[11.5px] leading-[1.45]" style={{ color: "rgba(255,255,255,0.5)" }}>
            {cbmTotal > 0 ? (
              <>
                <span className="num font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>{cbmCaja} m³</span> por
                caja ×{" "}
                <span className="num font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>{dims.cajas}</span> ={" "}
                <span className="num font-semibold text-white">{cbmTotal} m³</span> — ya
                cargado arriba.
              </>
            ) : (
              "Completa alto, ancho, largo y la cantidad de cajas y calculamos tu CBM al instante."
            )}
          </p>
        </div>
      )}
    </div>
  );
}

/** Campo chico para una medida (alto/ancho/largo/cajas). Reusa DecimalInput. */
function DimInput({
  label,
  suffix,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  suffix?: string;
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[10.5px] font-bold tracking-[0.1em] uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
        {label}
      </span>
      <div className="flex items-center gap-1.5 rounded-[10px] px-3 h-[46px] border border-white/[0.14] focus-within:border-white/40 transition-colors" style={{ background: "rgba(255,255,255,0.04)" }}>
        <DecimalInput
          value={value}
          onValueChange={onChange}
          placeholder={placeholder}
          className="num flex-1 min-w-0 bg-transparent text-[16px] font-semibold text-white outline-none"
        />
        {suffix && (
          <span className="text-[12px] whitespace-nowrap" style={{ color: "rgba(255,255,255,0.5)" }}>{suffix}</span>
        )}
      </div>
    </label>
  );
}

/** Toggle tipo switch (iOS-like) con label + hint + badge opcional. */
function SwitchField({
  label,
  hint,
  badge,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  badge?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 p-3.5 rounded-[12px] border cursor-pointer transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-white focus-within:outline-offset-2 ${
        checked ? "border-wine bg-wine/10" : "border-white/[0.14] hover:border-white/30"
      }`}
    >
      <span
        className={`relative inline-flex shrink-0 h-[26px] w-[46px] rounded-full transition-colors ${
          checked ? "bg-wine" : "bg-white/20"
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow transition-all ${
            checked ? "left-[23px]" : "left-[3px]"
          }`}
        />
      </span>
      <span className="flex flex-col flex-1 min-w-0">
        <span className="text-[14px] font-semibold text-white leading-[1.2]">
          {label}
        </span>
        <span className="text-[11.5px] leading-[1.35]" style={{ color: "rgba(255,255,255,0.5)" }}>{hint}</span>
      </span>
      {badge && (
        <span className="num text-[12px] font-semibold whitespace-nowrap" style={{ color: "rgba(255,255,255,0.5)" }}>
          {badge}
        </span>
      )}
    </label>
  );
}

/**
 * Contenedor 40'HC que se LLENA con el CBM. El relleno wine escala con `cbm/max`
 * vía `transform: scaleX()` (no `width %`). Corrugado vertical de fondo, "% LLENO"
 * centrado, y una "puerta" como segmento aparte a la derecha.
 */
function ContainerFill({ cbm, max }: { cbm: number; max: number }) {
  const ratio = max > 0 ? Math.min(Math.max(cbm, 0) / max, 1) : 0;
  const pct = max > 0 ? Math.round((Math.max(cbm, 0) / max) * 100) : 0;
  const over = cbm > max;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <span className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
          En un contenedor 40&apos;HC
        </span>
        <span className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
          <span className="num">{max}</span> CBM
        </span>
      </div>
      <div className="flex gap-2 items-stretch h-[140px]">
        {/* Cuerpo del contenedor */}
        <div
          className="relative flex-1 rounded-[12px] overflow-hidden"
          style={{ border: "2px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.03)" }}
        >
          {/* Corrugado vertical */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0, transparent 13px, rgba(255,255,255,0.05) 13px, rgba(255,255,255,0.05) 14px)",
            }}
          />
          {/* Relleno wine (scaleX desde la izquierda) */}
          <div
            className="absolute inset-y-0 left-0 w-full bg-wine"
            style={{
              transformOrigin: "left",
              transform: `scaleX(${ratio})`,
              transition: "transform 600ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
          {/* % lleno centrado */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="num text-[34px] leading-none text-white"
              style={{ fontFamily: "var(--font-archivo-black)" }}
            >
              {over ? "100%+" : `${pct}%`}
            </span>
            <span className="text-[10.5px] font-bold tracking-[0.16em] uppercase mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
              Lleno
            </span>
          </div>
        </div>
        {/* Puerta del contenedor */}
        <div
          className="w-[40px] rounded-[12px] flex items-center justify-center gap-1.5"
          style={{ border: "2px solid rgba(255,255,255,0.16)" }}
        >
          <span className="block w-[3px] h-[44px] rounded bg-white/25" />
          <span className="block w-[3px] h-[44px] rounded bg-white/25" />
        </div>
      </div>
    </div>
  );
}

/**
 * Panel del resultado: total (gradiente navy) + desglose itemizado (estilo
 * Norte / Cloud Design) + badge financiamiento + nudge "ya está lista" + CTA
 * WhatsApp + microcopy. Maneja 4 estados: vacío (sin CBM), deriva al asesor
 * (alerta), **estimado sin peso** (SDD-0257) y normal.
 *
 * El estado "sin peso" es precio real, no un placeholder: el total es el PISO de
 * esa carga y se marca en cuatro sitios —píldora "Falta el peso", "Desde" pegado
 * al monto, la nota con el techo en kg, y la fila fantasma del desglose— porque
 * un solo aviso se pierde y el número grande es lo único que el cliente recuerda.
 *
 * Desglose (founder 2026-07-12): SIEMPRE visible con carga válida — antes estaba
 * detrás de `cot.recargoExcedente > 0`, así que desaparecía cuando la carga no
 * era densa (bug "no me muestra el desglose en el 2do cálculo"). Ahora itemiza
 * Volumen base + Excedente de peso (si hay) + Embalaje/Baterías/Descuento/Ajuste
 * (los que apliquen) + Total.
 *
 * Recargo por ciudad (founder 2026-07-21): línea PROPIA "Entrega a {ciudad}"
 * cuando `recargoCiudad > 0` — antes venía plegado dentro de "Volumen base"
 * sin mostrar el subtexto "CBM × tarifa", así que el total subía (p. ej. Isla
 * Margarita) sin ninguna línea que lo explicara (bug "no me sale el desglose
 * del flete"). "Volumen base" ahora es SIEMPRE solo `precioBase`, con subtexto
 * siempre visible.
 */
function ResultPanel({
  cotizacion: cot,
  input,
  tieneCarga,
  pesoIncluidoKg,
  onEstimar,
  directWhatsApp = false,
  modo = "ddp",
}: {
  cotizacion: EnvioCotizacion;
  input: EnvioInput;
  tieneCarga: boolean;
  /** Gracia de peso por CBM (para el subtexto "X kg sobre Y kg incl."). */
  pesoIncluidoKg: number;
  /** Abre el modal de captura del estimado web (caso con precio válido). */
  onEstimar: () => void;
  /** CTA WhatsApp directo (sin modal ni POST) — Fase 3 /tarifas. */
  directWhatsApp?: boolean;
  /** Modalidad: cambia el sello del total, el "incluye" y el badge de pago. */
  modo?: CalcModo;
}) {
  const esConsolidado = modo === "consolidado";
  const hasAlerta = !!cot.alerta && tieneCarga;
  const money = (n: number) =>
    `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

  // Tarifa efectiva y datos del excedente para los subtextos del desglose.
  // La tarifa se DERIVA de precioBase/cbm (evita re-derivar el override/CONFIG).
  const tarifaEff = cot.cbm > 0 ? Math.round(cot.precioBase / cot.cbm) : 0;
  const incluidoKg = Math.round(cot.cbm * pesoIncluidoKg);
  const excesoKg = Math.max(0, Math.round((input.pesoKg ?? 0) - incluidoKg));

  // Filas del desglose. Cada recargo que aplica tiene su propia línea.
  // `kind` decide el signo/color del monto.
  const rows: {
    label: string;
    sub: string | null;
    value: number;
    kind: "base" | "add" | "sub";
    accent?: boolean;
    /** Se muestra "Incluida" en verde en vez de "+$0" (zona sin costo). */
    incluida?: boolean;
    /**
     * Fila FANTASMA (SDD-0257): la línea existe pero su monto todavía no se
     * puede calcular. Se pinta con "?" en vez de un número.
     */
    pendiente?: boolean;
  }[] = [
    {
      label: "Volumen base",
      sub: `${cot.cbm} CBM × $${tarifaEff}`,
      value: cot.precioBase,
      kind: "base",
    },
    // Entrega nacional — SIEMPRE visible cuando hay ciudad (founder 1-ago-2026).
    // Antes se ocultaba en $0, así que las 8 ciudades donde DTD regala el tramo
    // no veían nada: el cliente no se enteraba de lo que le estamos absorbiendo.
    // Ahora se muestra como "Incluida" y el regalo se ve.
    ...(cot.ciudad && !esConsolidado
      ? [{
          label: `Entrega a ${cot.ciudad.label}`,
          sub:
            cot.recargoCiudad > 0 && cot.cbm > 0
              ? `${cot.cbm} CBM × $${(cot.recargoCiudad / cot.cbm).toFixed(2)}`
              : null,
          value: cot.recargoCiudad,
          kind: "add" as const,
          incluida: cot.recargoCiudad === 0,
        }]
      : []),
    ...(cot.recargoExcedente > 0
      ? [{
          label: "Excedente de peso",
          sub: `${excesoKg} kg sobre ${incluidoKg} kg incl.`,
          value: cot.recargoExcedente,
          kind: "add" as const,
          accent: true,
        }]
      : []),
    // Fila FANTASMA cuando falta el peso (SDD-0257). Es la pieza que ENSEÑA sin
    // bloquear: el cliente ve que al desglose le falta un renglón y entiende por
    // qué el total dice "Desde". Es excluyente con la de arriba — o hay
    // excedente calculado, o falta el peso para calcularlo.
    ...(cot.sinPeso
      ? [{
          label: "Excedente de peso",
          sub: "falta el peso de tu carga",
          value: 0,
          kind: "add" as const,
          pendiente: true,
        }]
      : []),
    ...(cot.recargoEmbalaje > 0
      ? [{ label: "Embalaje especial", sub: null, value: cot.recargoEmbalaje, kind: "add" as const }]
      : []),
    ...(cot.recargoBateria > 0
      ? [{ label: "Baterías", sub: "Manejo de litio", value: cot.recargoBateria, kind: "add" as const }]
      : []),
    ...(cot.descuentoSede < 0
      ? [{ label: "Descuento", sub: null, value: cot.descuentoSede, kind: "sub" as const }]
      : []),
    ...(cot.ajusteMinimo > 0
      ? [{ label: "Ajuste a mínimo", sub: null, value: cot.ajusteMinimo, kind: "add" as const }]
      : []),
  ];
  // Caso "deriva al asesor" (carga especial / fuera de contenedor): no hay un
  // estimado que capturar → CTA directo a WhatsApp con el texto de la alerta.
  const whatsappText = whatsappTextFromCotizacion(cot, input);
  const whatsappUrl = `https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(whatsappText)}`;

  /**
   * SDD-0259 · deja registrado, ANÓNIMAMENTE, lo que este visitante calculó.
   *
   * Va en el CTA y no en el tipeo: acá el valor ya está comprometido. Es
   * fire-and-forget — si falla, el cliente igual se va a WhatsApp y no se
   * entera. Nunca `await`: la telemetría no puede costar una conversión.
   *
   * `total_usd` viaja en null cuando hubo alerta, porque ahí NO hubo precio;
   * el par (total null + alerta) es lo que mide contra qué paredes choca la
   * gente. Y `weightKg` en null es la métrica de SDD-0257: cada cuánto el
   * cliente no sabe el peso.
   */
  function reportarCalculo() {
    reportCalcEvent({
      modo,
      cbm: input.cbmTotal,
      weightKg: input.pesoKg && input.pesoKg > 0 ? input.pesoKg : null,
      ciudadId: input.ciudadId ?? null,
      embalaje: input.embalaje,
      bateria: !!input.bateria,
      cargaEspecial: !!input.cargaEspecial,
      totalUsd: cot.alerta ? null : cot.total,
      alerta: cot.alerta?.tipo ?? null,
    });
  }

  return (
    <>
      {/* Panel del total (gradiente navy) — superficie navy ESTABLE: en el portal
          oscuro `--color-ink` vira a crema y el gradiente quedaba "crema → navy".
          `--hero-*` es navy en ambos temas; el fallback deja la página pública
          (sin data-portal-theme) idéntica. */}
      <div
        className="rounded-[16px] p-5 lg:p-6 text-white"
        style={{
          background:
            "linear-gradient(150deg, var(--hero-from, var(--color-ink)), var(--hero-to, #1F3055))",
        }}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span
            className="text-[11px] font-bold tracking-[0.12em] uppercase"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Total estimado
          </span>
          {/* Píldora "falta el peso" (SDD-0257) — el estado del estimado se
              declara ARRIBA, junto al rótulo, para que se lea antes que el
              número. Wine sobre navy, el mismo tono `info` del campo: es un
              pendiente, no un error. */}
          {tieneCarga && !hasAlerta && cot.sinPeso && (
            <span
              className="text-[9.5px] font-bold tracking-[0.08em] uppercase rounded-[6px] px-2 py-[3px]"
              style={{
                color: "var(--wine-on-dark, #E8748A)",
                background: "rgba(255,255,255,0.08)",
              }}
            >
              Falta el peso
            </span>
          )}
        </div>
        {!tieneCarga ? (
          <p
            className="mt-2 text-[14.5px] leading-[1.5]"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            Ingresa tu CBM para ver el estimado al instante.
          </p>
        ) : hasAlerta ? (
          <p
            className="mt-2 text-[14.5px] leading-[1.5]"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            {cot.alerta!.mensaje}
          </p>
        ) : (
          <div className="mt-1.5 flex items-end justify-between gap-3 flex-wrap">
            {/* "Desde" (SDD-0257) cuando no hay peso: el número es el PISO real
                de esa carga, no el precio cerrado. Va pegado al monto —no en una
                nota aparte— porque es la única forma de que viaje con el número
                cuando el cliente lo lee de reojo o lo captura en pantalla. */}
            <span className="flex items-baseline gap-2 flex-wrap">
              {cot.sinPeso && (
                <span
                  className="text-[19px] lg:text-[22px] leading-none"
                  style={{
                    fontFamily: "var(--font-archivo-black)",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  Desde
                </span>
              )}
              <span
                className="num text-[44px] lg:text-[52px] leading-none text-white"
                style={{ fontFamily: "var(--font-archivo-black)" }}
              >
                {money(cot.total)}
              </span>
            </span>
            <span
              className="text-[12px] leading-[1.4] text-right"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {esConsolidado ? (
                <>
                  aprox · LCL
                  <br />
                  hasta puerto
                </>
              ) : (
                <>
                  aprox · DDP
                  <br />
                  puerta a puerta
                </>
              )}
            </span>
          </div>
        )}
        {/* Hasta cuándo vale ese "Desde" (SDD-0257). Es la pieza que evita el
            reclamo: sin este techo el cliente asume que el número es final, y
            una carga densa lo puede duplicar. El texto sale del motor
            (`mensajeEstimadoSinPeso`), que es donde vive la regla que lo
            calcula — acá no se re-escribe. `role="status"` porque aparece y
            desaparece solo al escribir el peso. */}
        {tieneCarga && !hasAlerta && cot.sinPeso && (
          <p
            role="status"
            className="mt-3 rounded-[10px] px-3 py-2.5 text-[12.5px] leading-[1.5]"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid var(--wine-on-dark, #E8748A)",
              color: "rgba(255,255,255,0.88)",
            }}
          >
            {mensajeEstimadoSinPeso(cot.pesoMaxSinRecargoKg)}
          </p>
        )}
        {tieneCarga && !hasAlerta && (
          <p
            className="mt-3 text-[12.5px] leading-[1.5]"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            <span style={{ color: "rgba(255,255,255,0.6)" }}>Incluye:</span>{" "}
            {esConsolidado ? (
              <>
                consolidación en nuestra bodega de Yiwu · flete marítimo
                internacional · tu propio Bill of Lading.
              </>
            ) : (
              <>
                flete marítimo · aduana · impuestos · entrega en{" "}
                {cot.ciudad?.label ?? "destino"}.
              </>
            )}
          </p>
        )}
        {esConsolidado && tieneCarga && !hasAlerta && (
          <p
            className="mt-1.5 text-[12px] leading-[1.5]"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            No incluye: aduana e impuestos en Venezuela · servicios portuarios y
            transporte interno.
          </p>
        )}
      </div>

      {/* Desglose itemizado (estilo Norte / Cloud Design) · SIEMPRE visible con
          carga válida. Founder 2026-07-12: antes estaba detrás de
          `cot.recargoExcedente > 0` y desaparecía cuando la carga no era densa
          (bug del 2do cálculo). Cada gasto sale "como es": Volumen base,
          Excedente de peso (con "X kg sobre Y kg incl.", sin $/kg), Embalaje,
          etc. El recargo por distancia sigue plegado en "Volumen base". */}
      {tieneCarga && !hasAlerta && (
        <div
          className="rounded-[12px] px-4 py-3.5 flex flex-col gap-2.5"
          style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
        >
          {rows.map((r) => (
            <div key={r.label} className="flex items-start justify-between gap-3">
              <span className="flex flex-col min-w-0">
                <span
                  className="text-[13px] leading-tight"
                  style={r.accent ? { fontWeight: 600, color: "var(--wine-on-dark, #E8748A)" } : { color: "rgba(255,255,255,0.7)" }}
                >
                  {r.label}
                </span>
                {r.sub && (
                  // 0.55 y no 0.45 (SDD-0257): medido sobre el navy de este
                  // panel, 0.45 da 4,11:1 y reprueba AA para 11px. Estos
                  // subtextos NO son decorativos —"12 CBM × $800" es la cuenta,
                  // y "falta el peso de tu carga" es la explicación de la fila
                  // fantasma—, así que tienen que leerse. 0.55 → 5,5:1.
                  <span className="num text-[11px] leading-tight mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {r.sub}
                  </span>
                )}
              </span>
              {r.pendiente ? (
                <span
                  className="num text-[13px] font-bold whitespace-nowrap rounded-[6px] px-2 py-[1px]"
                  style={{
                    color: "var(--wine-on-dark, #E8748A)",
                    background: "rgba(255,255,255,0.08)",
                  }}
                  aria-label="pendiente: falta el peso"
                >
                  ?
                </span>
              ) : r.incluida ? (
                <span
                  className="text-[12px] font-bold whitespace-nowrap"
                  // El alias `--success-on-dark` sólo existe dentro de
                  // `.home-surface`; la calculadora vive en /calculadora y
                  // /tarifas, que NO tienen esa clase — sin fallback el color
                  // quedaba sin resolver y "Incluida" heredaba tinta oscura
                  // sobre navy. El token global sí está en @theme.
                  style={{
                    color:
                      "var(--success-on-dark, var(--color-status-success-on-dark))",
                  }}
                >
                  Incluida
                </span>
              ) : (
                <span
                  className="num text-[13px] whitespace-nowrap"
                  style={r.accent ? { fontWeight: 700, color: "var(--wine-on-dark, #E8748A)" } : { fontWeight: 600, color: "#fff" }}
                >
                  {r.kind === "sub" ? "−" : r.kind === "add" ? "+" : ""}
                  {money(r.value)}
                </span>
              )}
            </div>
          ))}
          {/* Aviso de destino quincenal. NO bloquea: el cliente ve su precio
              igual, pero se entera ANTES de pagar de que ese camión no sale
              todas las semanas. Enterarse después es un reclamo. */}
          {cot.avisoEntrega && tieneCarga ? (
            // `role="status"` — el aviso entra y sale solo al cambiar de
            // destino o de carga, sin anunciarse (A11Y-01). El radio sube a
            // 12px para igualar al resto de las cajas del panel.
            <div
              role="status"
              className="rounded-[12px] px-3 py-2 text-[12px] leading-[1.45]"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.72)",
              }}
            >
              {cot.avisoEntrega}
            </div>
          ) : null}
          <div
            className="mt-0.5 pt-2.5 flex items-center justify-between gap-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
          >
            <span className="text-[13px] font-bold text-white">Total estimado</span>
            {/* El "desde" se repite acá al pie del desglose: es la línea que el
                cliente lee cuando ya bajó del monto grande. */}
            <span className="num text-[15px] font-bold text-white">
              {cot.sinPeso ? `desde ${money(cot.total)}` : money(cot.total)}
            </span>
          </div>
        </div>
      )}

      {/* Badge (pill verde claro) · DDP = financiamiento "pagas al llegar";
          consolidado = tiempo real del servicio hasta entregarte el BL
          (grounded: ficha `lcl-consolidado`, 60 a 90 días). */}
      {!hasAlerta && (
        <div
          className="inline-flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold text-ink"
          style={{ background: "#CFE9DC" }}
        >
          <span className="fin-badge-dot-green" aria-hidden="true" />
          {esConsolidado
            ? "60 a 90 días* · hasta entregarte tu Bill of Lading"
            : "Pagas al llegar* · cuando tu carga llega a Venezuela"}
        </div>
      )}

      {/* Empuja el CTA al fondo cuando hay espacio (desktop sticky/altura) */}
      <div className="flex-1 min-h-[8px]" />

      {tieneCarga && (
        <>
          {/* Nudge "ya está lista" — pill navy con vibración mínima + flecha */}
          {!hasAlerta && (
            <div className="flex flex-col items-center -mb-1">
              <div
                className="nudge-vibrate w-full rounded-[12px] text-white text-center text-[13.5px] leading-[1.35] py-3 px-4"
                style={{ background: "var(--hero-from, var(--color-ink))" }}
              >
                {/* Sin peso el nudge no puede decir "ya está lista": empuja al
                    dato que falta, pero deja abierta la salida — el punto del
                    cambio es que se pueda enviar igual. */}
                {cot.sinPeso ? (
                  <>
                    Súmale el peso y te damos el precio exacto —{" "}
                    <strong>o envíala así y lo confirmamos.</strong>
                  </>
                ) : (
                  <>
                    Tu cotización ya está lista —{" "}
                    <strong>solo falta enviarla.</strong>
                  </>
                )}
              </div>
              <svg width="22" height="11" viewBox="0 0 22 11" fill="none" aria-hidden="true">
                <path d="M2 1l9 8 9-8" stroke="var(--hero-from, var(--color-ink))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          {/* CTA WhatsApp · con precio válido abre el modal de captura del
              estimado (POST al ERP + wa.me); con alerta va directo a WhatsApp. */}
          {hasAlerta ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn bg-whatsapp text-white"
              onClick={reportarCalculo}
            >
              <WhatsAppIcon size={20} />
              Consultar con un asesor
            </a>
          ) : directWhatsApp ? (
            // Fase 3 · /tarifas: WhatsApp directo con el texto del estimado (la
            // conversión la captura el listener global de <a> a wa.me).
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn bg-whatsapp text-white"
              onClick={reportarCalculo}
            >
              <WhatsAppIcon size={20} />
              Enviar por WhatsApp
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                reportarCalculo();
                onEstimar();
              }}
              className="btn bg-whatsapp text-white"
            >
              <WhatsAppIcon size={20} />
              Enviar por WhatsApp
            </button>
          )}

          {/* Microcopy */}
          <p className="text-[11.5px] text-center leading-[1.45]" style={{ color: "rgba(255,255,255,0.45)" }}>
            Tu mensaje se arma solo con estos datos. Con Confianza, de China a tu
            puerta.
          </p>
        </>
      )}
    </>
  );
}
