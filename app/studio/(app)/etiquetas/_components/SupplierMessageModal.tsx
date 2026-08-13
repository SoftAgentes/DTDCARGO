"use client";

/**
 * Modal mensaje al supplier (SDD-0031).
 *
 * 2 textareas (ES + 中文) generadas con los datos del cliente + warehouse
 * + total cajas + copias. Botón "Copiar" usa navigator.clipboard (fallback
 * a document.execCommand). Botón "Abrir en email" abre mailto: con body
 * pre-armado.
 */

import { useState } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import type { LabelClient } from "../page";
import type { WarehouseAddress } from "./Label";
import { brandNameCjk } from "@/lib/shared/brand-context";
import { printMarkbox } from "@/lib/shared/markbox-chain";

type SupplierFreeForm = {
  contactName: string;
  contactCn: string;
  city: string;
  wechat: string;
  email: string;
};

export function SupplierMessageModal({
  open,
  onClose,
  client,
  supplier,
  warehouse,
  totalBoxes,
  copiesPerBox,
  totalLabels,
}: {
  open: boolean;
  onClose: () => void;
  client: LabelClient;
  supplier: SupplierFreeForm;
  warehouse: WarehouseAddress;
  totalBoxes: number;
  copiesPerBox: number;
  totalLabels: number;
}) {
  const [copied, setCopied] = useState<"es" | "cn" | "">("");

  if (!open) return null;

  const copiesNote =
    copiesPerBox > 1
      ? ` (${copiesPerBox} etiquetas por caja, pega una en cada cara para que no se pierda la trazabilidad si una se tapa o maltrata)`
      : "";
  const copiesNoteCn =
    copiesPerBox > 1
      ? `（每个箱子贴 ${copiesPerBox} 张标签，在不同面上各贴一张，防止装卸时贴纸被遮挡或损坏）`
      : "";

  const msgEs = `Hola ${supplier.contactName || "equipo"},

Adjunto te paso ${totalLabels} etiquetas ${client.brand.name} para ${totalBoxes} cajas${copiesNote}. Pégalas antes del despacho a nuestro almacén ${warehouse.code} (${warehouse.city}).

Shipping Mark del cliente: ${printMarkbox(client.markbox)}
Cliente: ${client.name}
Total cajas: ${totalBoxes}
Etiquetas por caja: ${copiesPerBox}

Cualquier duda escríbeme por WeChat: ${warehouse.wechat}

Gracias!
${client.brand.name}`;

  const msgCn = `${supplier.contactCn ? supplier.contactCn + "您好" : "您好"}：

附件是 ${totalLabels} 张 ${client.brand.name} 标签，用于 ${totalBoxes} 个箱子${copiesNoteCn}。请在发到我们仓库 ${warehouse.code}（${warehouse.city_cn}）之前贴好。

客户编号 (Shipping Mark): ${printMarkbox(client.markbox)}
客户名称: ${client.name}
总箱数: ${totalBoxes}
每箱标签数: ${copiesPerBox}

如有疑问请微信联系: ${warehouse.wechat}

谢谢！
${brandNameCjk(client.brand)}`;

  async function copy(text: string, label: "es" | "cn") {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback execCommand
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(label);
      setTimeout(() => setCopied(""), 1800);
    } catch (e) {
      console.error("[copy] failed", e);
    }
  }

  const mailtoHref = supplier.email
    ? `mailto:${encodeURIComponent(supplier.email)}?subject=${encodeURIComponent(
        `${client.brand.name} · ${totalBoxes} etiquetas · Shipping Mark ${printMarkbox(client.markbox)}`,
      )}&body=${encodeURIComponent(msgEs + "\n\n— — —\n\n" + msgCn)}`
    : null;

  return (
    <DrawerShell
      title="Mensaje para el supplier"
      onClose={onClose}
      pending={false}
      width={640}
      variant="centered"
    >
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 22,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <p
            style={{
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            Copia uno de los dos mensajes y mándalo por WeChat o email junto con
            el PDF de etiquetas.
          </p>

          <MsgBlock
            title="Mensaje en español"
            text={msgEs}
            onCopy={() => copy(msgEs, "es")}
            copied={copied === "es"}
          />

          <MsgBlock
            title="中文消息"
            text={msgCn}
            onCopy={() => copy(msgCn, "cn")}
            copied={copied === "cn"}
            mono="cn"
          />

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              marginTop: "var(--s-1)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="studio-btn studio-btn-ghost"
            >
              Cerrar
            </button>
            {mailtoHref ? (
              <a
                href={mailtoHref}
                className="studio-btn studio-btn-primary"
                onClick={onClose}
              >
                Abrir en email
              </a>
            ) : (
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                disabled
                title="Carga el email del supplier en el panel para habilitar"
              >
                Abrir en email
              </button>
            )}
          </div>
        </div>
    </DrawerShell>
  );
}

function MsgBlock({
  title,
  text,
  onCopy,
  copied,
  mono,
}: {
  title: string;
  text: string;
  onCopy: () => void;
  copied: boolean;
  mono?: "cn";
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "var(--s-2) var(--s-3)",
          background: "var(--bg-elevated)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            font: "700 11px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
        <button
          type="button"
          onClick={onCopy}
          style={{
            font: "700 11.5px/1 var(--f-sans)",
            color: copied ? "var(--success)" : "var(--wine)",
            background: "transparent",
            border: 0,
            cursor: "pointer",
            padding: "var(--s-1)",
          }}
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "var(--s-3)",
          font: `500 12px/1.55 ${mono === "cn" ? "'Noto Sans SC', Archivo" : "var(--f-sans)"}`,
          color: "var(--ink)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: "var(--bg-surface)",
          maxHeight: 220,
          overflow: "auto",
        }}
      >
        {text}
      </pre>
    </div>
  );
}
