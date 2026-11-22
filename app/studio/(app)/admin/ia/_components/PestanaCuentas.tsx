/**
 * SDD-0704 §7.1 y §7.2 · Pestaña «Cuentas y tarifas»: cada cuenta con su tipo de cobro y cada modelo con su tarifa.
 *
 * El tipo de cobro lo declara Sam (el proveedor no lo dice). Por token suma dólares estimados; plan fijo no suma
 * dólares y cuenta llamadas, con su propio tope. Los modelos se eligen del catálogo: sumar uno nuevo es una migración
 * con el OK de Sam. Aquí no hay llaves.
 */
import { NOMBRE_DEL_PROVEEDOR, PROVEEDORES, esChino, type Proveedor } from "@/lib/studio/ia/catalogo";
import { type CuentaIa, type PantallaIa, cifra, entero } from "@/lib/studio/ia/pantalla";

import { guardarCuentaAction, guardarModeloAction, quitarModeloAction } from "../actions";
import { CampoMotivo } from "./CampoMotivo";

const texto = { font: "400 13px/1.5 var(--f-sans)", color: "var(--ink)" } as const;
const suave = { font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" } as const;
const bloque = { border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 16, marginBottom: 16, background: "var(--bg-surface)" } as const;
const rejilla = { display: "grid", gap: 10, maxWidth: 480 } as const;

const nombre = (p: string) => NOMBRE_DEL_PROVEEDOR[p as Proveedor] ?? p;

function FormularioCuenta({ cuenta, hayOficina }: { cuenta: CuentaIa | null; hayOficina: boolean }) {
  const pre = cuenta?.id ?? "nueva";
  return (
    <form action={guardarCuentaAction} style={rejilla}>
      {cuenta ? <input type="hidden" name="id" value={cuenta.id} /> : null}
      <label className="studio-label" htmlFor={`${pre}-alias`}>
        Nombre de la cuenta
      </label>
      <input id={`${pre}-alias`} name="alias" className="studio-input" required minLength={2} maxLength={60} defaultValue={cuenta?.alias ?? ""} autoComplete="off" />
      <label className="studio-label" htmlFor={`${pre}-proveedor`}>
        Proveedor
      </label>
      <select id={`${pre}-proveedor`} name="proveedor" className="studio-input" defaultValue={cuenta?.proveedor ?? "anthropic"}>
        {PROVEEDORES.map((p) => (
          <option key={p} value={p}>
            {nombre(p)}
            {esChino(p) ? " (no recibe datos de clientes)" : ""}
          </option>
        ))}
      </select>
      <label className="studio-label" htmlFor={`${pre}-uso`}>
        Para qué se usa
      </label>
      <select id={`${pre}-uso`} name="uso" className="studio-input" defaultValue={cuenta?.uso ?? (hayOficina ? "erp" : "oficina")}>
        <option value="oficina" disabled={hayOficina && cuenta?.uso !== "oficina"}>
          Oficina_Virtual{hayOficina && cuenta?.uso !== "oficina" ? " (ya tiene cuenta)" : ""}
        </option>
        <option value="erp">Funciones del ERP</option>
      </select>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 6 }}>
        <legend className="studio-label">Cómo cobra</legend>
        <label style={texto}>
          <input type="radio" name="tipo_cobro" value="por_token" defaultChecked={(cuenta?.tipoCobro ?? "por_token") === "por_token"} /> Por
          token: suma dólares estimados con la tarifa de cada modelo
        </label>
        <label style={texto}>
          <input type="radio" name="tipo_cobro" value="plan_fijo" defaultChecked={cuenta?.tipoCobro === "plan_fijo"} /> Plan fijo o
          membresía: no suma dólares; cuenta llamadas y tokens
        </label>
      </fieldset>
      <label className="studio-label" htmlFor={`${pre}-tope`}>
        Tope de llamadas al mes
      </label>
      <input
        id={`${pre}-tope`}
        name="tope_llamadas"
        className="studio-input"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={cuenta?.topeLlamadasMes != null ? String(cuenta.topeLlamadasMes) : ""}
        aria-describedby={`${pre}-tope-ayuda`}
      />
      <p id={`${pre}-tope-ayuda`} style={{ ...suave, margin: 0 }}>
        Obligatorio en un plan fijo. Al llegar al 80 % de las llamadas, la Oficina se pausa sola.
      </p>
      <CampoMotivo id={`${pre}-motivo`} />
      <p style={{ ...suave, margin: 0 }}>
        Pasar a plan fijo y subir o quitar el tope de llamadas permiten gastar más: piden la verificación en dos pasos.
      </p>
      <div>
        <button type="submit" className="studio-btn studio-btn-primary studio-btn-sm">
          {cuenta ? "Guardar la cuenta" : "Crear la cuenta"}
        </button>
      </div>
    </form>
  );
}

