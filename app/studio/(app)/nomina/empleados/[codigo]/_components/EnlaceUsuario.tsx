"use client";

/**
 * Enlace explícito ficha ↔ usuario del Studio (SDD-0652 §4). **Solo admin**: a
 * Contabilidad este componente no le llega, ni la lista de candidatos.
 *
 *   - Sin enlace: selector con los miembros activos que no tienen ficha y el
 *     motivo. El correo de acceso está solo para reconocer a la persona.
 *   - Con enlace: «Quitar enlace», con motivo. La ficha y el usuario quedan.
 *
 * La sugerencia por correo no enlaza: deja elegida a la persona y el foco en
 * el motivo. Enlaza el admin, una por una (D13).
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { motivoValido, type Bloque, type CandidatoEnlace } from "@/lib/studio/nomina/ficha-empleado";
import { linkEmployeeUserAction, unlinkEmployeeUserAction } from "../actions";
import { ReintentarCarga } from "./ReintentarCarga";

export const ID_MOTIVO_ENLACE = "ficha-emp-enlace-motivo";

export function EnlazarConUsuario({
  employeeId,
  egresado,
  candidatos,
  elegido,
  onElegir,
}: {
  employeeId: string;
  egresado: boolean;
  candidatos: Bloque<CandidatoEnlace[]>;
  /** El candidato elegido; lo levanta la ficha para que la sugerencia lo pueda fijar. */
  elegido: string;
  onElegir: (userId: string) => void;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (egresado) {
    return <p className="ficha-emp-nota">Sin cuenta enlazada. Una ficha egresada no se enlaza.</p>;
  }
  if (!candidatos.ok) {
    return <ReintentarCarga compacto>No se pudo cargar la lista de usuarios del Studio.</ReintentarCarga>;
  }
  if (candidatos.data.length === 0) {
    return (
      <p className="ficha-emp-nota">
        Sin cuenta enlazada. Todos los miembros activos del Studio ya tienen ficha: no hay a quién enlazar.
      </p>
    );
  }

  return (
    <div className="ficha-emp-form">
      <p className="ficha-emp-nota">
        Sin cuenta enlazada. Enlázala con su usuario del Studio para ver su acceso desde aquí. Enlazarla también le abre
        la app del empleado.
      </p>
      <div>
        <label className="studio-label" htmlFor="ficha-emp-enlace-usuario">
          Usuario del Studio
        </label>
        <select
          id="ficha-emp-enlace-usuario"
          className="studio-input"
          value={elegido}
          onChange={(ev) => {
            setError(null);
            onElegir(ev.target.value);
          }}
        >
          <option value="">Elige a la persona</option>
          {candidatos.data.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.correoAcceso && c.correoAcceso !== c.nombre ? `${c.nombre} · ${c.correoAcceso}` : c.nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="studio-label" htmlFor={ID_MOTIVO_ENLACE}>
          Motivo
        </label>
        <textarea
          id={ID_MOTIVO_ENLACE}
          className="studio-input"
          rows={2}
          maxLength={500}
          style={{ resize: "vertical" }}
          placeholder="Por qué es la misma persona"
          aria-describedby="ficha-emp-enlace-motivo-ayuda"
          value={motivo}
          onChange={(ev) => {
            setError(null);
            setMotivo(ev.target.value);
          }}
        />
        <p id="ficha-emp-enlace-motivo-ayuda" className="ficha-emp-nota" style={{ marginTop: "var(--s-1)" }}>
          Entre 4 y 500 caracteres. Queda registrado con tu nombre.
        </p>
      </div>
      {error && (
        <Aviso tono="error" compacto>
          {error}
        </Aviso>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ActionButton
          variant="primary"
          size="sm"
          idleLabel="Enlazar con usuario"
          loadingLabel="Enlazando…"
          successLabel="Enlazada"
          disabled={!elegido || !motivoValido(motivo)}
          onAction={async () => {
            setError(null);
            const resultado = await linkEmployeeUserAction(employeeId, elegido, motivo);
            if ("error" in resultado) return { error: resultado.error };
          }}
          onSuccess={() => router.refresh()}
          onError={setError}
        />
      </div>
    </div>
  );
}

export function QuitarEnlace({ employeeId, nombre }: { employeeId: string; nombre: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pendiente, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-sm"
        onClick={() => {
          setError(undefined);
          setAbierto(true);
        }}
      >
        Quitar enlace
      </button>
      <ConfirmDialog
        open={abierto}
        danger
        reason
        reasonRequired
        reasonLabel="Motivo"
        reasonPlaceholder="Por qué se quita el enlace"
        title="Quitar el enlace con su usuario"
        message={`La ficha de ${nombre} y su usuario del Studio quedan como están; solo se quita el vínculo. Esto también le cierra la app del empleado.`}
        confirmLabel="Quitar enlace"
        pending={pendiente}
        error={error}
        onCancel={() => setAbierto(false)}
        onConfirm={(motivo) => {
          setError(undefined);
          startTransition(async () => {
            const resultado = await unlinkEmployeeUserAction(employeeId, motivo);
            if ("error" in resultado) {
              setError(resultado.error);
              return;
            }
            setAbierto(false);
            router.refresh();
          });
        }}
      />
    </>
  );
}
