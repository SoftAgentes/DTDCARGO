/**
 * SDD-0625 · Retiro con motivo (SDD-0611 §4.5 y §4.11).
 *
 * Lista cerrada de motivos (radio), nota libre (obligatoria con «Otro», sin
 * datos personales). El botón de retirar es `danger` y va solo, separado de
 * «Cancelar» (regla 8 de botones). El servidor vuelve a validar todo.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { MOTIVOS_RETIRO, NOTA_MAX, type MotivoRetiro } from "@/lib/news/autopublicar/motivos";
import { retirarNoticia } from "../actions";

export function RetiroForm({ id, titulo, slug }: { id: string; titulo: string; slug: string }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [motivo, setMotivo] = useState<MotivoRetiro | "">("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);

  const faltaNota = motivo === "otro" && nota.trim() === "";

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 720 }}>
      <div style={{ background: "var(--color-grey-100, #F2F0EC)", borderRadius: 10, padding: "14px 16px" }}>
        <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{titulo}</p>
        <code style={{ fontSize: 12, color: "var(--color-grey-500, #6B6B6B)" }}>/noticias/{slug}</code>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>¿Por qué sale? (obligatorio)</legend>
        <div style={{ display: "grid", gap: 8 }}>
          {(Object.keys(MOTIVOS_RETIRO) as MotivoRetiro[]).map((m) => (
            <label key={m} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, minHeight: 32, cursor: "pointer" }}>
              <input
                type="radio"
                name={`${uid}-motivo`}
                value={m}
                checked={motivo === m}
                onChange={() => setMotivo(m)}
              />
              {MOTIVOS_RETIRO[m]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${uid}-nota`} style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Nota {motivo === "otro" ? "(obligatoria)" : "(opcional)"}
        </label>
        <textarea
          id={`${uid}-nota`}
          className="studio-input"
          style={{ width: "100%", minHeight: 90, height: "auto", paddingTop: 8 }}
          value={nota}
          maxLength={NOTA_MAX}
          aria-describedby={`${uid}-nota-ayuda`}
          onChange={(e) => setNota(e.target.value)}
        />
        <p id={`${uid}-nota-ayuda`} style={{ fontSize: 12, color: "var(--color-grey-500, #6B6B6B)", marginTop: 4 }}>
          Qué estaba mal, por ejemplo «el tiempo de tránsito no era el correcto». Sin teléfonos, correos, cédulas ni direcciones.
        </p>
      </div>

      {error ? (
        <p role="alert" style={{ fontSize: 14, color: "var(--color-status-danger, #c2353f)", margin: 0 }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <Link className="studio-btn studio-btn-ghost studio-btn-sm" href="/studio/marketing/noticias-web/publicadas">
          Cancelar
        </Link>
        <ActionButton
          variant="danger"
          size="sm"
          idleLabel="Retirar del sitio"
          loadingLabel="Retirando…"
          successLabel="Retirada"
          disabled={motivo === "" || faltaNota}
          title={motivo === "" ? "Elige el motivo" : faltaNota ? "Con «Otro» escribe la nota" : undefined}
          onAction={async () => {
            setError(null);
            const res = await retirarNoticia(id, motivo, nota);
            return res.ok ? undefined : { error: res.error };
          }}
          onError={setError}
          onSuccess={() => {
            toast.success(`«${titulo}» salió del sitio`, {
              link: {
                href: `/studio/marketing/noticias-web/publicadas?highlight=${id}&hl-tone=success`,
                label: "Ver en Retiradas",
              },
            });
            router.push(`/studio/marketing/noticias-web/publicadas?highlight=${id}&hl-tone=success`);
          }}
        />
      </div>
    </div>
  );
}
