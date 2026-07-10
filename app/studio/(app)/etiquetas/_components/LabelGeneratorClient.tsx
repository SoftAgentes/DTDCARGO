"use client";

/**
 * LabelGeneratorClient — orquestador del generador de etiquetas (SDD-0031).
 *
 * Layout: panel config (izquierda 360px sticky) + preview (derecha 1fr).
 * State: cliente · supplier (free-form) · warehouse · totalBoxes + startBox
 * + copiesPerBox · formatId · qr toggle · modal open.
 *
 * Print: @page CSS dinámico según formato + window.print().
 */

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { FORMATS, Label, type LabelFormat, warehouseAddress } from "./Label";
import { SupplierMessageModal } from "./SupplierMessageModal";
import type { LabelClient, LabelSupplier, LabelWarehouseCn } from "../page";

// Sentinela del dropdown: "Otro / a mano" → mantiene los campos libres
// (fallback graceful cuando el cliente no tiene proveedores cargados o el
// supplier no está en la tabla todavía).
const SUPPLIER_FREEFORM = "__freeform__";

interface Props {
  clients: LabelClient[];
  warehouses: LabelWarehouseCn[];
  suppliers: LabelSupplier[];
  preselectMarkbox?: string;
}

export function LabelGeneratorClient(props: Props) {
  // Empty fallback ANTES de cualquier hook. El guard vive en este wrapper y
  // los hooks viven en <LabelGeneratorInner> (que solo se monta cuando hay
  // datos) → satisface rules-of-hooks sin cambiar el comportamiento.
  if (props.clients.length === 0 || props.warehouses.length === 0) {
    return (
      <div
        style={{
          padding: 60,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            font: "800 16px/1.2 var(--f-display)",
            color: "var(--ink)",
            marginBottom: "var(--s-2)",
          }}
        >
          {props.clients.length === 0
            ? "Aún no hay clientes registrados"
            : "Aún no hay warehouses CN configurados"}
        </div>
        <p
          style={{
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          {props.clients.length === 0
            ? "Crea clientes desde /studio/clientes antes de generar etiquetas."
            : "Aplica la migration 0008_warehouses_cn.sql para tener los hubs CN seedeados."}
        </p>
      </div>
    );
  }
  return <LabelGeneratorInner {...props} />;
}

function LabelGeneratorInner({
  clients,
  warehouses,
  suppliers,
  preselectMarkbox,
}: Props) {
  const initialMarkbox =
    (preselectMarkbox && clients.find((c) => c.markbox === preselectMarkbox)?.markbox) ??
    clients[0].markbox;

  const [clientMarkbox, setClientMarkbox] = useState(initialMarkbox);
  const [warehouseId, setWarehouseId] = useState(warehouses[0].id);
  const [supplierId, setSupplierId] = useState<string>(SUPPLIER_FREEFORM);
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierContactCn, setSupplierContactCn] = useState("");
  const [supplierCity, setSupplierCity] = useState("");
  const [supplierWechat, setSupplierWechat] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [totalBoxes, setTotalBoxes] = useState(12);
  const [startBox, setStartBox] = useState(1);
  const [copiesPerBox, setCopiesPerBox] = useState(2);
  const [formatId, setFormatId] = useState<LabelFormat["id"]>("a4-8up");
  const [qr, setQr] = useState(true);
  const [msgOpen, setMsgOpen] = useState(false);

  // Proveedores del cliente seleccionado (suppliers_cn es por cliente).
  const clientSuppliers = useMemo(
    () => suppliers.filter((s) => s.client_markbox === clientMarkbox),
    [suppliers, clientMarkbox],
  );

  // Al cambiar de cliente, el supplier elegido deja de ser válido → volver a
  // "Otro / a mano" (no auto-borra lo tipeado a mano, solo el select).
  useEffect(() => {
    if (
      supplierId !== SUPPLIER_FREEFORM &&
      !clientSuppliers.some((s) => s.id === supplierId)
    ) {
      setSupplierId(SUPPLIER_FREEFORM);
    }
  }, [clientSuppliers, supplierId]);

  // Al elegir un proveedor del dropdown, autocompletar los campos del mensaje.
  function selectSupplier(id: string) {
    setSupplierId(id);
    if (id === SUPPLIER_FREEFORM) return;
    const s = clientSuppliers.find((sup) => sup.id === id);
    if (!s) return;
    setSupplierContact(s.contact ?? s.name);
    setSupplierCity(s.city ?? "");
    setSupplierWechat(s.wechat ?? "");
  }

  // Auto-sugerir warehouse según ciudad del supplier
  useEffect(() => {
    if (!supplierCity) return;
    const c = supplierCity.toLowerCase();
    if (c.includes("yiwu")) {
      const w = warehouses.find((w) => w.code === "YIW-A1");
      if (w) setWarehouseId(w.id);
    } else if (c.includes("guangzhou") || c.includes("shanghai")) {
      const w = warehouses.find((w) => w.code === "GZ-B2");
      if (w) setWarehouseId(w.id);
    } else if (c.includes("shenzhen")) {
      const w = warehouses.find((w) => w.code === "SZ-C1");
      if (w) setWarehouseId(w.id);
    }
  }, [supplierCity, warehouses]);

  const client = clients.find((c) => c.markbox === clientMarkbox) ?? clients[0];
  const warehouseRow = warehouses.find((w) => w.id === warehouseId) ?? warehouses[0];
  const warehouse = warehouseAddress(warehouseRow);
  const format = FORMATS.find((f) => f.id === formatId) ?? FORMATS[0];

  // labels = secuencia de box indices repetidos N veces por copies
  const labels = useMemo(() => {
    const total = Math.max(1, Math.min(200, Math.floor(totalBoxes) || 1));
    const start = Math.max(1, Math.min(total, Math.floor(startBox) || 1));
    const copies = Math.max(1, Math.min(4, Math.floor(copiesPerBox) || 1));
    const arr: number[] = [];
    for (let i = start; i <= total; i++) {
      for (let k = 0; k < copies; k++) arr.push(i);
    }
    return arr;
  }, [totalBoxes, startBox, copiesPerBox]);

  const boxesInRange = Math.max(
    0,
    Math.max(1, Math.min(200, Math.floor(totalBoxes) || 1)) -
      Math.max(1, Math.min(Math.floor(totalBoxes) || 1, Math.floor(startBox) || 1)) +
      1,
  );
  const pages = Math.ceil(labels.length / format.perPage);

  // Paginar las labels en chunks de format.perPage
  const pageChunks = useMemo(() => {
    const out: number[][] = [];
    for (let i = 0; i < labels.length; i += format.perPage) {
      out.push(labels.slice(i, i + format.perPage));
    }
    return out;
  }, [labels, format]);

  const canPrint = totalBoxes > 0 && startBox <= totalBoxes && startBox >= 1;

  const supplier = {
    contactName: supplierContact,
    contactCn: supplierContactCn,
    city: supplierCity,
    wechat: supplierWechat,
    email: supplierEmail,
  };

  return (
    <>
      {/* Header actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <button
          type="button"
          onClick={() => setMsgOpen(true)}
          className="studio-btn studio-btn-ghost"
        >
          Mensaje al supplier
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="studio-btn studio-btn-primary"
          disabled={!canPrint}
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      {/* Layout 2-col */}
      <div
        className="dtd-labelgen-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: "var(--s-5)",
          alignItems: "flex-start",
        }}
      >
        {/* Panel config */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            position: "sticky",
            top: 16,
            maxHeight: "calc(100vh - 32px)",
            overflowY: "auto",
            paddingRight: "var(--s-1)",
          }}
        >
          {/* Cliente */}
          <Card eyebrow="CLIENTE · SHIPPING MARK">
            <label className="studio-label" htmlFor="lg-client">
              Cliente
            </label>
            <select
              id="lg-client"
              className="studio-input"
              value={clientMarkbox}
              onChange={(e) => setClientMarkbox(e.target.value)}
              style={{ marginTop: 6 }}
            >
              {clients.map((c) => (
                <option key={c.markbox} value={c.markbox}>
                  {c.markbox} · {c.name}
                </option>
              ))}
            </select>
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                background: "var(--wine-tint)",
                border: "1px solid var(--wine)",
                borderRadius: "var(--r-sm)",
              }}
            >
              <div
                className="studio-eyebrow"
                style={{ color: "var(--wine)", marginBottom: "var(--s-1)" }}
              >
                Shipping Mark
              </div>
              <code
                style={{
                  font: "900 20px/1 var(--f-mono)",
                  color: "var(--wine)",
                }}
              >
                {client.markbox}
              </code>
              <div
                style={{
                  font: "600 11.5px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                  marginTop: "var(--s-1)",
                }}
              >
                {client.name}
                {client.company ? ` · ${client.company}` : ""}
              </div>
            </div>
          </Card>

          {/* Supplier · dropdown de suppliers_cn + free-form */}
          <Card eyebrow="SUPPLIER · OPCIONAL">
            <label
              className="studio-label"
              htmlFor="lg-supplier"
              style={{ display: "block", marginBottom: "var(--s-1)" }}
            >
              Proveedor del cliente
            </label>
            <select
              id="lg-supplier"
              className="studio-input"
              value={supplierId}
              onChange={(e) => selectSupplier(e.target.value)}
            >
              {clientSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.city ? ` · ${s.city}` : ""}
                </option>
              ))}
              <option value={SUPPLIER_FREEFORM}>Otro / a mano</option>
            </select>
            <p
              style={{
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "8px 0 10px",
              }}
            >
              {clientSuppliers.length === 0
                ? "Este cliente todavía no registró proveedores desde su portal. Completa los datos a mano para el mensaje del supplier."
                : supplierId === SUPPLIER_FREEFORM
                  ? "Elige un proveedor cargado o completa los datos a mano para el mensaje del supplier."
                  : "Datos del proveedor cargado — editalos si hace falta para este envío."}
            </p>
            <Field
              label="Nombre contacto"
              value={supplierContact}
              onChange={setSupplierContact}
              placeholder="Mr. Liu"
            />
            <Field
              label="Nombre en chino (opcional)"
              value={supplierContactCn}
              onChange={setSupplierContactCn}
              placeholder="刘先生"
              mono="cn"
            />
            <Field
              label="Ciudad"
              value={supplierCity}
              onChange={setSupplierCity}
              placeholder="Yiwu · Guangzhou · Shenzhen"
            />
            <Field
              label="WeChat ID (opcional)"
              value={supplierWechat}
              onChange={setSupplierWechat}
              placeholder="liu_supplier_88"
              mono
            />
            <Field
              label="Email (opcional)"
              value={supplierEmail}
              onChange={setSupplierEmail}
              placeholder="liu@example.cn"
              type="email"
            />

            <label
              className="studio-label"
              htmlFor="lg-warehouse"
              style={{ marginTop: "var(--s-3)", display: "block" }}
            >
              Almacén CN destino
            </label>
            <select
              id="lg-warehouse"
              className="studio-input"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              style={{ marginTop: 6 }}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.city}
                  {w.hub_name_cn ? ` · ${w.hub_name_cn}` : ""}
                </option>
              ))}
            </select>
          </Card>

          {/* Cajas + Box X/Y + copias */}
          <Card eyebrow="CAJAS · BOX X/Y">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="studio-label" htmlFor="lg-start">
                  Box inicial (X)
                </label>
                <input
                  id="lg-start"
                  type="number"
                  min={1}
                  className="studio-input studio-input-mono"
                  value={startBox}
                  onChange={(e) => setStartBox(Number(e.target.value))}
                  style={{ marginTop: 6 }}
                />
              </div>
              <div>
                <label className="studio-label" htmlFor="lg-total">
                  Total cajas (Y)
                </label>
                <input
                  id="lg-total"
                  type="number"
                  min={1}
                  max={200}
                  className="studio-input studio-input-mono"
                  value={totalBoxes}
                  onChange={(e) => setTotalBoxes(Number(e.target.value))}
                  style={{ marginTop: 6 }}
                />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    font: "700 11px/1 var(--f-sans)",
                    color: "var(--ink-soft)",
                  }}
                >
                  Etiquetas por caja
                </span>
                <span
                  style={{
                    font: "500 10.5px/1 var(--f-sans)",
                    color: "var(--ink-soft)",
                  }}
                >
                  recomendado · 2
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 6,
                }}
              >
                {[1, 2, 3, 4].map((n) => {
                  const active = copiesPerBox === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCopiesPerBox(n)}
                      style={{
                        padding: "10px 6px",
                        borderRadius: "var(--r-sm)",
                        border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                        background: active ? "var(--wine)" : "var(--bg-surface)",
                        color: active ? "var(--ink-inv)" : "var(--ink)",
                        font: "900 16px/1 var(--f-mono)",
                        cursor: "pointer",
                      }}
                    >
                      ×{n}
                    </button>
                  );
                })}
              </div>
              <p
                style={{
                  marginTop: 6,
                  font: "500 11px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                Imprime la misma etiqueta {copiesPerBox}{" "}
                {copiesPerBox === 1 ? "vez" : "veces"} por caja para pegar en{" "}
                {copiesPerBox === 1
                  ? "una cara"
                  : copiesPerBox === 2
                    ? "dos caras"
                    : copiesPerBox === 3
                      ? "tres caras"
                      : "cuatro caras"}{" "}
                · si una se tapa, las otras mantienen la trazabilidad.
              </p>
            </div>

            <div
              style={{
                marginTop: "var(--s-3)",
                padding: "10px 12px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-sm)",
                font: "500 11.5px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              Genera <b style={{ color: "var(--ink)" }}>{labels.length}</b>{" "}
              etiqueta{labels.length !== 1 ? "s" : ""} ·{" "}
              <b style={{ color: "var(--ink)" }}>{boxesInRange}</b> caja
              {boxesInRange !== 1 ? "s" : ""} ×{" "}
              <b style={{ color: "var(--ink)" }}>{copiesPerBox}</b>{" "}
              {copiesPerBox === 1 ? "copia" : "copias"}
              <div
                style={{
                  marginTop: "var(--s-1)",
                  font: "600 11px/1 var(--f-mono)",
                  color: "var(--wine)",
                }}
              >
                {startBox}/{totalBoxes} → {totalBoxes}/{totalBoxes}
              </div>
            </div>
          </Card>

          {/* Formato */}
          <Card eyebrow="FORMATO DE PAPEL">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {FORMATS.map((f) => {
                const active = formatId === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormatId(f.id)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: "var(--r-sm)",
                      border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                      background: active ? "var(--wine-tint)" : "var(--bg-surface)",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        font: "700 12.5px/1.2 var(--f-sans)",
                        color: active ? "var(--wine)" : "var(--ink)",
                      }}
                    >
                      {f.label}
                    </div>
                    <div
                      style={{
                        font: "500 11px/1.3 var(--f-sans)",
                        color: "var(--ink-soft)",
                        marginTop: 2,
                      }}
                    >
                      {f.desc}
                    </div>
                  </button>
                );
              })}
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s-2)",
                marginTop: "var(--s-3)",
                font: "600 12px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={qr}
                onChange={(e) => setQr(e.target.checked)}
                style={{ accentColor: "var(--wine)" }}
              />
              Incluir código QR escaneable (lleva a /verificar)
            </label>
          </Card>

          <div
            style={{
              padding: "10px 12px",
              background: "var(--info-bg)",
              color: "var(--info)",
              borderRadius: "var(--r-sm)",
              font: "500 11.5px/1.5 var(--f-sans)",
            }}
          >
            Al imprimir, el navegador abre el diálogo del sistema. Elige{" "}
            <b>&quot;Guardar como PDF&quot;</b> como destino. Tamaño de papel:{" "}
            <b>
              {format.page.w}×{format.page.h} mm
            </b>
            .
          </div>
        </div>

        {/* Preview */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "var(--s-3)",
            }}
          >
            <div>
              <div className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
                PREVIEW
              </div>
              <div
                style={{
                  font: "900 18px/1.1 var(--f-display)",
                  color: "var(--ink)",
                  letterSpacing: "-0.02em",
                  marginTop: "var(--s-1)",
                }}
              >
                {labels.length} etiquetas · {pages} página{pages !== 1 ? "s" : ""}
              </div>
              <div
                style={{
                  font: "500 11.5px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginTop: "var(--s-1)",
                }}
              >
                {boxesInRange} caja{boxesInRange !== 1 ? "s" : ""} × {copiesPerBox}{" "}
                {copiesPerBox === 1 ? "copia" : "copias"}
              </div>
            </div>
            <Badge tone="wine" size="md">
              {format.label}
            </Badge>
          </div>

          <div
            style={{
              padding: "var(--s-6)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              overflow: "auto",
              maxHeight: "calc(100vh - 220px)",
            }}
          >
            <div
              id="dtd-print-target"
              style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}
            >
              {pageChunks.map((pageLabels, pi) => (
                <div
                  key={pi}
                  className="dtd-sheet"
                  style={{
                    width: `${format.page.w}mm`,
                    height: `${format.page.h}mm`,
                    padding: `${format.page.marginY}mm ${format.page.marginX}mm`,
                    // Paper white forzado: la hoja simulada en preview replica el PDF
                    // que se imprime. No es token del Studio, es "paper".
                    background: "var(--bg-surface)",
                    boxShadow:
                      "0 2px 10px rgba(15,30,61,0.10), 0 0 0 1px rgba(15,30,61,0.06)",
                    display: "grid",
                    gridTemplateColumns: `repeat(${format.cell.cols}, ${format.cell.w}mm)`,
                    gridAutoRows: `${format.cell.h}mm`,
                    columnGap: `${format.cell.gutterX}mm`,
                    rowGap: `${format.cell.gutterY}mm`,
                    justifyContent: "center",
                    alignContent: "flex-start",
                    boxSizing: "border-box",
                    position: "relative",
                    pageBreakAfter: "always",
                    breakAfter: "page",
                  }}
                >
                  {pageLabels.map((boxIdx, li) => (
                    <Label
                      key={`${pi}-${li}`}
                      format={format}
                      client={client}
                      warehouse={warehouse}
                      boxIndex={boxIdx}
                      totalBoxes={totalBoxes}
                      qr={qr}
                    />
                  ))}
                  <div
                    className="dtd-pagenum"
                    style={{
                      position: "absolute",
                      right: 10,
                      bottom: 6,
                      font: "600 9px/1 var(--f-sans)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    Página {pi + 1} de {pages}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SupplierMessageModal
        open={msgOpen}
        onClose={() => setMsgOpen(false)}
        client={client}
        supplier={supplier}
        warehouse={warehouse}
        totalBoxes={totalBoxes}
        copiesPerBox={copiesPerBox}
        totalLabels={labels.length}
      />

      {/* Print stylesheet · @page dinámico */}
      <style>{`
        @media print {
          @page { size: ${format.page.w}mm ${format.page.h}mm; margin: 0; }
          body * { visibility: hidden !important; }
          #dtd-print-target, #dtd-print-target * { visibility: visible !important; }
          #dtd-print-target {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 100% !important;
            padding: 0 !important; margin: 0 !important;
            background: #ffffff !important;
            gap: 0 !important;
          }
          .dtd-sheet {
            box-shadow: none !important;
            page-break-after: always;
            break-after: page;
          }
          .dtd-sheet:last-child { page-break-after: auto; }
          .dtd-pagenum { display: none !important; }
        }
      `}</style>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────

function Card({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "var(--s-4)",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
      }}
    >
      <div
        className="studio-eyebrow"
        style={{ color: "var(--wine)", marginBottom: 10 }}
      >
        {eyebrow}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email";
  mono?: boolean | "cn";
}) {
  const isCn = mono === "cn";
  const isMonoFont = mono === true;
  return (
    <div style={{ marginBottom: "var(--s-2)" }}>
      <label
        className="studio-label"
        htmlFor={`lg-field-${label}`}
        style={{ display: "block", marginBottom: "var(--s-1)" }}
      >
        {label}
      </label>
      <input
        id={`lg-field-${label}`}
        type={type}
        className={`studio-input${isMonoFont ? " studio-input-mono" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={
          isCn
            ? { fontFamily: "'Noto Sans SC', Archivo, sans-serif" }
            : undefined
        }
      />
    </div>
  );
}