export function PestanaCuentas({ datos }: { datos: PantallaIa }) {
  const hayOficina = datos.cuentas.some((c) => c.uso === "oficina");
  return (
    <section aria-labelledby="ia-cuentas-titulo">
      <h2 id="ia-cuentas-titulo" className="studio-display" style={{ fontSize: 20, margin: "0 0 4px", color: "var(--ink)" }}>
        Cuentas y tarifas
      </h2>
      <p style={{ ...suave, margin: "0 0 16px", maxWidth: "76ch" }}>
        El sistema no sabe solo si una cuenta cobra por token o por membresía: lo dices tú aquí. La tarifa va en USD por
        millón de tokens, con la coma decimal. Sumar un modelo que no está en la lista es una migración con tu OK.
      </p>

      {datos.cuentas.length === 0 ? <p style={{ ...texto, margin: "0 0 16px" }}>Todavía no hay cuentas.</p> : null}

      {datos.cuentas.map((c) => {
        const modelos = datos.modelos.filter((m) => m.cuentaId === c.id);
        const libres = datos.catalogo.filter((m) => m.proveedor === c.proveedor);
        const planFijo = c.tipoCobro === "plan_fijo";
        return (
          <article key={c.id} style={bloque} aria-labelledby={`cuenta-${c.id}`}>
            <h3 id={`cuenta-${c.id}`} style={{ ...texto, fontWeight: 700, margin: "0 0 4px" }}>
              {c.alias}
            </h3>
            <p style={{ ...suave, margin: "0 0 12px" }}>
              {nombre(c.proveedor)} · {c.uso === "oficina" ? "Oficina_Virtual" : "Funciones del ERP"} ·{" "}
              {planFijo ? `Plan fijo, tope de ${entero(c.topeLlamadasMes ?? 0)} llamadas al mes` : "Por token"}
            </p>

            <table style={{ width: "100%", borderCollapse: "collapse", ...texto, marginBottom: 12 }}>
              <caption style={{ ...suave, textAlign: "left", marginBottom: 6 }}>Modelos de la cuenta</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>Modelo</th>
                  <th scope="col" style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>Entrada (USD/M)</th>
                  <th scope="col" style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>Salida (USD/M)</th>
                  <th scope="col" style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {modelos.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "6px 8px", color: "var(--ink-soft)" }}>
                      Sin modelos. {planFijo ? "" : "Mientras no haya tarifas, el costo sale de las variables de entorno."}
                    </td>
                  </tr>
                ) : (
                  modelos.map((m) => (
                    <tr key={m.id}>
                      <td style={{ padding: "6px 8px", fontFamily: "var(--f-mono)" }}>{m.modelo}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{m.entrada != null ? cifra(m.entrada) : "—"}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{m.salida != null ? cifra(m.salida) : "—"}</td>
                      <td style={{ padding: "6px 8px" }}>
                        <details>
                          <summary className="studio-btn studio-btn-ghost studio-btn-xs">Quitar</summary>
                          <form action={quitarModeloAction} style={{ ...rejilla, marginTop: 8 }}>
                            <input type="hidden" name="id" value={m.id} />
                            <CampoMotivo id={`quitar-${m.id}`} />
                            <div>
                              <button type="submit" className="studio-btn studio-btn-danger studio-btn-xs">
                                Quitar {m.modelo}
                              </button>
                            </div>
                          </form>
                        </details>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <details>
              <summary className="studio-btn studio-btn-ghost studio-btn-sm">{planFijo ? "Sumar un modelo" : "Poner o cambiar una tarifa"}</summary>
              <form action={guardarModeloAction} style={{ ...rejilla, marginTop: 10 }}>
                <input type="hidden" name="cuenta" value={c.id} />
                {planFijo ? <input type="hidden" name="plan_fijo" value="1" /> : null}
                <label className="studio-label" htmlFor={`${c.id}-modelo`}>
                  Modelo
                </label>
                <select id={`${c.id}-modelo`} name="modelo" className="studio-input" required>
                  {libres.map((m) => (
                    <option key={m.modelo} value={m.modelo}>
                      {m.modelo}
                    </option>
                  ))}
                </select>
                {planFijo ? null : (
                  <>
                    <label className="studio-label" htmlFor={`${c.id}-entrada`}>
                      Tarifa de entrada (USD por millón de tokens)
                    </label>
                    <input id={`${c.id}-entrada`} name="entrada" className="studio-input" inputMode="decimal" required autoComplete="off" />
                    <label className="studio-label" htmlFor={`${c.id}-salida`}>
                      Tarifa de salida (USD por millón de tokens)
                    </label>
                    <input id={`${c.id}-salida`} name="salida" className="studio-input" inputMode="decimal" required autoComplete="off" />
                    <p style={{ ...suave, margin: 0 }}>
                      Subir una tarifa lo puedes hacer ya. Bajarla, poner la primera de la cuenta o sumar un modelo más
                      barato que el más caro que ya está piden la verificación en dos pasos.
                    </p>
                  </>
                )}
                <CampoMotivo id={`${c.id}-modelo-motivo`} />
                <div>
                  <button type="submit" className="studio-btn studio-btn-primary studio-btn-sm">
                    Guardar el modelo
                  </button>
                </div>
              </form>
            </details>

            <details style={{ marginTop: 10 }}>
              <summary className="studio-btn studio-btn-ghost studio-btn-sm">Editar la cuenta</summary>
              <div style={{ marginTop: 10 }}>
                <FormularioCuenta cuenta={c} hayOficina={hayOficina} />
              </div>
            </details>
          </article>
        );
      })}

      <details open={datos.cuentas.length === 0} style={bloque}>
        <summary style={{ ...texto, fontWeight: 700, cursor: "pointer" }}>Nueva cuenta</summary>
        <div style={{ marginTop: 12 }}>
          <FormularioCuenta cuenta={null} hayOficina={hayOficina} />
        </div>
      </details>
    </section>
  );
}
