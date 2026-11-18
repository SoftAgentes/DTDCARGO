/**
 * MapaPacifico — mapamundi del Tracking centrado en el Pacífico (SDD-0659).
 *
 * China a la izquierda, Venezuela a la derecha: la ruta se lee de izquierda a
 * derecha, como se dibuja en China. Es un SVG del servidor, sin librería de
 * mapas: el contorno ya viene proyectado (`lib/studio/tracking-mapa`).
 *
 * Cada marcador puede ser un enlace (elegir otro contenedor); por eso el SVG es
 * un grupo con nombre y no una imagen: dentro de una imagen los enlaces no
 * existen para un lector de pantalla. Los colores salen
 * de las clases `.studio-tracking-ops-map-*` de `studio.css`.
 */

import Link from "next/link";
import { CONTORNO_TIERRA } from "@/lib/studio/tracking-mapa/contorno";
import {
  LUGARES,
  MAPA_ALTO,
  MAPA_ANCHO,
  dentroDelLienzo,
  fraccionDeMar,
  fraccionMasCercana,
  proyectar,
  puntoEnRuta,
  trazoDeRuta,
  type Punto,
} from "@/lib/studio/tracking-mapa/proyeccion";
import type {
  GrupoContenedor,
  PosicionContenedor,
} from "@/lib/studio/tracking-contenedores";

export type MarcadorDelMapa = {
  id: string;
  etiqueta: string;
  /** Texto para lectores de pantalla y `title`. */
  titulo: string;
  /** Fracción del largo de la ruta (0 = Yiwu, 1 = La Guaira). */
  fraccion: number;
  /** Punto exacto si hay posición real dentro del lienzo; si no, va sobre la ruta. */
  punto: Punto;
  activo: boolean;
  alerta?: boolean;
  href?: string;
};

/** Convierte la posición de un contenedor en fracción de ruta y punto del lienzo. */
export function ubicarEnMapa(
  grupo: GrupoContenedor,
  posicion: PosicionContenedor,
): { fraccion: number; punto: Punto } {
  if (grupo === "origen") return { fraccion: 0, punto: puntoEnRuta(0) };
  if (grupo !== "mar") return { fraccion: 1, punto: puntoEnRuta(1) };
  if (posicion.fuente === "naviera" && posicion.lon !== null && posicion.lat !== null) {
    const fraccion = fraccionMasCercana(posicion.lon, posicion.lat);
    const real = proyectar(posicion.lon, posicion.lat);
    return { fraccion, punto: dentroDelLienzo(real) ? real : puntoEnRuta(fraccion) };
  }
  const fraccion = fraccionDeMar(posicion.avanceDeMar);
  return { fraccion, punto: puntoEnRuta(fraccion) };
}

type Props = {
  marcadores: MarcadorDelMapa[];
  /** Texto alternativo del mapa completo. */
  descripcion: string;
};

function Rotulo({
  en,
  dx = 0,
  dy = 0,
  ancla = "middle",
  clase,
  children,
}: {
  en: Punto;
  dx?: number;
  dy?: number;
  ancla?: "start" | "middle" | "end";
  clase: string;
  children: string;
}) {
  const [x, y] = proyectar(en[0], en[1]);
  return (
    <text x={x + dx} y={y + dy} textAnchor={ancla} className={clase}>
      {children}
    </text>
  );
}

function Puerto({ en }: { en: Punto }) {
  const [x, y] = proyectar(en[0], en[1]);
  return <circle cx={x} cy={y} r={4} className="studio-tracking-ops-map-port" />;
}

export function MapaPacifico({ marcadores, descripcion }: Props) {
  const activo = marcadores.find((m) => m.activo) ?? null;
  // El activo se pinta al final para que quede encima de los demás.
  const orden = [...marcadores].sort((a, b) => Number(a.activo) - Number(b.activo));

  return (
    <svg
      viewBox={`0 0 ${MAPA_ANCHO} ${MAPA_ALTO}`}
      className="studio-tracking-ops-map"
      role="group"
      aria-label={descripcion}
    >
      <rect width={MAPA_ANCHO} height={MAPA_ALTO} className="studio-tracking-ops-map-sea" />
      <path d={CONTORNO_TIERRA} className="studio-tracking-ops-map-land" />

      <Rotulo en={[104, 36]} clase="studio-tracking-ops-map-geo">CHINA</Rotulo>
      <Rotulo en={[-100, 40]} clase="studio-tracking-ops-map-geo">NORTEAMÉRICA</Rotulo>
      <Rotulo en={[-58, -2]} clase="studio-tracking-ops-map-geo">SURAMÉRICA</Rotulo>
      <Rotulo en={[-165, 14]} clase="studio-tracking-ops-map-ocean">OCÉANO PACÍFICO</Rotulo>

      <path d={trazoDeRuta(1)} className="studio-tracking-ops-map-route" />
      {activo && activo.fraccion > 0 && (
        <path d={trazoDeRuta(activo.fraccion)} className="studio-tracking-ops-map-done" />
      )}

      <Puerto en={LUGARES.ningbo} />
      <Puerto en={LUGARES.panama} />
      <Puerto en={LUGARES.laGuaira} />
      <Rotulo en={LUGARES.ningbo} dx={-10} dy={-12} ancla="end" clase="studio-tracking-ops-map-place">
        Yiwu · Ningbo
      </Rotulo>
      <Rotulo en={LUGARES.panama} dx={-8} dy={22} ancla="end" clase="studio-tracking-ops-map-place-soft">
        Canal de Panamá
      </Rotulo>
      <Rotulo en={LUGARES.laGuaira} dx={10} dy={-10} ancla="start" clase="studio-tracking-ops-map-place">
        La Guaira
      </Rotulo>

      {orden.map((m) => {
        const enExtremo = m.fraccion === 0 || m.fraccion === 1;
        const cuerpo = (
          <g
            transform={`translate(${m.punto[0].toFixed(1)},${m.punto[1].toFixed(1)})`}
            className="studio-tracking-ops-map-marker"
            data-activo={m.activo ? "true" : "false"}
            data-alerta={m.alerta ? "true" : "false"}
          >
            <title>{m.titulo}</title>
            <circle r={m.activo ? 15 : 10} className="studio-tracking-ops-map-halo" />
            <circle r={m.activo ? 7 : 5} className="studio-tracking-ops-map-core" />
            <text
              y={enExtremo ? 30 : -17}
              textAnchor="middle"
              className="studio-tracking-ops-map-label"
            >
              {m.etiqueta}
            </text>
          </g>
        );
        return m.href && !m.activo ? (
          <Link key={m.id} href={m.href} aria-label={m.titulo} scroll={false}>
            {cuerpo}
          </Link>
        ) : (
          <g key={m.id}>{cuerpo}</g>
        );
      })}
    </svg>
  );
}
