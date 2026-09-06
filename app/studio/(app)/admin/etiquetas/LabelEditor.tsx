"use client";
import { useState } from "react";
import type { LabelPresentation } from "@/lib/shared/label-presentation";
import { ShippingBoxLabel } from "@/app/portal/_components/ShippingBoxLabel";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { saveLabelPresentation } from "./actions";
import { printDocument } from "@/lib/shared/print-document";

export function LabelEditor({ initial, version: initialVersion, available }: { initial: LabelPresentation; version: number; available: boolean }) {
  const [settings, setSettings] = useState(initial);
  const [version, setVersion] = useState(initialVersion);
  return <div className="space-y-5">
    {!available && <p role="status">La configuración aún no está disponible. Puedes revisar la vista previa; guardar requiere habilitar la migración del PR.</p>}
    <fieldset className="grid gap-4 no-print">
      <legend className="font-bold">Presentación · versión {version}</legend>
      <label><input type="checkbox" checked={settings.showBrand} onChange={e => setSettings({ ...settings, showBrand: e.target.checked })} /> Mostrar marca (DTD Cargo o marca del aliado)</label>
      <label className="flex flex-col gap-2">Idioma de apoyo <select className="rounded-lg border px-3 py-2" value={settings.language} onChange={e => setSettings({ ...settings, language: e.target.value as LabelPresentation["language"] })}><option value="zh-es">中文 + Español</option><option value="zh-en">中文 + English</option></select></label>
      <label className="flex flex-col gap-2">Tamaño del QR <select className="rounded-lg border px-3 py-2" value={settings.size} onChange={e => setSettings({ ...settings, size: e.target.value as LabelPresentation["size"] })}><option value="standard">Estándar</option><option value="large">Grande</option></select></label>
    </fieldset>
    <div className="labels-print-area max-w-sm">
      <p className="font-bold">MUESTRA · NO PEGAR EN CAJAS</p>
      <ShippingBoxLabel label={{ code: "DTD-0000-1-1", boxN: 1, totalBoxes: 23 }} markbox="DTD-0000" brandName="DTD Cargo" presentation={settings} />
    </div>
    <div className="flex gap-3 no-print">
      <ActionButton disabled={!available} variant="primary" idleLabel="Guardar presentación" loadingLabel="Guardando…" successLabel="Presentación guardada" onAction={async () => {
        if (!available) return { error: "La configuración aún no está habilitada." };
        const result = await saveLabelPresentation(settings, version);
        if (result.error) return { error: result.error };
        setVersion(result.version!);
      }} />
      <button type="button" className="btn btn-ghost" onClick={() => printDocument("labels")}>Imprimir muestra</button>
    </div>
    <style>{`@media print { body * { visibility: hidden; } .labels-print-area, .labels-print-area * { visibility: visible; } .labels-print-area { position: absolute; top: 0; left: 0; } .no-print { display: none !important; } }`}</style>
  </div>;
}
