"use client";

/**
 * SDD-0673 · Carga del embarque en la ficha: cajas, CBM y peso de su línea del
 * contenedor, el «Grupo de WeChat» y dos acciones:
 *   - «Corregir medidas»: corrige a la vez el embarque, su línea del contenedor y
 *     su recepción del Almacén CN (migr 0563), con vista previa y motivo.
 *   - «Partir embarque»: separa una parte (cajas, CBM y peso) a un embarque
 *     nuevo «<código>-B» con su dueño; el total del contenedor no cambia.
 * Cada botón sólo lo ve quien tiene la acción; la base repite el candado. Sin la
 * migración, los modales dicen que la acción todavía no está disponible.
 * SDD-0531: sin `puedeVerNombres` no se monta el buscador de clientes.
 */

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ClientCombobox } from "@/app/studio/_components/ui/ClientCombobox";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { formatCbm } from "@/lib/shared/cbm";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type { ClientSearchHit } from "@/lib/studio/client-search-action";
import {
  MAX_GRUPO,
  textosAvisosMedidas,
  textosBloqueosMedidas,
  type CorregirResultado,
  type PartirResultado,
} from "@/lib/studio/medidas-embarque";
import type { CargaDelEmbarque as Carga } from "@/lib/studio/medidas-embarque-queries";
import {
  correctShipmentMeasures,
  previewCorrectShipmentMeasures,
  previewSplitShipment,
  splitShipment,
  updateShipmentGroupReference,
} from "../actions";

const MAX_MOTIVO = 1000;

