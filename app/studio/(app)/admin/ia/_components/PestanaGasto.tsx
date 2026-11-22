/**
 * SDD-0704 §7.4 · Pestaña «Gasto»: el gasto del mes de la Oficina por modelo, el tope efectivo y su barra.
 *
 * La barra pasa a atención (dorado) desde el 60 % y a error (rojo) desde el 80 %, el umbral en que la base pausa la
 * Oficina; siempre con texto, nunca solo color (BRAND §Estados). Las cifras van en tinta y con coma decimal.
 */
import type { CostoAplicado } from "@/lib/studio/ia/costo";
import { type PantallaIa, cifra, entero } from "@/lib/studio/ia/pantalla";

import { quitarTopeAction, guardarTopeAction } from "../actions";
import { CampoMotivo } from "./CampoMotivo";

const texto = { font: "400 13px/1.5 var(--f-sans)", color: "var(--ink)" } as const;
const suave = { font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" } as const;
const celda = { padding: "8px 10px", borderBottom: "1px solid var(--border)", textAlign: "right" as const, fontVariantNumeric: "tabular-nums" };
const celdaIzq = { ...celda, textAlign: "left" as const };

export function PestanaGasto({ datos, costo, techoUsd }: { datos: PantallaIa; costo: CostoAplicado; techoUsd: number }) {
  const filas = datos.gasto.filter((g) => g.funcion === "oficina");
  const total = filas.reduce(
    (a, g) => ({ llamadas: a.llamadas + g.llamadas, entrada: a.entrada + g.tokensEntrada, salida: a.salida + g.tokensSalida, usd: a.usd + g.costoUsd }),
    { llamadas: 0, entrada: 0, salida: 0, usd: 0 },
  );
  const cuenta = datos.cuentas.find((c) => c.uso === "oficina") ?? null;
  const planFijo = costo.topeLlamadasMes !== null;
  const usado = planFijo ? total.llamadas : total.usd;
  const tope = planFijo ? (costo.topeLlamadasMes as number) : costo.topeMensualUsd;
  const pct = tope > 0 ? Math.min(Math.round((usado / tope) * 100), 999) : 0;
  const tono = pct >= 80 ? "error" : pct >= 60 ? "atencion" : "normal";
  const colorBarra = tono === "error" ? "var(--danger)" : tono === "atencion" ? "var(--warning)" : "var(--ink-soft)";

  return (
    <section aria-labelledby="ia-gasto-titulo">
      <h2 id="ia-gasto-titulo" className="studio-display" style={{ fontSize: 20, margin: "0 0 4px", color: "var(--ink)" }}>
        Oficina_Virtual · {new Intl.DateTimeFormat("es-VE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date())} (UTC)
      </h2>
      <p style={{ ...suave, margin: "0 0 12px" }}>
        {cuenta
          ? `Cuenta «${cuenta.alias}» · ${planFijo ? "plan fijo: no suma dólares, cuenta llamadas" : "por token: suma dólares estimados"}.`
          : "Sin cuenta de la Oficina en «Cuentas y tarifas»: la tarifa sale de las variables de entorno."}
      </p>

      <div style={{ overflowX: "auto", marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", ...texto }}>
          <caption style={{ ...suave, textAlign: "left", marginBottom: 6 }}>Llamadas del mes por modelo</caption>
          <thead>
            <tr>
              <th scope="col" style={celdaIzq}>Modelo</th>
              <th scope="col" style={celda}>Llamadas</th>
              <th scope="col" style={celda}>Tokens de entrada</th>
              <th scope="col" style={celda}>Tokens de salida</th>
              <th scope="col" style={celda}>USD est.</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...celdaIzq, color: "var(--ink-soft)" }}>
                  Todavía no hay llamadas este mes.
                </td>
              </tr>
            ) : (
              filas.map((g) => (
                <tr key={g.modelo}>
                  <td style={{ ...celdaIzq, fontFamily: "var(--f-mono)" }}>{g.modelo}</td>
                  <td style={celda}>{entero(g.llamadas)}</td>
                  <td style={celda}>{entero(g.tokensEntrada)}</td>
                  <td style={celda}>{entero(g.tokensSalida)}</td>
                  <td style={celda}>{planFijo ? "—" : cifra(g.costoUsd)}</td>
                </tr>
              ))
            )}
          </tbody>
          {filas.length > 1 ? (
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <th scope="row" style={celdaIzq}>Total</th>
                <td style={celda}>{entero(total.llamadas)}</td>
                <td style={celda}>{entero(total.entrada)}</td>
                <td style={celda}>{entero(total.salida)}</td>
                <td style={celda}>{planFijo ? "—" : cifra(total.usd)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <p style={{ ...suave, margin: "0 0 16px" }}>
        Los tokens por llamada se cuentan desde que se aplicó la migración 0570; las llamadas anteriores salen con 0 tokens.
      </p>

      <div style={{ margin: "0 0 20px" }}>
        <p style={{ ...texto, margin: "0 0 6px" }}>
          <strong>
            {planFijo
              ? `Tope: ${entero(tope)} llamadas al mes`
              : `Tope: ${cifra(tope)} USD al mes`}
          </strong>{" "}
          <span style={suave}>
            ({planFijo ? "de la cuenta de plan fijo" : costo.origenTope === "pantalla" ? "puesto en esta pantalla" : "de las variables de entorno"}; máximo {cifra(techoUsd)} USD)
          </span>
        </p>
        <div
          role="progressbar"
          aria-label="Uso del tope del mes"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(pct, 100)}
          aria-valuetext={`${pct} % del tope`}
          style={{ height: 8, maxWidth: 420, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}
        >
          <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: colorBarra }} />
        </div>
        <p style={{ ...texto, margin: "6px 0 0" }}>
          {pct} % usado.{" "}
          {tono === "error"
            ? "Llegó al 80 %: la Oficina se pausa sola y para despausarla hay que hacerlo a mano en su revisión."
            : tono === "atencion"
              ? "Pasó el 60 %: al llegar al 80 % la Oficina se pausa sola."
              : "Al llegar al 80 % la Oficina se pausa sola."}
        </p>
      </div>

      <form action={guardarTopeAction} style={{ display: "grid", gap: 10, maxWidth: 420, marginBottom: 16 }}>
        <h3 style={{ ...texto, fontWeight: 700, margin: 0 }}>Cambiar el tope en USD</h3>
        <label className="studio-label" htmlFor="ia-tope">
          Tope del mes (USD)
        </label>
        <input
          id="ia-tope"
          name="tope"
          className="studio-input"
          inputMode="decimal"
          autoComplete="off"
          required
          defaultValue={costo.origenTope === "pantalla" ? cifra(costo.topeMensualUsd) : ""}
          placeholder={cifra(costo.topeMensualUsd)}
          aria-describedby="ia-tope-ayuda"
        />
        <p id="ia-tope-ayuda" style={{ ...suave, margin: 0 }}>
          Usa la coma para los decimales. Bajarlo lo puedes hacer ya. Subirlo (o ponerlo por primera vez) pide la
          verificación en dos pasos.
        </p>
        <CampoMotivo id="ia-tope-motivo" />
        <div>
          <button type="submit" className="studio-btn studio-btn-primary studio-btn-sm">
            Guardar tope
          </button>
        </div>
      </form>

      {costo.origenTope === "pantalla" ? (
        <form action={quitarTopeAction} style={{ display: "grid", gap: 10, maxWidth: 420 }}>
          <h3 style={{ ...texto, fontWeight: 700, margin: 0 }}>Volver al tope de las variables de entorno</h3>
          <CampoMotivo id="ia-quitar-motivo" />
          <div>
            <button type="submit" className="studio-btn studio-btn-ghost studio-btn-sm">
              Quitar el tope de la pantalla
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
