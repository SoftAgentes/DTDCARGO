/**
 * SDD-0704 §2.3 · Pestaña «Funciones»: la cadena de hasta tres modelos de A1 y A2, con el último salto de cada una.
 *
 * Cada llamada nueva empieza por el 1.º; si el proveedor no responde o la cuenta falla, salta al siguiente (§4.1).
 * La marca de datos va en texto junto al nombre y explica por qué faltan opciones. Los estados van con texto, nunca
 * solo color (BRAND §Estados). La Oficina se elige aquí en la fase 1b, cuando Ofi_Hermes conecte los alias.
 */
import { MARCA_DE_LA_FUNCION } from "@/lib/studio/ia/catalogo";

import { guardarCadenaAction } from "../actions";
import {
  type DatosFunciones,
  FUNCIONES_EDITABLES,
  MODELO_POR_DEFECTO,
  descripcionDelResultado,
  modelosOfrecidos,
} from "../funciones";
import { BotonEnviar } from "./BotonEnviar";
import { CampoMotivo } from "./CampoMotivo";

const texto = { font: "400 13px/1.5 var(--f-sans)", color: "var(--ink)" } as const;
const suave = { font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" } as const;
const ORDINAL = ["1.º", "2.º", "3.º"] as const;

function fecha(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeStyle: "short", timeZone: "America/Caracas" }).format(d);
}

export function PestanaFunciones({ datos }: { datos: DatosFunciones }) {
  return (
    <section aria-labelledby="ia-funciones-titulo">
      <h2 id="ia-funciones-titulo" className="studio-display" style={{ fontSize: 20, margin: "0 0 4px", color: "var(--ink)" }}>
        Modelo de cada función
      </h2>
      <p style={{ ...suave, margin: "0 0 16px", maxWidth: "76ch" }}>
        Cada llamada empieza por el 1.º. Si el proveedor no responde o la cuenta falla (saldo, llave), pasa al 2.º y luego
        al 3.º. Un error de la propia función (una entrada mala, un límite de ritmo) no salta: sigue su salida de siempre.
        En esta fase la cadena usa modelos de Anthropic. La Oficina se elige aquí cuando Ofi_Hermes la conecte.
      </p>

      {FUNCIONES_EDITABLES.map((f) => {
        const cadena = datos.cadenas[f.clave];
        const ofrecidos = modelosOfrecidos(f.clave);
        const salto = datos.ultimoSalto[f.clave];
        const conDatos = MARCA_DE_LA_FUNCION[f.clave] === "con_datos";
        return (
          <form
            key={f.clave}
            action={guardarCadenaAction}
            aria-labelledby={`ia-fn-${f.clave}`}
            style={{ display: "grid", gap: 10, maxWidth: 560, padding: "12px 0 16px", borderTop: "1px solid var(--border)" }}
          >
            <input type="hidden" name="funcion" value={f.clave} />
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
              <h3 id={`ia-fn-${f.clave}`} style={{ ...texto, fontWeight: 700, margin: 0 }}>
                {f.nombre}
              </h3>
              <span style={suave}>{conDatos ? "Con datos de clientes · solo no chinos" : "Sin datos de clientes"}</span>
            </div>
            <p style={{ ...suave, margin: 0 }}>
              {f.descripcion}{" "}
              {cadena.length === 0 ? `Sin cadena guardada: usa ${MODELO_POR_DEFECTO[f.clave]}.` : null}
            </p>

            {ORDINAL.map((ordinal, i) => {
              const actual = cadena[i];
              const id = `ia-fn-${f.clave}-${i + 1}`;
              return (
                <div key={ordinal} style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", alignItems: "center", gap: 8 }}>
                  <label className="studio-label" htmlFor={id} style={{ margin: 0 }}>
                    {ordinal}
                  </label>
                  <select
                    id={id}
                    name={`puesto_${i + 1}`}
                    className="studio-input"
                    required={i === 0}
                    defaultValue={actual ? `${actual.proveedor}/${actual.modelo}` : i === 0 ? `anthropic/${MODELO_POR_DEFECTO[f.clave]}` : ""}
                  >
                    {i === 0 ? null : <option value="">— vacío —</option>}
                    {ofrecidos.map((o) => (
                      <option key={o.modelo} value={`${o.proveedor}/${o.modelo}`}>
                        {o.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            <p style={{ ...texto, margin: 0 }}>
              <strong>Último salto:</strong>{" "}
              {salto
                ? `${fecha(salto.ts)} · el ${ORDINAL[salto.puesto - 1] ?? `${salto.puesto}.º`} (${salto.modelo}) falló: ${descripcionDelResultado(salto.resultado)}.`
                : "ninguno registrado."}
            </p>

            <CampoMotivo id={`ia-fn-${f.clave}-motivo`} />
            <div>
              <BotonEnviar variante="primary" tamano="sm">
                Guardar cadena
              </BotonEnviar>
            </div>
          </form>
        );
      })}
    </section>
  );
}