// SDD-0667: el CBM se muestra con los decimales que tiene (hasta 4), sin ceros de relleno.
const fmtCbm = (n: number | null | undefined) => formatCbm(n, { unit: true });
const fmtKg = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toLocaleString("es-VE", { maximumFractionDigits: 2 })} kg`;
const fmtCajas = (n: number | null | undefined) => (n == null ? "—" : `${n} ${n === 1 ? "caja" : "cajas"}`);

export function CargaDelEmbarque({
  shipmentId,
  shipmentCode,
  carga,
  cbmEmbarque,
  pesoEmbarque,
  grupo,
  puedeEditarGrupo,
  puedeCorregir,
  puedePartir,
  puedeVerNombres,
}: {
  shipmentId: string;
  shipmentCode: string;
  carga: Carga;
  cbmEmbarque: number | null;
  pesoEmbarque: number | null;
  /** `undefined`: la columna todavía no existe (sin la 0563); no se muestra. */
  grupo: string | null | undefined;
  puedeEditarGrupo: boolean;
  puedeCorregir: boolean;
  puedePartir: boolean;
  puedeVerNombres: boolean;
}) {
  const [modal, setModal] = useState<"corregir" | "partir" | null>(null);
  const cajas = carga.cajas;
  const cbm = carga.enContenedor ? carga.cbm : cbmEmbarque;
  const peso = carga.enContenedor ? carga.pesoKg : pesoEmbarque;

  return (
    <div className="studio-ficha-embarque-carga">
      <div className="studio-ficha-embarque-carga-datos">
        <div className="studio-eyebrow">Carga</div>
        <strong>
          {carga.enContenedor ? `${fmtCajas(cajas)} · ` : ""}
          {fmtCbm(cbm)} · {fmtKg(peso)}
        </strong>
        {carga.enContenedor && carga.contenedor && (
          <span className="studio-ficha-embarque-carga-nota">
            En el contenedor {carga.contenedor.containerNo ?? carga.contenedor.ref ?? "sin número"}
          </span>
        )}
      </div>

      {grupo !== undefined && (
        <GrupoWeChat shipmentId={shipmentId} grupo={grupo} puedeEditar={puedeEditarGrupo} />
      )}

      <div className="studio-ficha-embarque-carga-acciones">
        {puedeCorregir && (
          <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={() => setModal("corregir")}>
            Corregir medidas
          </button>
        )}
        {puedePartir && carga.enContenedor && puedeVerNombres && (
          <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={() => setModal("partir")}>
            Partir embarque
          </button>
        )}
      </div>

      {modal === "corregir" && (
        <CorregirMedidasModal
          shipmentId={shipmentId}
          shipmentCode={shipmentCode}
          enContenedor={carga.enContenedor}
          inicial={{ boxes: cajas, cbm, weightKg: peso }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "partir" && (
        <PartirEmbarqueModal
          shipmentId={shipmentId}
          shipmentCode={shipmentCode}
          total={{ boxes: cajas, cbm, weightKg: peso }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function GrupoWeChat({ shipmentId, grupo, puedeEditar }: { shipmentId: string; grupo: string | null; puedeEditar: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(grupo ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!editando) {
    return (
      <div className="studio-ficha-embarque-carga-datos">
        <div className="studio-eyebrow">Grupo de WeChat</div>
        <span>{grupo ?? "Sin grupo"}</span>
        {puedeEditar && (
          <button type="button" className="studio-btn studio-btn-ghost studio-btn-xs" onClick={() => setEditando(true)}>
            {grupo ? "Cambiar" : "Anotar grupo"}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="studio-ficha-embarque-carga-datos">
      <label className="studio-label" htmlFor="grupo-wechat">
        Grupo de WeChat
      </label>
      <input
        id="grupo-wechat"
        className="studio-input"
        value={valor}
        maxLength={MAX_GRUPO}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Ej.: Grupo Yiwu juguetes"
        aria-describedby="grupo-wechat-ayuda"
      />
      <p id="grupo-wechat-ayuda" className="studio-ficha-embarque-carga-nota">
        Es la referencia del grupo con el proveedor en China. No decide el cliente y no se ve en el Portal.
      </p>
      {error && (
        <Aviso tono="error" compacto>
          {error}
        </Aviso>
      )}
      <div style={{ display: "flex", gap: "var(--s-2)" }}>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-xs"
          onClick={() => {
            setEditando(false);
            setValor(grupo ?? "");
            setError(null);
          }}
        >
          Cancelar
        </button>
        <ActionButton
          variant="primary"
          size="xs"
          idleLabel="Guardar grupo"
          loadingLabel="Guardando…"
          successLabel={null}
          onAction={async () => {
            setError(null);
            const res = await updateShipmentGroupReference(shipmentId, valor);
            if (!res.ok) return { error: res.error };
            setEditando(false);
            router.refresh();
          }}
          onError={setError}
        />
      </div>
    </div>
  );
}

function Modal({
  titulo,
  id,
  pending,
  onClose,
  children,
}: {
  titulo: string;
  id: string;
  pending: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(panelRef, { onClose, pending, enabled: true });
  return (
    <div
      className="studio-ficha-embarque-modal-fondo"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={id} className="studio-ficha-embarque-modal">
        <h2 id={id} className="studio-display" style={{ fontSize: 18, margin: 0 }}>
          {titulo}
        </h2>
        {children}
      </div>
    </div>
  );
}

function Motivo({ id, value, onChange, ejemplo }: { id: string; value: string; onChange: (v: string) => void; ejemplo: string }) {
  return (
    <div>
      <label className="studio-label" htmlFor={id}>
        Motivo
      </label>
      <textarea
        id={id}
        className="studio-input"
        rows={3}
        maxLength={MAX_MOTIVO}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ejemplo}
        aria-describedby={`${id}-ayuda`}
        style={{ width: "100%", resize: "vertical" }}
      />
      <p id={`${id}-ayuda`} className="studio-ficha-embarque-carga-nota">
        De 4 a {MAX_MOTIVO} caracteres · {value.trim().length}/{MAX_MOTIVO}. Queda en la bitácora: no escribas datos
        personales (nombres, cédula, teléfono ni dirección).
      </p>
    </div>
  );
}

function Motivos({
  blockers,
  warnings,
  tituloBloqueo,
  accion,
}: {
  blockers: Record<string, string | number>;
  warnings: Record<string, string | number>;
  tituloBloqueo: string;
  accion: "corregir" | "partir";
}) {
  const bloqueos = textosBloqueosMedidas(blockers);
  const avisos = textosAvisosMedidas(warnings, accion);
  return (
    <>
      {bloqueos.length > 0 && (
        <Aviso tono="atencion" titulo={tituloBloqueo}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {bloqueos.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Aviso>
      )}
      {bloqueos.length === 0 && avisos.length > 0 && (
        <Aviso tono="info" titulo="Antes de confirmar" compacto>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {avisos.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Aviso>
      )}
    </>
  );
}

type MedidasForm = { boxes: number | null; cbm: number | null; weightKg: number | null };

function CamposMedidas({
  prefijo,
  valor,
  onChange,
  conCajas,
}: {
  prefijo: string;
  valor: MedidasForm;
  onChange: (v: MedidasForm) => void;
  conCajas: boolean;
}) {
  return (
    <div className="studio-ficha-embarque-medidas">
      {conCajas && (
        <div>
          <label className="studio-label" htmlFor={`${prefijo}-cajas`}>
            Cajas
          </label>
          <NumericInput
            id={`${prefijo}-cajas`}
            type="count"
            unit="cajas"
            min={1}
            value={valor.boxes}
            onChange={(v) => onChange({ ...valor, boxes: v })}
          />
        </div>
      )}
      <div>
        <label className="studio-label" htmlFor={`${prefijo}-cbm`}>
          CBM
        </label>
        <NumericInput
          id={`${prefijo}-cbm`}
          type="volume"
          // Regla B de Sam (2026-11-18): se guardan 3 decimales; no se teclea un 4.º que la RPC rechace.
          precision={3}
          decimales={3}
          min={0}
          value={valor.cbm}
          onChange={(v) => onChange({ ...valor, cbm: v })}
        />
      </div>
      <div>
        <label className="studio-label" htmlFor={`${prefijo}-kg`}>
          Peso
        </label>
        <NumericInput
          id={`${prefijo}-kg`}
          type="weight"
          min={0}
          value={valor.weightKg}
          onChange={(v) => onChange({ ...valor, weightKg: v })}
        />
      </div>
    </div>
  );
}

function CorregirMedidasModal({
  shipmentId,
  shipmentCode,
  enContenedor,
  inicial,
  onClose,
}: {
  shipmentId: string;
  shipmentCode: string;
  enContenedor: boolean;
  inicial: MedidasForm;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [medidas, setMedidas] = useState<MedidasForm>(inicial);
  const [previa, setPrevia] = useState<CorregirResultado | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noDisponible, setNoDisponible] = useState(false);
  const [revisando, startPreview] = useTransition();

  const cambiar = (v: MedidasForm) => {
    setMedidas(v);
    setPrevia(null);
    setError(null);
  };
  const revisar = () =>
    startPreview(async () => {
      setError(null);
      const res = await previewCorrectShipmentMeasures(shipmentId, enContenedor ? medidas : { ...medidas, boxes: null });
      if (res.ok) setPrevia(res.resultado);
      else {
        setError(res.error);
        setNoDisponible(res.noDisponible === true);
      }
    });

  const motivoOk = motivo.trim().length >= 4 && motivo.trim().length <= MAX_MOTIVO;
  const listo = !!previa && previa.outcome === "preview" && motivoOk && !revisando;

  return (
    <Modal titulo="Corregir medidas" id="corregir-medidas-titulo" pending={revisando} onClose={onClose}>
      <p className="studio-ficha-embarque-carga-nota" style={{ margin: 0 }}>
        Las medidas de <strong style={{ fontFamily: "var(--f-mono)" }}>{shipmentCode}</strong> se corrigen a la vez en el
        embarque{enContenedor ? ", en su línea del contenedor y en su recepción del Almacén CN" : ""}. Si cambian las
        cajas, el Almacén CN crea o quita cajas físicas.
      </p>

      <CamposMedidas prefijo="corregir" valor={medidas} onChange={cambiar} conCajas={enContenedor} />

      {!previa && (
        <button
          type="button"
          className="studio-btn studio-btn-dark studio-btn-sm"
          onClick={revisar}
          disabled={revisando || noDisponible}
        >
          {revisando ? "Revisando…" : "Revisar el cambio"}
        </button>
      )}

      {error && (
        <Aviso tono={noDisponible ? "info" : "error"} compacto>
          {error}
        </Aviso>
      )}

      {previa && <Motivos blockers={previa.blockers} warnings={previa.warnings} tituloBloqueo="No se puede corregir todavía" accion="corregir" />}

      {previa && previa.outcome === "preview" && (
        <>
          <Aviso tono="info" titulo="Así queda">
            {fmtCajas(previa.after.receipt?.boxes ?? previa.after.consolidationItem?.pieces ?? null)} ·{" "}
            {fmtCbm(previa.after.shipment.cbm)} · {fmtKg(previa.after.shipment.weightKg)}. Antes:{" "}
            {fmtCajas(previa.before.receipt?.boxes ?? previa.before.consolidationItem?.pieces ?? null)} ·{" "}
            {fmtCbm(previa.before.shipment.cbm)} · {fmtKg(previa.before.shipment.weightKg)}.
          </Aviso>
          <Motivo id="corregir-motivo" value={motivo} onChange={setMotivo} ejemplo="Ej.: cuadre con el Excel de carga del contenedor." />
        </>
      )}

      <div className="studio-ficha-embarque-modal-pie">
        <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={onClose}>
          Cancelar
        </button>
        <ActionButton
          variant="primary"
          size="sm"
          idleLabel="Corregir medidas"
          loadingLabel="Corrigiendo…"
          successLabel={null}
          disabled={!listo}
          onAction={async () => {
            const res = await correctShipmentMeasures(shipmentId, enContenedor ? medidas : { ...medidas, boxes: null }, motivo);
            if (!res.ok) return { error: res.error };
            if (res.resultado.outcome !== "corrected") {
              setPrevia(res.resultado);
              return { error: "Algo cambió y ahora no se puede. Revisa los motivos." };
            }
            toast.success(`Medidas de ${shipmentCode} corregidas`);
            onClose();
            router.refresh();
          }}
          onError={setError}
        />
      </div>
    </Modal>
  );
}

function PartirEmbarqueModal({
  shipmentId,
  shipmentCode,
  total,
  onClose,
}: {
  shipmentId: string;
  shipmentCode: string;
  total: MedidasForm;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [cliente, setCliente] = useState<ClientSearchHit | null>(null);
  const [parte, setParte] = useState<MedidasForm>({ boxes: null, cbm: null, weightKg: null });
  const [previa, setPrevia] = useState<PartirResultado | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noDisponible, setNoDisponible] = useState(false);
  const [revisando, startPreview] = useTransition();

  const completo = !!cliente && parte.boxes != null && parte.cbm != null && parte.weightKg != null;
  const revisar = () =>
    startPreview(async () => {
      if (!cliente) return;
      setError(null);
      const res = await previewSplitShipment(shipmentId, cliente.id, parte);
      if (res.ok) setPrevia(res.resultado);
      else {
        setError(res.error);
        setNoDisponible(res.noDisponible === true);
      }
    });

  const motivoOk = motivo.trim().length >= 4 && motivo.trim().length <= MAX_MOTIVO;
  const listo = !!previa && previa.outcome === "preview" && motivoOk && !revisando;
  const p = previa?.parts;

  return (
    <Modal titulo="Partir embarque" id="partir-titulo" pending={revisando} onClose={onClose}>
      <p className="studio-ficha-embarque-carga-nota" style={{ margin: 0 }}>
        Una parte de <strong style={{ fontFamily: "var(--f-mono)" }}>{shipmentCode}</strong> ({fmtCajas(total.boxes)} ·{" "}
        {fmtCbm(total.cbm)} · {fmtKg(total.weightKg)}) pasa a un embarque nuevo del mismo contenedor, con su dueño. El
        original se queda con el resto y el total del contenedor no cambia. Se mueven las cajas de número más alto.
      </p>

      <div>
        <label className="studio-label" htmlFor="partir-cliente">
          Dueño de la parte nueva
        </label>
        <ClientCombobox
          id="partir-cliente"
          value={query}
          onManualChange={(text) => {
            setQuery(text);
            setCliente(null);
            setPrevia(null);
          }}
          onSelect={(hit) => {
            setCliente(hit);
            setQuery(`${hit.markbox} · ${hit.name}`);
            setPrevia(null);
          }}
          disabled={noDisponible}
        />
      </div>

      <CamposMedidas
        prefijo="partir"
        valor={parte}
        onChange={(v) => {
          setParte(v);
          setPrevia(null);
          setError(null);
        }}
        conCajas
      />

      {!previa && (
        <button
          type="button"
          className="studio-btn studio-btn-dark studio-btn-sm"
          onClick={revisar}
          disabled={!completo || revisando || noDisponible}
        >
          {revisando ? "Revisando…" : "Revisar las dos partes"}
        </button>
      )}

      {error && (
        <Aviso tono={noDisponible ? "info" : "error"} compacto>
          {error}
        </Aviso>
      )}

      {previa && <Motivos blockers={previa.blockers} warnings={previa.warnings} tituloBloqueo="No se puede partir todavía" accion="partir" />}

      {previa && previa.outcome === "preview" && p && (
        <>
          <Aviso tono="info" titulo={`Nace ${p.nueva.code ?? "un embarque nuevo"} para ${p.nueva.clientMarkbox ?? "el cliente elegido"}`}>
            {shipmentCode} queda con {fmtCajas(p.original.boxes)} · {fmtCbm(p.original.cbm)} · {fmtKg(p.original.weightKg)}.{" "}
            {p.nueva.code} lleva {fmtCajas(p.nueva.boxes)} · {fmtCbm(p.nueva.cbm)} · {fmtKg(p.nueva.weightKg)}. Total del
            contenedor sin cambios.
            {p.boxCodes.length > 0 && <> Cajas que se mueven: {p.boxCodes.join(", ")}.</>}
          </Aviso>
          <Motivo id="partir-motivo" value={motivo} onChange={setMotivo} ejemplo="Ej.: la carga del grupo es de dos clientes." />
        </>
      )}

      <div className="studio-ficha-embarque-modal-pie">
        <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={onClose}>
          Cancelar
        </button>
        <ActionButton
          variant="primary"
          size="sm"
          idleLabel={p?.nueva.code ? `Partir en ${shipmentCode} y ${p.nueva.code}` : "Partir"}
          loadingLabel="Partiendo…"
          successLabel={null}
          disabled={!listo}
          onAction={async () => {
            if (!cliente) return { error: "Elige un cliente de la lista." };
            const res = await splitShipment(shipmentId, cliente.id, parte, motivo);
            if (!res.ok) return { error: res.error };
            if (res.resultado.outcome !== "split") {
              setPrevia(res.resultado);
              return { error: "Algo cambió y ahora no se puede. Revisa los motivos." };
            }
            toast.success(`${shipmentCode} partido: nació ${res.resultado.newShipmentCode ?? "un embarque nuevo"}`, {
              link: res.resultado.newShipmentId
                ? { href: `/studio/tracking/${res.resultado.newShipmentId}`, label: "Abrir el nuevo" }
                : undefined,
            });
            onClose();
            router.refresh();
          }}
          onError={setError}
        />
      </div>
    </Modal>
  );
}
