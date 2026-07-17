"use client";

/**
 * Etiqueta individual (SDD-0031).
 *
 * Header bilingüe ES/CN · MARKBOX en JetBrains Mono wine · QR real
 * (qrcode.react → /verificar) · Box X/Y sobre fondo navy · footer con dirección
 * del warehouse CN destino.
 *
 * Dimensiones en mm reales para que el @page CSS imprima al tamaño exacto.
 */

import { QRCodeSVG } from "qrcode.react";

import { CONTACT } from "@/lib/design-tokens";
import { labelVerifyUrl } from "@/lib/studio/etiquetas-qr";
import { FORMATS, type LabelFormat } from "@/lib/studio/etiquetas-formats";
import type { LabelClient, LabelWarehouseCn } from "../page";

// ─────────────────────────────────────────────────────────────
// Formatos disponibles
// ─────────────────────────────────────────────────────────────

// Los formatos son datos puros y viven en lib/ (server-safe): este módulo es
// "use client", así que importar FORMATS desde un server component arrastraría
// el cliente al grafo del servidor — lo caza el paso `rsc-boundary` del gate.
// Se re-exportan acá para no tocar a los consumidores existentes.
export { FORMATS, type LabelFormat };

// QR real → /verificar: la URL la arma labelVerifyUrl (lib/studio/etiquetas-qr.ts);
// el render usa <QRCodeSVG> de qrcode.react (escaneable, único por cartón).

// ─────────────────────────────────────────────────────────────
// Warehouse formatting helper
// ─────────────────────────────────────────────────────────────

export type WarehouseAddress = {
  code: string;
  city: string;
  city_cn: string;
  address_cn: string;
  contact_cn: string;
  phone: string;
  wechat: string;
};

// DTD opera UNA bodega real (Yiwu); su contacto + dirección reales son la fuente
// única CONTACT.cn (lib/design-tokens). El selector de almacén refleja el code y
// la ciudad del catálogo `warehouses_cn`, pero el bloque de contacto SIEMPRE es
// el de la bodega real — sin datos inventados ni "—". (Contacto por hub para
// otros almacenes = a futuro; hoy no hay más bodegas operativas → SDD-0100 §6.)
export function warehouseAddress(w: LabelWarehouseCn): WarehouseAddress {
  const cn = CONTACT.cn;
  return {
    code: w.code,
    city: w.city,
    city_cn: w.hub_name_cn ?? w.city,
    address_cn: cn.addressCjk,
    contact_cn: `${cn.contactPersonCjk} ${cn.contactPersonPinyin}`,
    phone: cn.phone,
    wechat: cn.wechatId,
  };
}

// ─────────────────────────────────────────────────────────────
// Label component
// ─────────────────────────────────────────────────────────────

