"use client";

/**
 * Foto del empleado en la cabecera de la ficha (SDD-0652 fase 2, UPL-01).
 *
 * Antes de elegir, dice el tipo, el tamaño máximo y para qué es. El estado del
 * archivo se ve: subiendo, lista o falló. El servidor vuelve a validar todo
 * (`uploadEmployeePhotoAction`): lo de aquí es solo para avisar rápido.
 *
 * La URL que llega es firmada y corta; la arma el servidor después del control
 * de rol. Sin foto, o si no se pudo firmar, se ven las iniciales.
 */

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { Avatar } from "@/app/studio/_components/ui/Avatar";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { iniciales } from "@/lib/studio/nomina/ficha-empleado";
import { removeEmployeePhotoAction, uploadEmployeePhotoAction } from "../actions";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;
const LADO = 72;

type Estado = { fase: "reposo" } | { fase: "subiendo" } | { fase: "lista" } | { fase: "error"; mensaje: string };

export function FotoEmpleado({
  employeeId,
  nombre,
  fotoUrl,
  puedeCambiar,
}: {
  employeeId: string;
  nombre: string;
  fotoUrl: string | null;
  /** El rol edita Nómina y la ficha no está egresada. */
  puedeCambiar: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>({ fase: "reposo" });
  const [confirmando, setConfirmando] = useState(false);
  const [errorQuitar, setErrorQuitar] = useState<string | undefined>(undefined);
  const [quitando, startQuitar] = useTransition();
  const [, startRefresh] = useTransition();
  const subiendo = estado.fase === "subiendo";

  const elegir = async (ev: ChangeEvent<HTMLInputElement>) => {
    const archivo = ev.target.files?.[0];
    ev.target.value = ""; // elegir el mismo archivo otra vez vuelve a disparar
    if (!archivo) return;
    if (!TIPOS.includes(archivo.type)) {
      setEstado({ fase: "error", mensaje: "El archivo no es una imagen JPG, PNG o WebP." });
      return;
    }
    if (archivo.size > MAX_BYTES) {
      setEstado({ fase: "error", mensaje: "La foto pesa más de 2 MB." });
      return;
    }
    setEstado({ fase: "subiendo" });
    const datos = new FormData();
    datos.set("foto", archivo);
    let resultado: Awaited<ReturnType<typeof uploadEmployeePhotoAction>>;
    try {
      resultado = await uploadEmployeePhotoAction(employeeId, datos);
    } catch {
      resultado = { error: "No se pudo subir la foto. Revisa tu conexión e intenta de nuevo." };
    }
    if ("error" in resultado) {
      setEstado({ fase: "error", mensaje: resultado.error });
      return;
    }
    setEstado({ fase: "lista" });
    startRefresh(() => router.refresh());
  };

  const quitar = () => {
    setErrorQuitar(undefined);
    startQuitar(async () => {
      const resultado = await removeEmployeePhotoAction(employeeId);
      if ("error" in resultado) {
        setErrorQuitar(resultado.error);
        return;
      }
      setConfirmando(false);
      setEstado({ fase: "reposo" });
      router.refresh();
    });
  };

  return (
    <div className="ficha-emp-foto">
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL firmada y corta de un bucket privado; no pasa por el optimizador
        <img
          src={fotoUrl}
          alt={`Foto de ${nombre}`}
          width={LADO}
          height={LADO}
          className="ficha-emp-foto-img"
          decoding="async"
        />
      ) : (
        <Avatar initials={iniciales(nombre)} size={LADO} />
      )}

      {puedeCambiar && (
        <div className="ficha-emp-foto-acciones">
          <input
            ref={input}
            id="ficha-emp-foto-input"
            type="file"
            accept={TIPOS.join(",")}
            className="ficha-emp-foto-input"
            aria-label={`Elegir la foto de ${nombre}`}
            aria-describedby="ficha-emp-foto-ayuda"
            tabIndex={-1}
            disabled={subiendo}
            onChange={elegir}
          />
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-xs"
            disabled={subiendo}
            aria-busy={subiendo}
            onClick={() => input.current?.click()}
          >
            {subiendo ? "Subiendo…" : fotoUrl ? "Cambiar foto" : "Subir foto"}
          </button>
          {fotoUrl && (
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-xs"
              disabled={subiendo}
              onClick={() => {
                setErrorQuitar(undefined);
                setConfirmando(true);
              }}
            >
              Quitar
            </button>
          )}
          <p id="ficha-emp-foto-ayuda" className="ficha-emp-foto-ayuda">
            JPG, PNG o WebP, hasta 2 MB. Sirve para reconocer a la persona en Nómina.
          </p>
          <span role="status" aria-live="polite" className="ficha-emp-foto-estado">
            {estado.fase === "subiendo" ? "Subiendo y procesando la foto…" : estado.fase === "lista" ? "Foto guardada." : ""}
          </span>
          {estado.fase === "error" && (
            <Aviso tono="error" compacto>
              {estado.mensaje}
            </Aviso>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmando}
        danger
        title="Quitar la foto"
        message={`La ficha de ${nombre} queda sin foto. Puedes subir otra después.`}
        confirmLabel="Quitar foto"
        pending={quitando}
        error={errorQuitar}
        onCancel={() => setConfirmando(false)}
        onConfirm={quitar}
      />
    </div>
  );
}
