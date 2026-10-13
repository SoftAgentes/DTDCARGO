/**
 * Aviso de mantenimiento programado (SDD-0505).
 *
 * Antes del corte al servidor propio, Sam decidió (2026-10-13) no mandar
 * mensajes a cada cliente: el Portal muestra un aviso arriba con el horario.
 * Se configura con dos variables de servidor, en ISO 8601 con zona:
 *
 *   MAINTENANCE_NOTICE_START=2026-10-14T02:00:00Z   (22:00 de Caracas)
 *   MAINTENANCE_NOTICE_END=2026-10-14T03:00:00Z     (23:00 de Caracas)
 *
 * · Sin las dos, con fechas inválidas o con el fin antes del inicio: no hay aviso.
 * · Antes del inicio: anuncia la ventana («Hoy martes 13 de octubre, de 10:00
 *   p. m. a 11:00 p. m.»).
 * · Dentro de la ventana: dice que el mantenimiento está en curso y hasta qué hora
 *   (normalmente el modo mantenimiento ya corta el Portal, pero si se apaga antes
 *   el aviso sigue siendo verdad).
 * · Desde el fin: desaparece solo, sin redeploy.
 *
 * La hora se muestra en la de Venezuela (UTC−4 fijo desde el 1 de mayo de 2016,
 * sin horario de verano). Se calcula con un desplazamiento fijo y nombres en
 * español propios para que el texto no dependa de la versión de ICU del runtime.
 *
 * Puro: recibe el `env` y el instante actual. El layout lo llama por request
 * (el Portal ya es dinámico porque lee cookies).
 */

export type EntornoAviso = Readonly<Record<string, string | undefined>>;

export type AvisoMantenimiento = {
  /** Antes de la ventana («programado») o dentro de ella («en_curso»). */
  fase: "programado" | "en_curso";
  titulo: string;
  texto: string;
};

const DESPLAZAMIENTO_VE_MS = -4 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function leerFecha(valor: string | undefined): Date | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  // Exige zona explícita: sin ella `Date` interpretaría la hora local del
  // servidor (UTC en Vercel y en el VPS) y el aviso diría otra hora.
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** La fecha y hora «de pared» en Venezuela, leída con los getters UTC. */
function enVenezuela(d: Date): Date {
  return new Date(d.getTime() + DESPLAZAMIENTO_VE_MS);
}

/** Número de día (desde la época) en el calendario de Venezuela. */
function diaVe(d: Date): number {
  return Math.floor(enVenezuela(d).getTime() / DIA_MS);
}

/** «10:00 p. m.», «12:30 a. m.» (medianoche y media), «12:00 p. m.» (mediodía). */
export function horaVe(d: Date): string {
  const ve = enVenezuela(d);
  const h24 = ve.getUTCHours();
  const min = String(ve.getUTCMinutes()).padStart(2, "0");
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${min} ${h24 < 12 ? "a. m." : "p. m."}`;
}

/** «martes 13 de octubre». */
export function fechaVe(d: Date): string {
  const ve = enVenezuela(d);
  return `${DIAS[ve.getUTCDay()]} ${ve.getUTCDate()} de ${MESES[ve.getUTCMonth()]}`;
}

/** «Hoy martes 13 de octubre» / «Mañana miércoles 14…» / «El jueves 15…». */
function cuandoVe(inicio: Date, ahora: Date): string {
  const diferencia = diaVe(inicio) - diaVe(ahora);
  const fecha = fechaVe(inicio);
  if (diferencia === 0) return `Hoy ${fecha}`;
  if (diferencia === 1) return `Mañana ${fecha}`;
  return `El ${fecha}`;
}

export function avisoDeMantenimiento(
  env: EntornoAviso = process.env,
  ahora: Date = new Date(),
): AvisoMantenimiento | null {
  const inicio = leerFecha(env.MAINTENANCE_NOTICE_START);
  const fin = leerFecha(env.MAINTENANCE_NOTICE_END);
  if (!inicio || !fin || fin.getTime() <= inicio.getTime()) return null;
  if (ahora.getTime() >= fin.getTime()) return null;

  if (ahora.getTime() >= inicio.getTime()) {
    return {
      fase: "en_curso",
      titulo: "Mantenimiento en curso",
      texto:
        `Estamos haciendo una mejora en nuestros servidores hasta las ${horaVe(fin)} ` +
        "(hora de Venezuela). Mientras tanto no se pueden guardar cambios: si algo no se " +
        "guardó, espera a que termine y repítelo. Tu usuario y tu contraseña siguen igual.",
    };
  }

  const mismoDia = diaVe(inicio) === diaVe(fin);
  const hasta = mismoDia ? horaVe(fin) : `${fechaVe(fin)}, ${horaVe(fin)}`;
  return {
    fase: "programado",
    titulo: "Mantenimiento programado",
    texto:
      `${cuandoVe(inicio, ahora)}, de ${horaVe(inicio)} a ${hasta} (hora de Venezuela), ` +
      "el portal estará en mantenimiento por una mejora en nuestros servidores. En ese rato " +
      "no se podrán guardar cambios. No tienes que hacer nada: tu usuario y tu contraseña " +
      "siguen igual.",
  };
}
