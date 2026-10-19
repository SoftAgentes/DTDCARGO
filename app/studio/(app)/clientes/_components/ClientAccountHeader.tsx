/**
 * SDD-0558 · Cabecera de cuenta de la ficha del cliente (v1).
 *
 * Cuatro tarjetas: «Saldo abierto», «Vencido», «Último pago» y «Embarques en
 * curso». El saldo sale de la definición única (`client_outstanding`, migración
 * 0492) y se muestra POR MONEDA, sin sumar ni convertir: la primera moneda con
 * algo va en el valor y las demás en la línea de abajo. Incluye las facturas y
 * embarques de los códigos anteriores y de las fichas fusionadas, y lo dice.
 *
 * Quién ve qué (decisión 14 de Sam, 2026-10-18: «Todo el que ve clientes»):
 *  - con permiso para el saldo, las cuatro tarjetas;
 *  - sin permiso (ERR-01, seguridad), SOLO «Embarques en curso»: ni un dato de
 *    dinero, ni un aviso que revele que lo hay;
 *  - si el cálculo falla (ERR-01, sistema), un mensaje recuperable con la
 *    referencia que quedó en el log, y «Embarques en curso».
 *
 * Componente de servidor, sin estado. Las fechas sin hora se formatean sin
 * `Date` (`fechaCorta`) y los montos con `formatInvoiceAmount` («USD 1,250.00»),
 * el mismo formato del panel de Conversaciones.
 */

import type { ReactNode } from "react";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { formatInvoiceAmount } from "@/lib/portal/portal-types";
import { AGING_BUCKETS } from "@/lib/studio/reports/types";
import {
  fechaCorta,
  type ClientAccountSummary,
  type EstadoCuentaCliente,
  type SaldoPorMoneda,
} from "@/lib/studio/client-account";

/**
 * 260 px de mínimo, MEDIDO con la Sora real (900 30px, tabular-nums, −0.02em):
 * «1,234,567.89» mide 201 px y «12,345,678.90», 220 px; con los 40 px de
 * relleno de KpiCard, 260 px es el ancho en que la cifra más larga de un saldo
 * en bolívares cabe sola en su renglón, con la moneda en el de arriba. Con
 * menos, KpiCard (overflow: hidden) la cortaría sin avisar. «USD 12,345.00»
 * (224 px) cabe en un renglón.
 */
const GRILLA = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "var(--s-4)",
} as const;

const NOTA = {
  font: "500 12px/1.5 var(--f-sans)",
  color: "var(--ink-soft)",
  margin: "var(--s-2) 0 0",
  maxWidth: "80ch",
} as const;

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function monto(s: SaldoPorMoneda, campo: "abierto" | "vencido"): string {
  return formatInvoiceAmount(s[campo], s.currency);
}

function Lineas({ lineas }: { lineas: (string | null)[] }) {
  const visibles = lineas.filter((l): l is string => Boolean(l));
  if (visibles.length === 0) return null;
  return (
    <>
      {visibles.map((l, i) => (
        <span key={i} style={{ display: "block" }}>
          {l}
        </span>
      ))}
    </>
  );
}

function EmbarquesEnCurso({ total, codigos }: { total: number | null; codigos: number }) {
  return (
    <KpiCard
      label="Embarques en curso"
      value={total === null ? "—" : total}
      sub={
        <Lineas
          lineas={[
            total === null ? "No se pudieron contar" : "Sin entregar, cancelar ni en borrador",
            codigos > 1 ? "En todos sus códigos" : null,
          ]}
        />
      }
    />
  );
}

function TarjetaSaldo({ cuenta }: { cuenta: ClientAccountSummary }) {
  const conSaldo = cuenta.saldos.filter((s) => s.abierto > 0);
  if (conSaldo.length === 0) {
    return (
      <KpiCard label="Saldo abierto" value="Al día" sub="Sin facturas por cobrar" highlightWhenPositive={false} />
    );
  }
  const facturas = conSaldo.reduce((n, s) => n + s.facturasAbiertas, 0);
  return (
    <KpiCard
      label="Saldo abierto"
      value={monto(conSaldo[0], "abierto")}
      sub={
        <Lineas
          lineas={[
            conSaldo.length > 1
              ? `Además ${conSaldo.slice(1).map((s) => monto(s, "abierto")).join(" · ")}`
              : null,
            plural(facturas, "factura por cobrar", "facturas por cobrar"),
          ]}
        />
      }
    />
  );
}

