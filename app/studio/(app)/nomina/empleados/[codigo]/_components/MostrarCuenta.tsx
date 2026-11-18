"use client";

/**
 * «Mostrar» la cuenta bancaria completa (SDD-0652 fase 2, D9 opción b).
 *
 * La ficha trae la cuenta enmascarada desde el servidor. El número completo se
 * pide aparte, con motivo, y cada consulta queda registrada con quién y para
 * qué. Aquí vive solo en memoria: se oculta sola al minuto, al pulsar
 * «Ocultar» o al salir de la ficha. No se guarda en ningún lado.
 */

import { useEffect, useState, useTransition } from "react";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { revealBankAccountAction } from "../actions";

const VISIBLE_MS = 60_000;

export function MostrarCuenta({ employeeId, enmascarada }: { employeeId: string; enmascarada: string }) {
  const [cuenta, setCuenta] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pendiente, startTransition] = useTransition();

  useEffect(() => {
    if (!cuenta) return;
    const t = setTimeout(() => setCuenta(null), VISIBLE_MS);
    return () => clearTimeout(t);
  }, [cuenta]);

  return (
    <>
      {/* Lista propia, pegada a la de Banco: el diálogo no puede vivir dentro de un <dl>. */}
      <dl style={{ margin: 0 }}>
        <div className="ficha-emp-row ficha-emp-row--sigue">
          <dt>Cuenta</dt>
          <dd className="ficha-emp-cuenta">
            <span className="ficha-emp-mono" aria-live="polite">
              {cuenta ?? enmascarada}
            </span>
            {cuenta ? (
              <button type="button" className="studio-btn studio-btn-ghost studio-btn-xs" onClick={() => setCuenta(null)}>
                Ocultar
              </button>
            ) : (
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-xs"
                aria-label="Mostrar la cuenta bancaria completa"
                onClick={() => {
                  setError(undefined);
                  setAbierto(true);
                }}
              >
                Mostrar
              </button>
            )}
          </dd>
        </div>
      </dl>
      <ConfirmDialog
        open={abierto}
        reason
        reasonRequired
        reasonLabel="Motivo"
        reasonPlaceholder="Para qué necesitas la cuenta completa"
        title="Mostrar la cuenta completa"
        message="Queda registrado quién la consultó, cuándo y con qué motivo. Se oculta sola al minuto."
        confirmLabel="Mostrar"
        pending={pendiente}
        error={error}
        onCancel={() => setAbierto(false)}
        onConfirm={(motivo) => {
          setError(undefined);
          startTransition(async () => {
            const resultado = await revealBankAccountAction(employeeId, motivo);
            if ("error" in resultado) {
              setError(resultado.error);
              return;
            }
            setCuenta(resultado.cuenta);
            setAbierto(false);
          });
        }}
      />
    </>
  );
}
