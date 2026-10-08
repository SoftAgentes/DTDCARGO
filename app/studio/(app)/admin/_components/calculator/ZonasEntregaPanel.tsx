"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CalculatorCity, CalculatorCityActionState } from "@/lib/studio/calculator-cities-types";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { saveDeliveryZoneAction } from "../../calculator-actions";

/** SDD-0504. Una ciudad por guardado: no reemplaza catálogo ni tarifario. */
export function ZonasEntregaPanel({ cities, isAdmin }: {
  cities: CalculatorCity[];
  isAdmin: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const router = useRouter();
  return (
    <section aria-labelledby="delivery-zones-title" style={{ marginBottom: "var(--s-6)" }}>
      <h3 id="delivery-zones-title" style={{ fontFamily: "var(--f-display)", color: "var(--ink)" }}>
        Zonas con entrega incluida
      </h3>
      <p style={{ color: "var(--ink-soft)", fontFamily: "var(--f-sans)" }}>
        Marca las ciudades donde la entrega forma parte del precio base. Las demás
        usan su tarifa vigente; sin tarifa confirmada, el cliente consulta al asesor.
        El costo del transportista se conserva.
      </p>
      {!isAdmin && <p style={{ color: "var(--ink-soft)" }}>Solo un administrador puede cambiar estas zonas.</p>}
      <p role="status" style={{ color: "var(--ink)", margin: "var(--s-2) 0" }}>{saved}</p>
      {cities.length === 0 ? (
        <EmptyState title="No hay ciudades configuradas" description="Agrega ciudades en el catálogo de abajo. El sitio usa el respaldo mientras no haya catálogo persistido." />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--bg-surface)" }}>
          {cities.map((city) => (
            <li key={city.id} style={{ padding: "var(--s-3) var(--s-4)", borderBottom: "1px solid var(--border)" }}>
              {editingId === city.id && isAdmin ? (
                <ZoneForm key={city.updated_at} city={city} onCancel={() => {
                  setEditingId(null);
                  requestAnimationFrame(() => document.getElementById(`zone-edit-${city.id}`)?.focus());
                }} onSaved={() => {
                  setSaved(`Entrega de ${city.label} actualizada.`);
                  setEditingId(null);
                  router.refresh();
                  requestAnimationFrame(() => document.getElementById(`zone-edit-${city.id}`)?.focus());
                }} />
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--s-3)" }}>
                  <span style={{ flex: 1, color: "var(--ink)", fontFamily: "var(--f-sans)" }}>{city.label}</span>
                  <Badge tone="neutral" size="sm">{city.casco ? "Incluida" : "No incluida"}</Badge>
                  {isAdmin && <button id={`zone-edit-${city.id}`} type="button" className="studio-btn studio-btn-ghost studio-btn-sm" disabled={editingId !== null} aria-label={`Cambiar entrega de ${city.label}`} onClick={() => {
                    setSaved("");
                    setEditingId(city.id);
                  }}>Cambiar</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ZoneForm({ city, onCancel, onSaved }: {
  city: CalculatorCity;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [included, setIncluded] = useState(city.casco);
  const [state, action, pending] = useActionState<CalculatorCityActionState, FormData>(
    saveDeliveryZoneAction.bind(null, city.id), {},
  );
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.ok) onSaved();
    if (state.error) errorRef.current?.focus();
  }, [state, onSaved]);
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (pending || included === city.casco) return;
      const data = new FormData(event.currentTarget);
      // Despacho explícito: React no resetea el checkbox ante un error de negocio.
      startTransition(() => action(data));
    }} aria-label={`Entrega de ${city.label}`} aria-busy={pending} style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      <input type="hidden" name="casco" value={String(included)} />
      <input type="hidden" name="previousCasco" value={String(city.casco)} />
      <label style={{ display: "flex", gap: "var(--s-3)", alignItems: "center", color: "var(--ink)" }}>
        <input type="checkbox" className="studio-checkbox" autoFocus checked={included} disabled={pending} onChange={(e) => setIncluded(e.target.checked)} />
        Entrega incluida en el precio base · {city.label}
      </label>
      <p style={{ margin: 0, color: "var(--ink-soft)" }}>
        {included ? "El cliente no paga recargo de entrega." : "El cliente paga la tarifa vigente de entrega. Sin tarifa confirmada, consulta al asesor."}
      </p>
      {state.error && <p ref={errorRef} tabIndex={-1} role="alert" style={{ margin: 0, padding: "var(--s-3)", background: "var(--danger-bg)", color: "var(--ink)", border: "1px solid var(--danger)", borderRadius: "var(--r-sm)" }}>{state.error}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)", justifyContent: "flex-end" }}>
        <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" disabled={pending} onClick={onCancel}>Cancelar</button>
        <button type="submit" className="studio-btn studio-btn-primary studio-btn-sm" disabled={pending || included === city.casco}>{pending ? "Guardando…" : "Guardar cambios"}</button>
      </div>
    </form>
  );
}