function TarjetaVencido({ cuenta }: { cuenta: ClientAccountSummary }) {
  const conVencido = cuenta.saldos.filter((s) => s.vencido > 0);
  if (conVencido.length === 0) {
    return (
      <KpiCard
        label="Vencido"
        value="Al día"
        sub={`Nada vencido al ${fechaCorta(cuenta.asOf)}`}
        highlightWhenPositive={false}
      />
    );
  }
  // El tramo es el del vencimiento más antiguo ENTRE monedas, con su moneda.
  const masAntiguo = conVencido.reduce((a, b) => ((b.diasVencido ?? 0) > (a.diasVencido ?? 0) ? b : a));
  const tramo = AGING_BUCKETS.find((b) => b.id === masAntiguo.tramo)?.label ?? null;
  const facturas = conVencido.reduce((n, s) => n + s.facturasVencidas, 0);
  return (
    <KpiCard
      label="Vencido"
      value={monto(conVencido[0], "vencido")}
      valueColor="var(--danger)"
      sub={
        <Lineas
          lineas={[
            conVencido.length > 1
              ? `Además ${conVencido.slice(1).map((s) => monto(s, "vencido")).join(" · ")}`
              : null,
            `${tramo ? `Más antiguo: ${tramo}, en ${masAntiguo.currency}` : "Vencido"} · ${plural(
              facturas,
              "factura vencida",
              "facturas vencidas",
            )}`,
          ]}
        />
      }
    />
  );
}

function TarjetaUltimoPago({ cuenta }: { cuenta: ClientAccountSummary }) {
  return (
    <KpiCard
      label="Último pago"
      value={cuenta.ultimoPago ? fechaCorta(cuenta.ultimoPago) : "Sin pagos"}
      sub={cuenta.ultimoPago ? "Recibos y reportes confirmados" : "Sin recibos ni reportes confirmados"}
      highlightWhenPositive={false}
    />
  );
}

function Seccion({ children, notas }: { children: ReactNode; notas?: ReactNode }) {
  return (
    <section aria-label="Cuenta del cliente" style={{ marginBottom: "var(--s-6)" }}>
      <div style={GRILLA}>{children}</div>
      {notas}
    </section>
  );
}

export function ClientAccountHeader({
  estado,
  canViewStatement,
}: {
  estado: EstadoCuentaCliente;
  /** El rol abre el estado de cuenta: solo a él le sirve la nota de diferencia. */
  canViewStatement: boolean;
}) {
  if (estado.tipo === "sin-permiso") {
    return (
      <Seccion>
        <EmbarquesEnCurso total={estado.embarquesEnCurso} codigos={estado.markboxes.length} />
      </Seccion>
    );
  }

  if (estado.tipo === "error") {
    return (
      <Seccion>
        <div
          role="status"
          style={{
            gridColumn: "1 / -1",
            background: "var(--warning-bg)",
            border: "1px solid var(--warning)",
            borderRadius: "var(--r-lg)",
            padding: "var(--s-4) var(--s-5)",
            font: "500 13px/1.5 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          <strong style={{ display: "block", marginBottom: "var(--s-1)" }}>No se pudo calcular el saldo.</strong>
          Recarga la página en unos minutos. Si sigue igual, avísale a soporte con la referencia{" "}
          <code style={{ font: "600 12px/1 var(--f-mono)" }}>{estado.referencia}</code>.
        </div>
        <EmbarquesEnCurso total={estado.embarquesEnCurso} codigos={estado.markboxes.length} />
      </Seccion>
    );
  }

  const { cuenta } = estado;
  const anteriores = cuenta.markboxes.slice(1);
  const masDeUnaMoneda = cuenta.saldos.length > 1;
  return (
    <Seccion
      notas={
        <>
          {anteriores.length > 0 ? (
            <p style={NOTA}>Incluye los códigos anteriores o fusionados: {anteriores.join(", ")}.</p>
          ) : null}
          {canViewStatement && (anteriores.length > 0 || masDeUnaMoneda) ? (
            <p style={NOTA}>
              El estado de cuenta muestra solo el código vigente y una moneda, así que su saldo puede
              no coincidir con este.
            </p>
          ) : null}
          <p style={NOTA}>Saldo al {fechaCorta(cuenta.asOf)}, con la fecha de Caracas.</p>
        </>
      }
    >
      <TarjetaSaldo cuenta={cuenta} />
      <TarjetaVencido cuenta={cuenta} />
      <TarjetaUltimoPago cuenta={cuenta} />
      <EmbarquesEnCurso total={cuenta.embarquesEnCurso} codigos={cuenta.markboxes.length} />
    </Seccion>
  );
}
