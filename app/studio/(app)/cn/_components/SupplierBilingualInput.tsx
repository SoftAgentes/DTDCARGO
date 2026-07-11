"use client";

/**
 * SupplierBilingualInput — input principal + auto-detección CN/ES.
 *
 * - Detecta idioma del input principal con regex `/[一-鿿]/`.
 * - Muestra hint según contenido (chino detectado · escribí en español · etc.).
 * - Botón "Traducir" expone un campo para que el operario PEGUE la traducción.
 *   V1: no integramos API de traducción real (mock). El operario carga manualmente
 *   la traducción cuando la tiene (de WeChat, de su contacto, etc.).
 * - Cuando hay traducción, se renderiza como un sub-field gris con dirección
 *   (CN→ES o ES→CN).
 *
 * Props controladas: el padre maneja los valores y los pasa al form.
 */

import { useId, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { isChinese } from "@/lib/studio/warehouse-cn-types";
import { useT } from "@/lib/i18n";

interface Props {
  /** Texto principal (lo que escribió el operario, en cualquier idioma). */
  value: string;
  onChange: (v: string) => void;
  /** Texto traducido (nullable, lo carga el operario al click "Traducir"). */
  translated: string;
  onTranslatedChange: (v: string) => void;
  /** Mostrar la etiqueta "Proveedor chino". */
  label?: string;
  /** Marca como required en el form. */
  required?: boolean;
  /** Disabled si is_orphan = true y el operario no quiere cargar supplier. */
  disabled?: boolean;
  /** Para mostrar errores de field. */
  error?: string;
}

export function SupplierBilingualInput({
  value,
  onChange,
  translated,
  onTranslatedChange,
  label,
  required = false,
  disabled = false,
  error,
}: Props) {
  const t = useT();
  const resolvedLabel = label ?? t("warehouse_cn.drawer.supplier_label_bi");
  const inputId = useId();
  const translatedId = useId();
  const [showTranslated, setShowTranslated] = useState(
    () => translated.trim().length > 0,
  );

  const valueHasChinese = isChinese(value);
  const valueHasLatin = /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(value);
  const direction = valueHasChinese
    ? "CN → ES"
    : valueHasLatin
      ? "ES → CN"
      : null;

  const placeholderLang = valueHasChinese
    ? t("warehouse_cn.supplier.lang_es")
    : t("warehouse_cn.supplier.lang_cn");

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <label htmlFor={inputId} className="studio-label" style={{ margin: 0 }}>
          {resolvedLabel}
          {required && (
            <span style={{ color: "var(--wine-text)", marginLeft: 3 }}>*</span>
          )}
        </label>
        {direction && !disabled && !showTranslated && (
          <button
            type="button"
            onClick={() => setShowTranslated(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 9px",
              borderRadius: "var(--r-sm)",
              background: "var(--wine-tint)",
              color: "var(--wine-text)",
              font: "700 10.5px/1 var(--f-sans)",
              letterSpacing: "0.04em",
              border: 0,
              cursor: "pointer",
            }}
            title={t("warehouse_cn.supplier.translate_title", { direction })}
          >
            {Icon.globe(10)}{" "}
            {t("warehouse_cn.supplier.translate_btn", { direction })}
          </button>
        )}
      </div>

      <input
        id={inputId}
        type="text"
        className="studio-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("warehouse_cn.supplier.placeholder")}
        disabled={disabled}
        required={required}
        style={{
          fontFamily: valueHasChinese
            ? '"Noto Sans SC", var(--f-sans)'
            : "var(--f-sans)",
        }}
      />

      {showTranslated && !disabled && (
        <div
          style={{
            marginTop: "var(--s-2)",
            padding: "10px 12px",
            background: "var(--wine-tint)",
            border: "1px solid var(--wine-soft)",
            borderRadius: "var(--r-md)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--s-2)",
            }}
          >
            <label
              htmlFor={translatedId}
              style={{
                font: "700 10px/1 var(--f-sans)",
                color: "var(--wine-text)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {direction
                ? t("warehouse_cn.supplier.translation_label", { direction })
                : t("warehouse_cn.supplier.translation_label_optional")}
            </label>
            <button
              type="button"
              onClick={() => {
                onTranslatedChange("");
                setShowTranslated(false);
              }}
              style={{
                font: "600 11px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                background: "transparent",
                border: 0,
                cursor: "pointer",
                padding: "2px 6px",
              }}
              aria-label={t("warehouse_cn.supplier.remove_translation")}
            >
              {Icon.close(11)}
            </button>
          </div>
          <input
            id={translatedId}
            type="text"
            className="studio-input"
            value={translated}
            onChange={(e) => onTranslatedChange(e.target.value)}
            placeholder={t("warehouse_cn.supplier.paste_placeholder", {
              lang: placeholderLang,
            })}
            style={{
              background: "var(--bg-surface)",
              fontFamily:
                isChinese(translated) || (!valueHasChinese && translated === "")
                  ? '"Noto Sans SC", var(--f-sans)'
                  : "var(--f-sans)",
            }}
          />
          <p
            style={{
              font: "500 10.5px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            {t("warehouse_cn.supplier.translation_note")}
          </p>
        </div>
      )}

      {!showTranslated && !direction && !disabled && (
        <p
          style={{
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "5px 0 0",
          }}
        >
          {t("warehouse_cn.supplier.bilingual_hint")}
        </p>
      )}

      {error && (
        <p
          style={{
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--danger)",
            margin: "var(--s-1) 0 0",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