export function Label({
  format,
  client,
  warehouse,
  boxIndex,
  totalBoxes,
  qr,
  boxCode = null,
}: {
  format: LabelFormat;
  client: LabelClient;
  warehouse: WarehouseAddress;
  boxIndex: number;
  totalBoxes: number;
  qr: boolean;
  /**
   * SDD-0152 · código único de la caja (DTD-B-NNNNNN). Solo lo lleva la etiqueta
   * del HUB, que se imprime DESPUÉS de recibir — ahí ya existe warehouse_boxes.
   * La del proveedor se imprime antes de que la caja exista, así que va sin él
   * y el QR sigue identificando solo al cliente.
   */
  boxCode?: string | null;
}) {
  const isCompact = format.cell.h < 80; // A4-8up + térmica 100×100
  const padding = isCompact ? "7px 9px" : "11px 13px";
  const codeFs = isCompact ? 26 : 36;
  const qrSize = isCompact ? 54 : 78;

  return (
    <div
      className="dtd-label"
      style={{
        width: `${format.cell.w}mm`,
        height: `${format.cell.h}mm`,
        padding,
        background: "#FFFFFF",
        color: "#0F1E3D",
        border: "1.2px solid #0F1E3D",
        borderRadius: 2,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: isCompact ? 4 : 7,
        overflow: "hidden",
        fontFamily: "Archivo, system-ui, sans-serif",
        position: "relative",
        pageBreakInside: "avoid",
        breakInside: "avoid",
      }}
    >
      {/* Header bilingüe */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--s-2)",
          borderBottom: "1px dashed #0F1E3D",
          paddingBottom: isCompact ? 4 : 6,
        }}
      >
        <div>
          <div
            style={{
              font: `900 ${isCompact ? 11 : 13}px/1 'Archivo Black', Archivo, sans-serif`,
              letterSpacing: "0.02em",
            }}
          >
            SHIPPING TO · DTD Cargo
          </div>
          <div
            style={{
              font: `700 ${isCompact ? 10 : 12}px/1.1 'Noto Sans SC', Archivo, sans-serif`,
              color: "#7F0F1A",
              marginTop: 2,
            }}
          >
            寄至：DTD Cargo 国际货运
          </div>
        </div>
        <div
          style={{
            background: "#7F0F1A",
            color: "#FFFFFF",
            padding: isCompact ? "3px 6px" : "4px 8px",
            font: `900 ${isCompact ? 9 : 10.5}px/1 'Archivo Black', sans-serif`,
            letterSpacing: "0.08em",
            borderRadius: 2,
            flexShrink: 0,
          }}
        >
          {warehouse.code}
        </div>
      </div>

      {/* Cuerpo: izq MARKBOX+cliente · der QR */}
      <div
        style={{
          display: "flex",
          gap: isCompact ? 8 : 12,
          alignItems: "flex-start",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: `700 ${isCompact ? 8 : 9}px/1 Archivo, sans-serif`,
              color: "#6B6B6B",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            Shipping Mark · 货主代码
          </div>
          <div
            style={{
              font: `900 ${codeFs}px/1 'JetBrains Mono', ui-monospace, monospace`,
              color: "#7F0F1A",
              letterSpacing: "-0.01em",
              marginBottom: isCompact ? 4 : 7,
            }}
          >
            {client.markbox}
          </div>
          <div
            style={{
              font: `700 ${isCompact ? 9 : 10.5}px/1.2 Archivo, sans-serif`,
              color: "#0F1E3D",
            }}
          >
            {client.name}
          </div>
          {client.company && (
            <div
              style={{
                font: `500 ${isCompact ? 8.5 : 10}px/1.2 Archivo, sans-serif`,
                color: "#6B6B6B",
                marginTop: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {client.company}
            </div>
          )}
        </div>

        {qr && (
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <QRCodeSVG
              value={labelVerifyUrl(client.markbox, boxIndex, totalBoxes, boxCode)}
              size={qrSize}
              marginSize={4}
              fgColor="#0F1E3D"
              bgColor="#FFFFFF"
              level={isCompact ? "L" : "M"}
              aria-label={
                boxCode
                  ? `Caja ${boxCode} · ${client.markbox} · ${boxIndex} de ${totalBoxes}`
                  : `Verificar ${client.markbox} · caja ${boxIndex} de ${totalBoxes}`
              }
            />
          </div>
        )}
      </div>

      {/* Box X/Y bilingüe */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isCompact ? "4px 8px" : "6px 10px",
          background: "#0F1E3D",
          color: "#FFFFFF",
          borderRadius: 2,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span
            style={{
              font: `700 ${isCompact ? 8 : 9.5}px/1 Archivo, sans-serif`,
              opacity: 0.8,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            BOX · 箱号
          </span>
          {/* SDD-0152 · el código legible: si el QR se raya o la cámara falla,
              el operario lo teclea a mano y la estiba sigue. */}
          {boxCode && (
            <span
              style={{
                font: `700 ${isCompact ? 7.5 : 9}px/1 'JetBrains Mono', monospace`,
                opacity: 0.75,
                letterSpacing: "0.02em",
              }}
            >
              {boxCode}
            </span>
          )}
        </div>
        <div
          style={{
            font: `900 ${isCompact ? 15 : 19}px/1 'JetBrains Mono', monospace`,
            letterSpacing: "-0.01em",
          }}
        >
          {boxIndex} <span style={{ opacity: 0.55 }}>/</span> {totalBoxes}
        </div>
      </div>

      {/* Footer warehouse */}
      {!isCompact && (
        <div
          style={{
            marginTop: "auto",
            paddingTop: "var(--s-1)",
            borderTop: "1px dashed #E8E6E2",
          }}
        >
          <div
            style={{
              font: "600 8px/1.3 'Noto Sans SC', Archivo, sans-serif",
              color: "#0F1E3D",
            }}
          >
            收货地址：{warehouse.address_cn}
          </div>
          <div
            style={{
              font: "500 7.5px/1.3 Archivo, sans-serif",
              color: "#6B6B6B",
              marginTop: 1,
            }}
          >
            联系 / Contacto: {warehouse.contact_cn} · {warehouse.phone} · WeChat{" "}
            {warehouse.wechat}
          </div>
        </div>
      )}
      {isCompact && (
        <div
          style={{
            marginTop: "auto",
            font: "600 7px/1.2 'Noto Sans SC', Archivo, sans-serif",
            color: "#6B6B6B",
            textAlign: "center",
          }}
        >
          {warehouse.city_cn} · WeChat {warehouse.wechat}
        </div>
      )}
    </div>
  );
}
