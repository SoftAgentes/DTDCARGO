/**
 * Proyección y ruta del mapa de Tracking (SDD-0659). PURO: sin DOM ni librerías.
 *
 * El mapa va centrado en el Pacífico, como se dibuja en China: China a la
 * izquierda, Venezuela a la derecha, y la ruta se lee de izquierda a derecha.
 *
 * La proyección es Natural Earth I con rotación de 165° en longitud. Las tres
 * constantes de encuadre (`K`, `TX`, `TY`) son las que imprimió el generador del
 * contorno (`docs/specs/0659-tracking-por-contenedor/assets/generar-contorno.mjs`)
 * para un lienzo de 900 × 380: si el contorno se regenera con otro encuadre,
 * cambian juntas. La prueba `proyeccion.test.ts` fija dos puntos conocidos.
 */

export const MAPA_ANCHO = 900;
export const MAPA_ALTO = 380;

const K = 285.57564394132066;
const TX = 411.0576923076923;
const TY = 299.72502192430386;
const ROTACION = 165;

export type Punto = readonly [number, number];

/** Longitud y latitud en grados → coordenadas del lienzo. */
export function proyectar(lon: number, lat: number): Punto {
  let l = lon + ROTACION;
  l = ((((l + 180) % 360) + 360) % 360) - 180;
  const lambda = (l * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const phi2 = phi * phi;
  const phi4 = phi2 * phi2;
  const x =
    lambda *
    (0.8707 -
      0.131979 * phi2 +
      phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4)));
  const y =
    phi *
    (1.007226 +
      phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4)));
  return [TX + K * x, TY - K * y];
}

/** Lugares que el mapa rotula. */
export const LUGARES = {
  yiwu: [120.07, 29.3],
  ningbo: [121.85, 29.9],
  panama: [-79.6, 9.1],
  laGuaira: [-66.94, 10.6],
} as const satisfies Record<string, Punto>;

/**
 * Ruta de referencia Yiwu → Ningbo → Pacífico → Canal de Panamá → La Guaira,
 * en [longitud, latitud]. Es un trazo ilustrativo, no la derrota de un buque.
 */
const RUTA: readonly Punto[] = [
  LUGARES.yiwu,
  LUGARES.ningbo,
  [124.5, 30.3],
  [136, 31.5],
  [160, 34],
  [-175, 33],
  [-145, 26],
  [-115, 15],
  [-90, 6.5],
  [-80.2, 6.3],
  [-79.45, 8.7],
  [-79.9, 9.5],
  [-77.5, 11.3],
  [-73.5, 12.9],
  [-70.5, 13],
  [-68, 11.9],
  LUGARES.laGuaira,
];

const MUESTRAS_POR_TRAMO = 12;

function catmullRom(p0: Punto, p1: Punto, p2: Punto, p3: Punto, t: number): Punto {
  const t2 = t * t;
  const t3 = t2 * t;
  const eje = (i: 0 | 1) =>
    0.5 *
    (2 * p1[i] +
      (-p0[i] + p2[i]) * t +
      (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
      (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
  return [eje(0), eje(1)];
}

type RutaCalculada = {
  puntos: Punto[];
  /** Distancia acumulada hasta cada punto, en unidades del lienzo. */
  acumulado: number[];
  largo: number;
  /** Fracción del largo en la que queda el puerto de salida (Ningbo). */
  fraccionPuertoOrigen: number;
};

function calcularRuta(): RutaCalculada {
  const nodos = RUTA.map(([lon, lat]) => proyectar(lon, lat));
  const puntos: Punto[] = [nodos[0]];
  let indicePuerto = 0;
  for (let i = 0; i < nodos.length - 1; i++) {
    const p0 = nodos[Math.max(0, i - 1)];
    const p1 = nodos[i];
    const p2 = nodos[i + 1];
    const p3 = nodos[Math.min(nodos.length - 1, i + 2)];
    for (let s = 1; s <= MUESTRAS_POR_TRAMO; s++) {
      puntos.push(catmullRom(p0, p1, p2, p3, s / MUESTRAS_POR_TRAMO));
    }
    // El nodo 1 de la ruta es Ningbo: queda al final del primer tramo.
    if (i === 0) indicePuerto = puntos.length - 1;
  }
  const acumulado = [0];
  for (let i = 1; i < puntos.length; i++) {
    acumulado.push(
      acumulado[i - 1] +
        Math.hypot(puntos[i][0] - puntos[i - 1][0], puntos[i][1] - puntos[i - 1][1]),
    );
  }
  const largo = acumulado[acumulado.length - 1];
  return {
    puntos,
    acumulado,
    largo,
    fraccionPuertoOrigen: acumulado[indicePuerto] / largo,
  };
}

const R = calcularRuta();

const limitar = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** Punto del lienzo a una fracción (0 a 1) del largo de la ruta. */
export function puntoEnRuta(fraccion: number): Punto {
  const meta = limitar(fraccion) * R.largo;
  let i = 1;
  while (i < R.acumulado.length - 1 && R.acumulado[i] < meta) i++;
  const tramo = R.acumulado[i] - R.acumulado[i - 1];
  const t = tramo === 0 ? 0 : (meta - R.acumulado[i - 1]) / tramo;
  const a = R.puntos[i - 1];
  const b = R.puntos[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Avance del tramo de mar (0 = zarpe de Ningbo, 1 = arribo a La Guaira) →
 * fracción del largo total de la ruta.
 */
export function fraccionDeMar(avance: number): number {
  return R.fraccionPuertoOrigen + limitar(avance) * (1 - R.fraccionPuertoOrigen);
}

/** Fracción de la ruta más cercana a una posición real (longitud, latitud). */
export function fraccionMasCercana(lon: number, lat: number): number {
  const [x, y] = proyectar(lon, lat);
  let mejor = 0;
  let distancia = Infinity;
  for (let i = 0; i < R.puntos.length; i++) {
    const d = Math.hypot(R.puntos[i][0] - x, R.puntos[i][1] - y);
    if (d < distancia) {
      distancia = d;
      mejor = i;
    }
  }
  return R.acumulado[mejor] / R.largo;
}

/** `d` del `<path>` de la ruta, de 0 hasta `hasta` (1 = completa). */
export function trazoDeRuta(hasta = 1): string {
  const tope = limitar(hasta);
  if (tope === 0) return "";
  const meta = tope * R.largo;
  const partes: string[] = [];
  for (let i = 0; i < R.puntos.length; i++) {
    if (R.acumulado[i] > meta) break;
    partes.push(`${i === 0 ? "M" : "L"}${fmt(R.puntos[i][0])},${fmt(R.puntos[i][1])}`);
  }
  if (tope < 1) {
    const [x, y] = puntoEnRuta(tope);
    partes.push(`L${fmt(x)},${fmt(y)}`);
  }
  return partes.join("");
}

/** ¿El punto cae dentro del lienzo? Una posición real puede quedar fuera. */
export function dentroDelLienzo([x, y]: Punto): boolean {
  return x >= 0 && x <= MAPA_ANCHO && y >= 0 && y <= MAPA_ALTO;
}
