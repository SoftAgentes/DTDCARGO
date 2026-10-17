import type { ReactNode } from "react";
import Link from "next/link";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ChipF2 } from "@/components/servicios/ChipF2";
import { ConGlosario, TerminoEnlace } from "@/components/TerminoGlosario";
import { svcHref } from "@/components/servicios/svcHref";
import { TRACKING_EN_CONSTRUCCION } from "@/lib/portal/tracking-en-construccion";
import {
  FichaF2,
  SecF2,
  StepsF2,
  BenesF2,
  RulesF2,
  PriceF2,
  XrefF2,
  VersusF2,
  VscardF2,
  RepmockF2,
  CtaF2,
} from "@/components/servicios/FichaF2";

/**
 * Fichas secundarias del hub /servicios (hub-and-spoke por hash `#svc/<slug>`).
 * Copy transcrito EXACTO del mockup Cloud Design (Servicios · DTD-Cargo.html).
 * Cada objeto = { slug (= data-svc del mockup), node (la ficha renderizada) }.
 * Los 4 servicios con ruta real propia (puerta-a-puerta, lcl, fcl, inspección)
 * NO están acá; los "Próximamente" tampoco (van deshabilitados en la portada).
 */

const CTA = (msg: string) => buildWhatsAppLink(msg);

/**
 * Link a otra ficha. Ruta real → <Link> (soft-nav). Enlace del hub
 * (`/servicios#svc/...`) → <a> nativo: el ancla dispara `hashchange` (Next
 * <Link> con hash usa pushState y NO lo dispara), y desde otra ruta real
 * navega al hub y abre la ficha por hash.
 */
function SvcLink({ slug, children }: { slug: string; children: ReactNode }) {
  const href = svcHref(slug);
  return href.includes("#svc/") ? (
    <a href={href}>{children}</a>
  ) : (
    <Link href={href}>{children}</Link>
  );
}

// ── Iconos inline (trazados exactos del mockup) ──────────────────────
function Ic({ d, sw = 2, extra }: { d: string; sw?: number; extra?: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
      {extra}
    </svg>
  );
}
function ArrowSm() {
  return <Ic d="M5 12h14M13 6l6 6-6 6" sw={2.4} />;
}
function BoxIc() {
  return <Ic d="M4 8l8-4 8 4-8 4-8-4zM4 8v8l8 4 8-4V8" sw={2} />;
}
function BoxSplitIc() {
  return <Ic d="M4 8l8-4 8 4-8 4-8-4zM4 8v8l8 4 8-4V8M12 12v8" sw={2} />;
}
function FactoryIc() {
  return <Ic d="M3 21V9l6 4V9l6 4V5l6-2v18z" sw={2} />;
}
function DocIc() {
  return <Ic d="M6 3h9l4 4v14H6z" sw={2} extra={<path d="M15 3v4h4M9.5 12h6M9.5 15.5h4" />} />;
}
function ShieldCheckIc() {
  return (
    <Ic
      d="M12 3l7 3v5c0 4.4-3 8.2-7 9.5C8 19.2 5 15.4 5 11V6z"
      sw={2}
      extra={<path d="M9.2 11.8l2 2 3.6-4" />}
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// 02 · Recepción en bodega (capa-llegada)
// ════════════════════════════════════════════════════════════════════

function Validacion() {
  return (
    <FichaF2
      capa="llegada"
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Se pide en tu pre-alerta</ChipF2>
          <ChipF2>Activo</ChipF2>
        </>
      }
      hook="Confirma que llegó todo lo que pagaste."
      sub={
        <>
          Contamos tu mercancía contra tu factura apenas llega a nuestra bodega y{" "}
          <b>te enviamos la prueba</b>.
        </>
      }
      seal={{ top: "CONTEO + FOTOS", sub: "contra tu factura" }}
      route={{
        stops: [
          { lb: "Llega a Yiwu", sb: "abrimos tu carga" },
          { lb: "Contamos", sb: "cajas y piezas" },
          { lb: "Comparamos", sb: "vs. tu factura" },
          { lb: "Te llega", sb: "verificación + fotos" },
        ],
        segs: [true, true, true],
        cap: [<b key="a">Antes de que embarque</b>, "aún puedes reclamarle al proveedor"],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          Cuando tu compra llega a la bodega en China, la <b>abrimos y contamos</b>{" "}
          contra tu factura o packing list, y te enviamos la{" "}
          <b>verificación con fotos</b>. Así sabes, antes de que embarque, que el
          proveedor te envió lo correcto.
        </p>
        <VersusF2>
          <VscardF2
            hero
            icon={<Ic d="M4 6h2.5M4 12h2.5M4 18h2.5M10 6h10M10 12h10M10 18h6" sw={2.2} />}
            title="Validación = CONTEO"
          >
            ¿Llegó <b>cuánto</b> compraste? Cajas y piezas contra tu factura, con
            fotos. <b>Esta ficha.</b>
          </VscardF2>
          <VscardF2
            icon={<Ic d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12L4 7.5M12 12v9" sw={2.2} />}
            title="Inspección = CALIDAD"
          >
            ¿Llegó <b>bien hecho</b>? Revisión del producto por dentro. Es otro
            servicio: <b>Inspección de calidad al recibir</b> (incluye la Validación).
          </VscardF2>
        </VersusF2>
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              Al registrar tu compra, activas la <b>Validación</b> con un clic.
            </>,
            <>
              Cuando tu mercancía llega a nuestra bodega, la abrimos y{" "}
              <b>contamos las cajas y las piezas</b>.
            </>,
            <>
              Comparamos contra tu <b>factura / packing list</b>.
            </>,
            <>
              Te enviamos la <b>verificación + fotos</b>.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              Detectas faltantes <b>a tiempo</b>, mientras aún puedes reclamarle al
              proveedor.
            </>,
            <>
              Viaja <b>lo que compraste</b>, no menos.
            </>,
            <>
              Tranquilidad: tienes <b>evidencia en fotos</b>.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              Pídelo <b>dentro de tu pre-alerta</b>, antes de que la mercancía llegue
              a la bodega.
            </>,
            <>
              Indícanos en las notas <b>qué debe traer</b> tu compra (cantidades,
              descripción, tallas, colores).
            </>,
            <>
              La Validación es <b>conteo</b>, no revisión de calidad del producto. Si
              quieres que revisemos el producto por dentro, pide{" "}
              <b>Inspección de calidad</b>.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <PriceF2
          text="Se cobra por caja."
          sub="Consulta la tarifa vigente con tu asesor."
          ctaLabel="Consulta la tarifa con tu asesor"
          ctaHref={CTA("Hola DTD Cargo, quiero información sobre la Validación (conteo) de mi carga.")}
        />
      </SecF2>
    </FichaF2>
  );
}

function InspeccionAlRecibir() {
  return (
    <FichaF2
      capa="llegada"
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Se pide en tu pre-alerta</ChipF2>
          <ChipF2>Activo</ChipF2>
        </>
      }
      hook="Mira tu producto por dentro antes de que embarque."
      sub={
        <>
          Inspeccionamos tu mercancía contra tu <b>ficha técnica</b> apenas llega a
          nuestra bodega y te enviamos las fotos.
        </>
      }
      seal={{ top: "2 EN 1", sub: "calidad + conteo" }}
      route={{
        stops: [
          { lb: "Llega a Yiwu", sb: "abrimos las cajas" },
          { lb: "Tu ficha técnica", sb: "el insumo clave" },
          { lb: "Inspección", sb: "producto por dentro" },
          { lb: "Te llega", sb: "fotos + conteo" },
        ],
        segs: [true, true, true],
        cap: [
          <b key="a">En nuestra bodega · al recibir</b>,
          "la de fábrica es otro momento",
        ],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          Cuando tu compra llega a nuestra bodega en China,{" "}
          <b>abrimos las cajas e inspeccionamos el producto</b> contra la{" "}
          <b>ficha técnica</b> que nos envías (medidas, materiales, gramaje,
          etiquetado, funcionamiento) y te enviamos las fotos. <b>Incluye la
          Validación</b>: además de revisar la calidad, contamos tu mercancía contra
          tu factura o packing list.
        </p>
        <VersusF2>
          <VscardF2
            hero
            icon={<Ic d="M4 8l8-4 8 4-8 4-8-4zM4 8v8l8 4 8-4V8M12 12v8" sw={2.2} />}
            title="Al recibir · en NUESTRA bodega"
          >
            Tu producto por dentro, apenas llega a Yiwu — antes de que embarque.{" "}
            <b>⊃ Incluye la Validación</b> (conteo contra tu factura). <b>Esta ficha.</b>
          </VscardF2>
          <VscardF2
            icon={<Ic d="M3 21V8l6 4V8l6 4V4l6 3v14zM7 17h2M12 17h2M17 17h2" sw={2.2} />}
            title="En fábrica · antes del embarque"
          >
            La <b>Inspección de calidad en fábrica</b> (PSI) es otro servicio, en
            otro momento del viaje — se pide en «Otros servicios», no en tu
            pre-alerta.
          </VscardF2>
        </VersusF2>
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              Al registrar tu compra, activas la{" "}
              <b>Inspección de calidad al recibir</b> y nos envías tu{" "}
              <span className="hi">ficha técnica</span>: qué quieres que revisemos del
              producto.
            </>,
            <>
              Cuando tu mercancía llega a nuestra bodega, <b>abrimos las cajas</b>.
            </>,
            <>
              <b>Inspeccionamos un producto</b> — o un modelo de cada producto —
              contra tu ficha técnica.
            </>,
            <>
              Te enviamos las <b>fotos</b>, junto con el <b>conteo de la Validación</b>{" "}
              (va incluida).
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              Sabes cómo llegó tu producto <b>por dentro</b> antes de que embarque —
              mientras aún puedes reclamarle al proveedor.
            </>,
            <>
              <b>Dos servicios en uno:</b> revisión de calidad + conteo contra tu
              factura (la Validación va incluida).
            </>,
            <>
              Tranquilidad: tienes <b>evidencia en fotos</b>.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              Pídelo <b>dentro de tu pre-alerta</b>, antes de que la mercancía llegue
              a la bodega.
            </>,
            <>
              Necesitamos tu <b>ficha técnica</b>: indícanos qué revisar (medidas,
              materiales, gramaje, etiquetado, funcionamiento).
            </>,
            <>
              Se inspecciona una <b>muestra</b>: un producto, o un modelo de cada
              producto — no pieza por pieza. Si necesitas que inspeccionemos más
              unidades, tu asesor te lo cotiza.
            </>,
            <>
              Esta inspección es <b>en nuestra bodega, al recibir</b>. Si necesitas
              revisar el producto <b>en la fábrica, antes del embarque</b>, pide la{" "}
              <b>Inspección de calidad en fábrica</b> — es otro servicio, en otro
              momento del viaje.
            </>,
            <>
              Como <b>incluye la Validación</b>, no hace falta que pidas las dos.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <PriceF2
          text="Incluye la Validación (conteo), por eso su tarifa es mayor que la de la Validación sola."
          sub="Consulta la tarifa vigente con tu asesor."
          ctaLabel="Consulta la tarifa con tu asesor"
          ctaHref={CTA("Hola DTD Cargo, quiero información sobre la Inspección de calidad al recibir.")}
        />
      </SecF2>
    </FichaF2>
  );
}

function EtiquetadoDePiezas() {
  return (
    <FichaF2
      capa="llegada"
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Se pide en tu pre-alerta</ChipF2>
          <ChipF2>Activo</ChipF2>
        </>
      }
      hook="Tu mercancía llega lista para vender."
      sub={
        <>
          Etiquetamos cada pieza en nuestra bodega antes de embarcar, para que al
          llegar pase <b>del contenedor al anaquel</b>.
        </>
      }
      seal={{ top: "LISTO PARA VENDER", sub: "etiquetado en bodega" }}
      route={{
        stops: [
          { lb: "Activas el servicio", sb: "en tu pre-alerta" },
          { lb: "Eliges la opción", sb: "barras o física" },
          { lb: "Etiquetamos", sb: "pieza por pieza" },
          { lb: "Reporte", sb: "con fotos" },
        ],
        segs: [true, true, true],
        cap: [
          <b key="a">Del contenedor al anaquel</b>,
          "tu carga sigue su viaje, lista para vender",
        ],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          Etiquetamos tus productos en nuestra bodega en China, en{" "}
          <b>dos opciones</b>. Así tu mercancía viaja ya marcada según tu
          requerimiento y te enviamos el <b>reporte con fotos</b>.
        </p>
        <div className="optwin">
          <div className="oc">
            <div className="k">
              <span className="ab">OPCIÓN A</span>
              <Ic d="M4 6v12M8 6v12M12 6v12M15 6v12M19 6v12M21 6v12" />
              Código de barras
            </div>
            <div className="d">
              Etiquetado de código de barras hacia los productos.{" "}
              <b>Tú nos envías el archivo o arte de tu etiqueta</b> (de tu sistema o
              marketplace) y nosotros la imprimimos y la pegamos.
            </div>
          </div>
          <div className="oc">
            <div className="k">
              <span className="ab">OPCIÓN B</span>
              <Ic
                d="M20.6 13.4L11 3.8A2 2 0 0 0 9.6 3.2H4.2a1 1 0 0 0-1 1v5.4c0 .5.2 1 .6 1.4l9.6 9.6a2 2 0 0 0 2.8 0l4.4-4.4a2 2 0 0 0 0-2.8z"
                extra={<circle cx="7.5" cy="7.5" r="1.3" />}
              />
              Etiqueta física
            </div>
            <div className="d">
              Una etiqueta física a cada producto, <b>pieza por pieza</b>, según tu
              requerimiento.
            </div>
          </div>
        </div>
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              Al registrar tu compra, activas el <b>Etiquetado de piezas</b>.
            </>,
            <>
              Eliges la opción — <b>código de barras</b> o{" "}
              <b>etiqueta física por pieza</b> — y nos indicas en las notas cómo
              quieres el etiquetado.
            </>,
            <>
              Cuando tu mercancía llega a nuestra bodega,{" "}
              <b>etiquetamos pieza por pieza</b> según tu requerimiento.
            </>,
            <>
              Te enviamos el <b>reporte con fotos</b> y tu carga sigue su viaje,{" "}
              <span className="hi">lista para vender</span>.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              Tu mercancía llega <b>lista para el anaquel</b>: no abres cajas a
              etiquetar en Venezuela.
            </>,
            <>
              Ahorras <b>tiempo y mano de obra</b> al llegar tu carga.
            </>,
            <>
              Combínalo con la <b>Validación</b>: normalmente etiquetamos después de
              contar tu mercancía.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              Pídelo <b>dentro de tu pre-alerta</b>, antes de que la mercancía llegue
              a la bodega.
            </>,
            <>
              Indícanos en las notas <b>cómo quieres el etiquetado</b> (opción,
              contenido de la etiqueta, en qué parte del producto va).
            </>,
            <>
              Para el código de barras,{" "}
              <b>tú nos envías el archivo o arte de tu etiqueta</b> (de tu sistema o
              marketplace) y nosotros la imprimimos y la pegamos.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <PriceF2
          text="Se cobra por pieza."
          sub="Consulta la tarifa vigente con tu asesor."
          ctaLabel="Consulta la tarifa con tu asesor"
          ctaHref={CTA("Hola DTD Cargo, quiero información sobre el Etiquetado de piezas.")}
        />
      </SecF2>
    </FichaF2>
  );
}

function Hold() {
  return (
    <FichaF2
      capa="llegada"
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Se pide en tu pre-alerta</ChipF2>
          <ChipF2>Activo</ChipF2>
        </>
      }
      hook="Espera tu próxima compra y ahorra."
      sub={
        <>
          Retenemos tu carga en bodega para juntarla con lo que viene y alcanzar el{" "}
          <b>mínimo</b> o el <b>descuento por volumen</b>.
        </>
      }
      seal={{ top: "15 DÍAS", sub: "bodegaje sin costo" }}
      route={{
        stops: [
          { lb: "Pides el HOLD", sb: "y qué esperas" },
          { lb: "Tu carga espera", sb: "en bodega" },
          { lb: "Llega la otra", sb: "consolidamos" },
          { lb: "Viajan juntas", sb: "mismo contenedor" },
        ],
        segs: [true, true, true],
        cap: [
          <b key="a">Descuento solo en el MISMO contenedor</b>,
          "esperar = un poco más de demora",
        ],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          El HOLD <b>retiene tu mercancía</b> en nuestra bodega en lugar de enviarla
          de una vez, para que llegue tu próxima compra y{" "}
          <b>viajen juntas en el mismo contenedor</b>. Ideal cuando esperas más cajas
          para completar el mínimo o para alcanzar un{" "}
          <b>
            descuento por <TerminoEnlace valor="CBM" ancla="cbm" />
          </b>{" "}
          —
          porque el descuento solo aplica si las cargas van consolidadas en un mismo
          envío.
        </p>
        <VersusF2>
          <VscardF2 icon={<ArrowSm />} title="Sin HOLD">
            Si un contenedor está programado para salir (por ejemplo, en 5 días) y tu
            otra carga aún no llegó, tu mercancía <b>se va en ese envío</b> y no se
            consolida — <b>no aplica el descuento</b>.
          </VscardF2>
          <VscardF2
            hero
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                <rect x="5" y="4" width="4.5" height="16" rx="1.2" />
                <rect x="14.5" y="4" width="4.5" height="16" rx="1.2" />
              </svg>
            }
            title="Con HOLD"
          >
            Retenemos tu carga hasta que llegue la otra y{" "}
            <b>viajan juntas en el siguiente contenedor</b> — con descuento, y un poco
            más de demora: es el costo de esperar para consolidar.
          </VscardF2>
        </VersusF2>
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              <b>Pre-avisa</b> tus compras antes de que la mercancía llegue a nuestra
              bodega.
            </>,
            <>
              Pides el <b>HOLD</b> y nos dices qué mercancía estás esperando.
            </>,
            <>
              <b>Retenemos</b> tu carga en bodega hasta que llegue la otra.
            </>,
            <>
              Cuando llega tu siguiente compra, <b>consolidamos</b> todo y viaja junto
              en el <span className="hi">próximo contenedor</span>.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              Alcanzas el <b>mínimo de carga</b> aunque hoy tengas solo un paquete.
            </>,
            <>
              Aprovechas el <b>descuento por volumen (CBM)</b> juntando varias compras
              en el mismo contenedor.
            </>,
            <>
              Envías <b>ordenado</b> y en un solo viaje.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              <b>El descuento aplica solo si ambas cargas viajan en el MISMO
              contenedor.</b>{" "}
              Por eso hay que juntarlas: si una se va y la otra llega después, ya no
              hay consolidación y <b>no aplica el descuento</b>.
            </>,
            <>
              El HOLD puede generar <b>un poco más de demora</b> — es el costo de
              esperar para consolidar.
            </>,
            <>
              Tienes <b>15 días de bodegaje sin costo</b>. Pasado ese plazo, se genera
              un <b>cargo por bodegaje</b> por día hasta que la carga se despache.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <PriceF2
          text="El HOLD dentro del bodegaje gratis no tiene costo. Vencido el plazo, se cobra bodegaje por día."
          sub="Consulta la tarifa vigente con tu asesor."
          ctaLabel="Consulta la tarifa con tu asesor"
          ctaHref={CTA("Hola DTD Cargo, quiero información sobre el servicio HOLD (retener para consolidar).")}
        />
      </SecF2>
    </FichaF2>
  );
}

function ReEmpaque() {
  return (
    <FichaF2
      capa="llegada"
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Se pide en tu pre-alerta</ChipF2>
          <ChipF2>Activo</ChipF2>
        </>
      }
      hook="Tus compras pequeñas de Alibaba, en un solo empaque."
      sub={
        <>
          Juntamos tus paquetes en nuestra bodega para que tu carga viaje ordenada,
          con <b>un solo packing list</b>.
        </>
      }
      seal={{ top: "UN SOLO", sub: "packing list" }}
      route={{
        stops: [
          { lb: "Activas + trackings", sb: "tu lista de paquetes" },
          { lb: "Llegan todos", sb: "esperamos" },
          { lb: "Unimos", sb: "un solo empaque" },
          { lb: "Sigue el viaje", sb: "ordenada" },
        ],
        segs: [true, true, true],
        cap: [
          <b key="a">Muchos paquetes → una sola carga</b>,
          "ideal para compras a varios proveedores",
        ],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          Si compras por Alibaba en <b>compras pequeñas</b> a varios proveedores, el
          Re-Empaque <b>une esos paquetes en un solo empaque</b>: esperamos a que
          lleguen todos a nuestra bodega, los unimos y tu carga viaja ordenada con{" "}
          <b>UN solo packing list</b> — en lugar de muchos paquetes sueltos.
        </p>
        <div className="rejoin">
          <div className="pk">
            {["tracking 01", "tracking 02", "tracking 03", "tracking 04"].map((t) => (
              <span className="p1" key={t}>
                <BoxIc />
                {t}
              </span>
            ))}
          </div>
          <span className="arr">
            <ArrowSm />
          </span>
          <div className="one">
            <BoxSplitIc />
            <div className="t">
              Un solo empaque
              <small>1 packing list · carga ordenada</small>
            </div>
          </div>
        </div>
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              Al registrar tu compra, activas el <b>Re-Empaque</b> — antes de que
              llegue el <b>primer</b> paquete a la bodega.
            </>,
            <>
              Nos das la <span className="hi">lista de trackings</span> de los
              paquetes que quieres unir.
            </>,
            <>
              <b>Esperamos</b> a que lleguen todos los paquetes de tu lista a nuestra
              bodega.
            </>,
            <>
              Los <b>unimos en un solo empaque</b>, con un solo packing list, y tu
              carga sigue su viaje ordenada.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              Tus compras pequeñas viajan como <b>UNA sola carga</b>, no como paquetes
              sueltos.
            </>,
            <>
              <b>Un solo packing list</b>: más orden y control de tu envío.
            </>,
            <>
              Ideal si compras por Alibaba a <b>varios proveedores</b> en montos
              pequeños.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              Pídelo <b>dentro de tu pre-alerta</b>, antes de que llegue el{" "}
              <b>primer paquete</b> a la bodega.
            </>,
            <>
              Lista <b>todos los trackings</b> que quieres unir en el re-empaque.
            </>,
            <>
              Tu envío <b>espera</b>: el re-empaque se hace cuando llega el último
              paquete de tu lista. Si esperas más compras, combínalo con el{" "}
              <b>HOLD</b>.
            </>,
            <>
              <b>El Re-Empaque no te genera bodegaje mientras se procesa</b>: los días
              de bodegaje empiezan a contar cuando tu empaque está terminado, no
              mientras esperamos tus paquetes ni durante el re-empaque.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <PriceF2
          text="Consulta la tarifa vigente con tu asesor."
          sub=""
          ctaLabel="Consulta la tarifa con tu asesor"
          ctaHref={CTA("Hola DTD Cargo, quiero información sobre el Re-Empaque de mis paquetes.")}
        />
      </SecF2>
    </FichaF2>
  );
}

function PreAlerta() {
  /**
   * SDD-0519 · Mientras la bodega de China registre en Excel, el aviso «tu
   * mercancía llegó a bodega» no sale: sólo se programa cuando la recepción se
   * registra en el sistema (SDD-0516). Con el interruptor de la 0514 prendido,
   * la ruta, el actor 3 y el paso 5 dicen lo que sí pasa hoy; al apagarlo vuelve
   * el texto de siempre. Se lee aquí, al renderizar, y no al cargar el módulo.
   *
   * SDD-0528 · con el mismo valor, el tercer beneficio deja de prometer que ves
   * el estado de tu compra en todo momento (el seguimiento del Portal está en
   * construcción) y dice lo que el Portal ya hace: registrar la compra.
   */
  const enConstruccion = TRACKING_EN_CONSTRUCCION;
  return (
    <FichaF2
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Tu orden · no es un servicio</ChipF2>
          <ChipF2 variant="on">Activo</ChipF2>
        </>
      }
      hook="Avísanos que compraste y nosotros nos preparamos."
      sub={
        <>
          Registra tu compra en el portal antes de que llegue a nuestra bodega en
          China y <b>evita el caos de los grupos de WeChat</b>.
        </>
      }
      seal={{ top: "SIN COSTO", sub: "es tu orden" }}
      route={{
        stops: [
          { lb: "Tú", sb: "creas tu compra" },
          { lb: "Tu proveedor", sb: "packing list + etiquetas" },
          {
            lb: "Operario Yiwu",
            sb: enConstruccion ? "recibe tu carga" : "escanea y te avisa",
          },
        ],
        segs: [true, true],
        cap: [<b key="a">Un enlace conecta a los 3</b>, "sin grupos de WeChat"],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          La pre-alerta es cómo le dices a DTD que{" "}
          <b>hiciste una compra en China y viene mercancía en camino</b>. No es un
          servicio con costo aparte: es la <b>orden</b> de tu envío marítimo. Con ella
          preparamos todo para recibir tu carga sin errores.
        </p>
        <div className="f2actors">
          <div className="actor">
            <div className="who">
              <span className="n">1</span>Tú
            </div>
            <div className="does">
              Registras tu compra en el portal: proveedor, descripción y número de
              cajas. El sistema genera <b>tu enlace</b>.
            </div>
          </div>
          <div className="actor-arrow">
            <ArrowSm />
          </div>
          <div className="actor">
            <div className="who">
              <span className="n">2</span>Tu proveedor
            </div>
            <div className="does">
              Abre el enlace, <b>llena el packing list en línea</b> y{" "}
              <b>pega las etiquetas</b> a las cajas. Todo queda registrado.
            </div>
          </div>
          <div className="actor-arrow">
            <ArrowSm />
          </div>
          <div className="actor">
            <div className="who">
              <span className="n">3</span>Operario en Yiwu
            </div>
            <div className="does">
              {enConstruccion ? (
                <>
                  <b>Recibe tu mercancía</b> cuando llega y la <b>identifica</b> por
                  la etiqueta.
                </>
              ) : (
                <>
                  <b>Recibe escaneando</b> la etiqueta cuando llega tu mercancía y{" "}
                  <b>te avisamos</b> al instante.
                </>
              )}
            </div>
          </div>
        </div>
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              Entras al portal y creas tu <b>compra</b>: proveedor, descripción y
              número de cajas.
            </>,
            <>
              El sistema te da un <b>enlace y las etiquetas</b> para tu proveedor.
            </>,
            <>
              Le envías el enlace a tu proveedor. Él{" "}
              <b>llena el packing list en línea</b> y <b>pega las etiquetas</b> a las
              cajas — todo queda registrado con nosotros,{" "}
              <span className="hi">sin grupos de WeChat</span>.
            </>,
            <>
              Al final, eliges los <b>servicios extra para la llegada</b> que quieras
              (Validación, Inspección, Etiquetado, HOLD, Re-Empaque).
            </>,
            enConstruccion ? (
              <>
                Cuando tu mercancía llega a Yiwu, el operario{" "}
                <b>la recibe y la identifica</b> por la etiqueta.
              </>
            ) : (
              <>
                Cuando tu mercancía llega a Yiwu, el operario <b>la recibe escaneando</b>{" "}
                la etiqueta y <b>te avisamos</b>.
              </>
            ),
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              <b>Se acabaron los grupos de WeChat</b>: el proveedor entrega los datos
              por el enlace. Solo lo contactas si hay algo puntual que preguntar.
            </>,
            <>
              Tu carga llega <b>identificada</b> desde la mesa del proveedor hasta el
              galpón — un solo código.
            </>,
            enConstruccion ? (
              <>
                Tu compra queda <b>registrada en tu portal</b> desde el primer día.
              </>
            ) : (
              <>
                Ves el <b>estado de tu compra</b> en todo momento.
              </>
            ),
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              Haz tu pre-alerta <b>antes de que la mercancía llegue</b> a nuestra
              bodega en China; así la recibimos a tu nombre sin demoras.
            </>,
            <>
              La identificación correcta de la compra corre por cuenta del cliente.
            </>,
            <>
              Si tu mercancía llega <b>sin pre-alerta</b>, la recibimos igual, pero
              puede <b>demorar</b> mientras la identificamos a mano,{" "}
              <b>e incluso no embarcarse</b> por no tener las instrucciones correctas —
              lo que puede generar <b>costos de bodegaje</b>.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <PriceF2
          text="La pre-alerta no tiene costo."
          sub="Los servicios extra de la llegada se cotizan aparte con tu asesor."
          ctaLabel="Pre-alerta tu compra en el portal"
          ctaHref={CTA("Hola DTD Cargo, quiero hacer la pre-alerta de mi compra.")}
        />
      </SecF2>
    </FichaF2>
  );
}

// ════════════════════════════════════════════════════════════════════
// 01 · Origen (capa-origen)
// ════════════════════════════════════════════════════════════════════

function VerificacionDeProveedores() {
  return (
    <FichaF2
      capa="origen"
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Se pide aparte — antes de comprar</ChipF2>
          <ChipF2>Activo</ChipF2>
        </>
      }
      hook="Antes de pagarle a un proveedor chino, confirma que existe."
      sub={
        <>
          Verificamos que la fábrica sea <b>real, legal y capaz</b> de cumplir tu
          pedido — en línea o visitándola en persona.
        </>
      }
      seal={{ top: "REPORTE EN 1–3 DÍAS", sub: "hábiles · reporte DTD" }}
      route={{
        stops: [
          { lb: "Tú", sb: "datos del proveedor" },
          { lb: "Eliges", sb: "online o física" },
          { lb: "Verificamos", sb: "legal + capacidad" },
          { lb: "Reporte DTD", sb: "1–3 días hábiles" },
        ],
        segs: [true, true, true],
        cap: [<b key="a">Antes de enviar dinero</b>, "decides con evidencia verificada"],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          Una verificación de legitimidad de tu proveedor o fábrica en China, en{" "}
          <b>dos modalidades</b>:
        </p>
        <VersusF2>
          <VscardF2 icon={<DocIc />} title="Verificación online (documental)">
            Revisamos su documentación: <b>validez legal</b> de la empresa, que{" "}
            <b>no tenga demandas ni problemas legales</b>, y{" "}
            <b>capacidad declarada</b> — sin visita a la fábrica. También confirmamos
            que la <b>cuenta bancaria para tu pago sea la cuenta oficial</b> de la
            empresa.
          </VscardF2>
          <VscardF2 hero icon={<FactoryIc />} title="Verificación física (en sitio)">
            Nuestro equipo en China <b>visita la fábrica o la oficina</b> de tu
            proveedor — te aclaramos cuál de las dos, porque no siempre es la fábrica
            — para confirmarlo con una inspección real. Verificamos que la{" "}
            <b>cuenta bancaria</b> a la que vas a pagar sea la oficial de recepción de
            la empresa, y que tenga la <b>capacidad real de producir</b> lo que estás
            pidiendo — tu blindaje contra estafas y errores.
          </VscardF2>
        </VersusF2>
        <p className="f2body" style={{ marginTop: "var(--s-4)" }}>
          En ambas recibes un <b>reporte DTD en español</b> con los hallazgos; en la
          física, con <b>fotos de la visita</b>.
        </p>
        <RepmockF2
          title="Reporte de Verificación de Proveedor"
          sub="DTD Cargo · en español · con fotos"
        />
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              Nos escribes por WhatsApp con los <b>datos de tu proveedor</b> (nombre
              de la empresa, contacto, producto que le vas a comprar).
            </>,
            <>
              Eliges la modalidad: <b>online</b> (solo documentación) o <b>física</b>{" "}
              (visita a las instalaciones).
            </>,
            <>
              Verificamos <b>validez legal, capacidad e instalaciones</b>, según la
              modalidad elegida.
            </>,
            <>
              Recibes tu <b>reporte DTD en español</b> con el resultado, para que
              decidas si compras.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              Detectas una empresa fantasma <b>antes de enviar dinero</b>, no después.
            </>,
            <>
              Sabes si la fábrica de verdad <b>puede producir</b> lo que le vas a
              pedir.
            </>,
            <>
              Decides con <b>evidencia verificada</b>, no con las capturas y fotos que
              te manda el propio proveedor.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              Pídela <b>antes de pagar</b> al proveedor: el reporte sirve para
              decidir, no para revertir una estafa ya consumada.
            </>,
            <>
              Necesitamos los <b>datos completos del proveedor</b> (nombre legal de la
              empresa y contacto); mientras más datos nos des, más completa la
              verificación.
            </>,
            <>
              La verificación te dice <b>con quién tratas</b>; la calidad del producto
              se revisa con la{" "}
              <SvcLink slug="inspeccion-en-fabrica">
                Inspección de calidad en fábrica
              </SvcLink>{" "}
              (servicio aparte, se pueden combinar).
            </>,
            <>
              Si compras con nuestra{" "}
              <SvcLink slug="compra-asistida">Compra asistida</SvcLink>, la
              verificación del proveedor <b>ya va incluida</b>.
            </>,
            <>
              <b>Entregamos el reporte en 1 a 3 días hábiles</b> (coordinando con tu
              proveedor).
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <PriceF2
          text="Según la modalidad: online o física."
          sub="Tu asesor te comparte también un ejemplo del reporte."
          ctaLabel="Consulta la tarifa con tu asesor"
          ctaHref={CTA("Hola DTD Cargo, quiero verificar un proveedor en China.")}
        />
      </SecF2>
    </FichaF2>
  );
}

function AuditoriaDeCalidad() {
  return (
    <FichaF2
      capa="origen"
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Se pide aparte — durante la producción</ChipF2>
          <ChipF2>Activo</ChipF2>
        </>
      }
      hook="No esperes al final para saber si tu pedido va bien."
      sub={
        <>
          Auditamos la fábrica y controlamos la calidad <b>mientras se produce</b>,
          para corregir a tiempo — no cuando el lote completo ya salió mal.
        </>
      }
      seal={{ top: "PUNTAJE /100", sub: "reporte DTD de auditoría" }}
      route={{
        stops: [
          { lb: "Materiales", sb: "al arranque" },
          { lb: "~20 % producido", sb: "se corrige a tiempo" },
          { lb: "Producción", sb: "monitoreo de línea" },
          { lb: "Carga", sb: "supervisión del contenedor" },
        ],
        segs: [true, true, true],
        cap: [
          <b key="a">Intervenimos donde tu pedido lo necesite</b>,
          "reporte DTD en ~7 días hábiles",
        ],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          Dos servicios complementarios sobre el fabricante, bajo estándares
          internacionales:
        </p>
        <VersusF2>
          <VscardF2 hero icon={<FactoryIc />} title="Auditoría de fábrica">
            Online o presencial: evaluamos{" "}
            <b>procesos, capacidad y confiabilidad</b> del fabricante. Recibes un{" "}
            <b>reporte DTD de Auditoría de Fábrica con puntaje sobre 100</b>.
          </VscardF2>
          <VscardF2
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7v5l3.2 2" />
              </svg>
            }
            title="Control durante la producción"
          >
            Revisamos tu lote <b>mientras se fabrica</b> — materiales al arranque,
            avance con <b>~20 % producido</b>, monitoreo continuo de la línea o
            supervisión de la carga del contenedor, según lo que tu pedido necesite.
          </VscardF2>
        </VersusF2>
        <RepmockF2
          title="Auditoría de Fábrica"
          sub="DTD Cargo · reporte en español · con fotos"
          score
        />
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              Nos cuentas por WhatsApp qué necesitas:{" "}
              <b>auditar al fabricante, vigilar tu producción, o ambas</b>.
            </>,
            <>
              Definimos contigo el <b>alcance</b>: auditoría online o presencial, y en
              qué momentos de la producción revisar.
            </>,
            <>
              Nuestro equipo en China <b>ejecuta las visitas acordadas</b> en la
              fábrica.
            </>,
            <>
              Recibes tu <b>reporte DTD en español, con fotos</b>, por cada
              intervención.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              Corriges los desvíos con <b>~20 % producido</b>, no cuando todo el lote
              ya está fabricado.
            </>,
            <>
              Sabes si el fabricante tiene <b>procesos de calidad reales</b>, no solo
              un buen catálogo.
            </>,
            <>
              Ideal para pedidos grandes o recurrentes, donde{" "}
              <b>un lote malo cuesta mucho más</b> que la auditoría.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              Pídela <b>antes de que arranque la producción</b> (o apenas comience):
              el valor está en corregir a tiempo.
            </>,
            <>
              Necesitamos tu <b>ficha técnica</b> y lo acordado con tu proveedor, para
              auditar contra algo concreto.
            </>,
            <>
              Es distinta de la{" "}
              <SvcLink slug="verificacion-de-proveedores">
                Verificación de proveedores
              </SvcLink>{" "}
              (¿la empresa existe y es legal?) y de la{" "}
              <SvcLink slug="inspeccion-en-fabrica">
                Inspección de calidad en fábrica
              </SvcLink>{" "}
              (pedido ya terminado, pre-embarque). Las tres se pueden combinar según
              tu caso.
            </>,
            <>
              Entregamos el <b>reporte DTD en ~7 días hábiles</b> por intervención.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <PriceF2
          text="Depende del alcance."
          sub="Online o presencial, y cuántas intervenciones durante la producción."
          ctaLabel="Consulta la tarifa con tu asesor"
          ctaHref={CTA("Hola DTD Cargo, quiero información sobre la Auditoría y control de calidad.")}
        />
      </SecF2>
    </FichaF2>
  );
}

function LabTesting() {
  return (
    <FichaF2
      capa="origen"
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Se pide aparte — antes del embarque</ChipF2>
          <ChipF2>Activo</ChipF2>
        </>
      }
      hook="Que tu producto no se quede varado por un certificado."
      sub={
        <>
          Coordinamos las <b>pruebas de laboratorio</b> y los <b>permisos</b> que tu
          mercancía necesita para salir de China y entrar a su mercado de destino.
        </>
      }
      seal={{ top: "ENSAYOS + PERMISOS", sub: "coordinados por DTD" }}
      route={{
        stops: [
          { lb: "Tu producto", sb: "y su mercado destino" },
          { lb: "Laboratorio", sb: "ensayos acreditados" },
          { lb: "Certificado", sb: "y permisos de exportación" },
          { lb: "Embarque", sb: "sin retenciones" },
        ],
        segs: [true, true, true],
        cap: [
          <span key="a">
            <b>Pídelo con anticipación</b> — los ensayos toman su tiempo
          </span>,
          "reporte DTD en ~7 días hábiles",
        ],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          Coordinamos <b>ensayos de laboratorio</b> para tu producto (RoHS, CE, FDA y
          otros, según el mercado de destino) y gestionamos los{" "}
          <b>permisos requeridos para la exportación</b>. Tú nos dices qué producto es
          y a dónde va; nosotros coordinamos las pruebas con laboratorios acreditados
          en China y te entregamos los resultados.
        </p>
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              Nos escribes por WhatsApp con tu{" "}
              <b>producto y su mercado de destino</b>.
            </>,
            <>
              Te confirmamos <b>qué ensayos o permisos aplican</b> a tu caso y cotizas
              con tu asesor.
            </>,
            <>
              Coordinamos las <b>pruebas de laboratorio</b> y/o la{" "}
              <b>gestión de los permisos</b> de exportación en China.
            </>,
            <>
              Recibes los <b>resultados y certificados</b>, con el acompañamiento de
              tu asesor en español.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              Evitas que tu carga <b>se detenga</b> por falta de un certificado o
              permiso.
            </>,
            <>
              No descifras normativas (RoHS, CE, FDA…) por tu cuenta:{" "}
              <b>te decimos qué aplica</b> a tu producto y a tu destino.
            </>,
            <>
              Todo lo coordina <b>el mismo equipo que maneja tu carga</b> — un solo
              socio, en español.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              Cada mercado exige cosas distintas: el alcance exacto se define{" "}
              <b>según tu producto y su destino</b>.
            </>,
            <>
              Pídelo <b>con anticipación</b>: los ensayos toman su tiempo y conviene
              tener los resultados antes de embarcar.
            </>,
            <>
              El <b>costo del laboratorio se cotiza según el ensayo</b> que aplique.
            </>,
            <>
              Entregamos el <b>reporte en ~7 días</b>; la duración del ensayo depende
              del tipo de prueba.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <PriceF2
          text="Depende del ensayo o permiso que tu producto necesite."
          sub="Consulta la tarifa vigente con tu asesor."
          ctaLabel="Consulta la tarifa con tu asesor"
          ctaHref={CTA("Hola DTD Cargo, quiero información sobre Lab testing y permisología.")}
        />
      </SecF2>
    </FichaF2>
  );
}

function CompraAsistida() {
  const ctaHref = CTA("Hola DTD Cargo, quiero información sobre la Compra asistida (sourcing).");
  return (
    <FichaF2
      capa="origen"
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Se pide aparte — va antes de la carga</ChipF2>
          <ChipF2>Activo</ChipF2>
        </>
      }
      hook="Tu departamento de compras en China."
      sub={
        <>
          Conseguimos el proveedor, negociamos y compramos por ti — o entramos como tu{" "}
          <b>comprador de confianza</b> con el proveedor que ya tienes.
        </>
      }
      seal={{ top: "VERIFICACIÓN INCLUIDA", sub: "en ambas modalidades" }}
      route={{
        stops: [
          { lb: "Ficha técnica", sb: "tu producto" },
          { lb: "Verificamos", sb: "proveedor incluido" },
          { lb: "Negociamos", sb: "y compramos por ti" },
          { lb: "Compra completa", sb: "conecta al envío" },
        ],
        segs: [true, true, true],
        cap: [<b key="a">Sin viajar y sin hablar chino</b>, "equipo propio en Yiwu"],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          Un servicio con <b>dos modalidades</b>:
        </p>
        <VersusF2>
          <VscardF2 hero tag="MOD A" title="Sourcing completo">
            Tú traes el producto con su <b>ficha técnica</b>; nosotros conseguimos el
            proveedor en nuestra red propia, negociamos y{" "}
            <b>gestionamos la compra por ti</b>.
          </VscardF2>
          <VscardF2 tag="MOD B" title="Sobre tu proveedor">
            Ya tienes proveedor y precios, pero temes que te estafen; nosotros lo{" "}
            <b>verificamos</b> y gestionamos la compra entrando como tu{" "}
            <b>comprador de confianza</b>.
          </VscardF2>
        </VersusF2>
        <div className="f2incl">
          <ShieldCheckIc />
          En ambas modalidades la <b>verificación del proveedor va incluida</b>, y te
          acompañamos hasta que la compra se completa.
        </div>
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              Nos mandas por WhatsApp tu{" "}
              <b>lista de productos con su ficha técnica</b> (o los datos de tu
              proveedor, si ya lo tienes).
            </>,
            <>
              Un asesor te confirma <b>viabilidad, modalidad y costo</b>.
            </>,
            <>
              <b>Verificamos el proveedor</b> (incluido en ambas modalidades).
            </>,
            <>
              <b>Negociamos y gestionamos la compra</b> por ti, con seguimiento hasta
              que se completa y todo salga bien.
            </>,
            <>
              Con la compra cerrada, si quieres, conectas con nuestros{" "}
              <b>servicios de envío</b> (consolidación, flete, aduana y entrega).
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              Compras en China <b>sin viajar y sin hablar chino</b>, con nuestro
              equipo propio en Yiwu.
            </>,
            <>
              <b>Menos riesgo de estafa:</b> el proveedor se verifica siempre; en la
              modalidad B entramos como tu comprador/garante.
            </>,
            <>
              Negociamos por ti y te acompañamos{" "}
              <b>hasta que la compra se completa</b> — no te dejamos solo a mitad de
              camino.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              Para el sourcing necesitamos el{" "}
              <b>producto + su ficha técnica</b> (especificaciones): con eso validamos
              que las fuentes sean buenas.
            </>,
            <>
              En el sourcing completo la compra se gestiona <b>a través de DTD</b>:
              nosotros respondemos ante ti como tu proveedor.
            </>,
            <>
              Tiempos de referencia: desde que entregas la ficha técnica,{" "}
              <b>mínimo 1 semana</b> para confirmarte el producto y{" "}
              <b>hasta 15 días</b> para sondear varios proveedores y validar las
              fuentes. Sobre tu proveedor suele ser más rápido.
            </>,
            <>
              <b>No incluye:</b> el pago al proveedor (pídelo como{" "}
              <SvcLink slug="pago-asistido">Pago asistido</SvcLink>), el costo de la
              mercancía ni los fletes internacionales o nacionales.
            </>,
            <>
              El servicio llega <b>hasta completar la compra</b>; lo que sigue
              (consolidación, flete, aduana, entrega) son servicios complementarios de
              DTD.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <p className="f2body">
          <b>Comisión escalonada según el monto de tu compra:</b> mientras más grande
          la compra, menor el porcentaje. En la modalidad sobre tu proveedor la
          comisión es <b>la mitad</b> de la del sourcing completo.
        </p>
        <div className="esc">
          <span className="bar b1" />
          <span className="bar b2" />
          <span className="bar b3" />
          <span className="bar b4" />
        </div>
        <div className="esc-axis">
          <span>Compra más pequeña</span>
          <span>Compra más grande</span>
        </div>
        <div className="esc-cap">
          A más monto, menor porcentaje — pide la tabla a tu asesor.
        </div>
        <div className="f2price-row" style={{ marginTop: "var(--s-4)" }}>
          <div className="tx">
            La tabla de comisión te la comparte tu asesor.
            <small>Modalidad B: la mitad de la comisión del sourcing completo.</small>
          </div>
          <CtaF2 label="Pide la tabla a tu asesor" href={ctaHref} />
        </div>
      </SecF2>
    </FichaF2>
  );
}

function PagoAsistido() {
  return (
    <FichaF2
      capa="origen"
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Se pide aparte — antes o fuera de tu carga</ChipF2>
          <ChipF2>Activo</ChipF2>
        </>
      }
      hook="Paga en China sin tener cuenta en China."
      sub={
        <>
          Nosotros le pagamos a tu proveedor <b>en Yuan</b> y tú pagas{" "}
          <b>en Venezuela</b>, con respaldo de cada transacción.
        </>
      }
      seal={{ top: "EN CHINA EN 3–4 DÍAS", sub: "máximo · con respaldo" }}
      route={{
        stops: [
          { lb: "Pagas a DTD", sb: "en Venezuela" },
          { lb: "Pagamos en Yuan", sb: "a tu proveedor" },
          { lb: "Respaldo", sb: "transacción documentada" },
        ],
        segs: [true, true],
        cap: [
          <b key="a">Primero pagas tú → después pagamos nosotros</b>,
          "máximo 3–4 días",
        ],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          Si no tienes cómo pagarle a tu proveedor chino, DTD{" "}
          <b>paga por ti en Yuan</b> — vía Alipay, WeChat Pay, transferencia o
          efectivo en China — y tú <b>pagas en Venezuela</b>. Transacciones seguras,
          para que pagues con respaldo.
        </p>
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              Nos escribes por WhatsApp con los{" "}
              <b>datos de tu proveedor y el monto</b> a pagar.
            </>,
            <>
              Un asesor te confirma las <b>condiciones y el costo</b> de la operación.
            </>,
            <>
              <b>Pagas a DTD en Venezuela.</b>
            </>,
            <>
              <b>Pagamos a tu proveedor en Yuan</b> (Alipay, WeChat Pay, transferencia
              o efectivo en China).
            </>,
            <>
              Recibes el <b>respaldo de tu transacción</b>.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              Resuelves el problema #1 de comprar en China desde Venezuela:{" "}
              <b>cómo pagar</b>.
            </>,
            <>
              Tu proveedor cobra <b>en su moneda y por su canal habitual</b> — la
              compra no se traba por el pago.
            </>,
            <>
              Pagas con <b>respaldo</b>: la transacción queda documentada.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              <b>Nos entregas el dinero en Venezuela y, máximo en 3 a 4 días, tu
              proveedor lo recibe en China.</b>
            </>,
            <>
              <b>Primero pagas a DTD; después pagamos a tu proveedor.</b> El pago al
              proveedor sale una vez recibido tu pago.
            </>,
            <>
              Es el complemento natural de la{" "}
              <SvcLink slug="compra-asistida">Compra asistida</SvcLink> (el pago al
              proveedor no va incluido en ella).
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <PriceF2
          text="Se confirma por operación."
          sub="Consulta la tarifa vigente con tu asesor."
          ctaLabel="Consulta la tarifa con tu asesor"
          ctaHref={CTA("Hola DTD Cargo, quiero información sobre el Pago asistido a mi proveedor.")}
        />
      </SecF2>
    </FichaF2>
  );
}

function CourierDeMuestras() {
  return (
    <FichaF2
      capa="origen"
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Se pide aparte — no va en la pre-alerta</ChipF2>
          <ChipF2>Activo</ChipF2>
        </>
      }
      hook="Lo pequeño y urgente no espera un contenedor."
      sub={
        <>
          Te enviamos muestras, documentos y paquetes pequeños desde Yiwu por{" "}
          <b>courier express</b> (DHL, UPS o FedEx).
        </>
      }
      seal={{ top: "HASTA 10 KG", sub: "15–21 días" }}
      route={{
        stops: [
          { lb: "Nos escribes", sb: "qué y a dónde" },
          { lb: "Recibimos", sb: "en Yiwu" },
          { lb: "Despachamos", sb: "courier express" },
          { lb: "Guía de rastreo", sb: "15–21 días" },
        ],
        segs: [true, true, true],
        cap: [
          <b key="a">No es flete aéreo de carga</b>,
          "eso es otro servicio · próximamente",
        ],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          Un servicio de <b>courier puntual desde China</b>: muestras de
          pre-producción, documentos y lotes pequeños críticos que necesitas rápido,
          despachados por <b>DHL, UPS o FedEx</b> desde nuestra base en Yiwu.
        </p>
        <XrefF2>
          <b>No es flete aéreo de carga.</b>{" "}
          <ConGlosario>
            La carga grande viaja por vía marítima (Puerta a Puerta, LCL o FCL); el
            envío aéreo de carga es otro servicio y estará disponible
          </ConGlosario>{" "}
          <b>próximamente</b>.
        </XrefF2>
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              Escríbenos por <b>WhatsApp</b> con qué necesitas enviar y a dónde.
            </>,
            <>
              Tu asesor confirma que aplica al courier y te <b>cotiza el envío</b>.
            </>,
            <>
              Recibimos la muestra o el documento en nuestra bodega de <b>Yiwu</b>.
            </>,
            <>
              Despachamos por <b>courier express</b> (DHL, UPS o FedEx) y te
              compartimos la <b>guía de rastreo</b>.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              Tienes la <b>muestra en tus manos antes de aprobar la producción</b> —
              decides con el producto real, no con fotos.
            </>,
            <>
              Documentos y piezas pequeñas críticas viajan <b>rápido</b>, sin esperar
              un consolidado.
            </>,
            <>
              Un solo interlocutor: lo coordina tu <b>asesor DTD</b> de punta a punta.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              <b>No es flete aéreo de carga:</b> es un courier puntual para muestras,
              documentos y cosas pequeñas. Si tu carga es grande, va por vía marítima.
              El envío aéreo de carga es <b>otro servicio — próximamente</b>.
            </>,
            <>
              Límite por envío: <b>hasta 10 kg</b>.
            </>,
            <>
              Tiempo de entrega estimado: <b>15 a 21 días</b>.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <PriceF2
          text={
            <>
              Se calcula por <b>peso volumétrico</b>.
            </>
          }
          sub="Consulta la tarifa vigente con tu asesor."
          ctaLabel="Consulta la tarifa con tu asesor"
          ctaHref={CTA("Hola DTD Cargo, quiero enviar muestras/documentos por courier desde China.")}
        />
      </SecF2>
    </FichaF2>
  );
}

// ════════════════════════════════════════════════════════════════════
// 03/04 · Trámites (capa-tramites)
// ════════════════════════════════════════════════════════════════════

function TransitoDeAduana() {
  return (
    <FichaF2
      capa="tramites"
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Add-on · se suma al LCL y al FCL hasta puerto</ChipF2>
          <ChipF2>Activo</ChipF2>
        </>
      }
      hook="Tu carga llegó a puerto — nosotros la nacionalizamos por ti."
      sub={
        <>
          <ConGlosario>
            Gestionamos el trámite aduanal y el desaduanaje de tu carga LCL o FCL
            hasta puerto en Venezuela,
          </ConGlosario>{" "}
          <b>representándote como tu agente ante la aduana</b>.
        </>
      }
      seal={{ top: "5–6 DÍAS HÁBILES", sub: "nacionalización" }}
      route={{
        stops: [
          { lb: "Puerto VE", sb: "llega tu carga" },
          { lb: "Almacén fiscal", sb: "servicios aparte" },
          { lb: "Aduana", sb: "te representamos" },
          { lb: "Nacionalizada", sb: "lista para retirar" },
        ],
        segs: [true, true, true],
        cap: [
          <span key="a">
            <b>Entra DTD como tu agente</b> — con tu carta poder
          </span>,
          "5–6 días hábiles",
        ],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          Es el servicio para clientes del{" "}
          <SvcLink slug="consolidado-lcl">Consolidado LCL</SvcLink> y del{" "}
          <b>FCL hasta puerto</b> que legalizan la mercancía a su nombre: gestionamos
          el paso de tu carga por la <b>aduana venezolana</b> y su{" "}
          <b>nacionalización</b>, con la <b>documentación de importación incluida</b>.
          Tú pagas tus planillas directamente a la aduana; nosotros te representamos
          como tu <b>agente</b>, con tu carta poder.{" "}
          <b>En el Puerta a Puerta y en el FCL todo pagado no necesitas contratarlo:
          ya va incluido.</b>
        </p>
        <VersusF2>
          <VscardF2
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <rect x="3.5" y="5" width="17" height="14" rx="2" />
                <path d="M3.5 10h17M8 15h4" />
              </svg>
            }
            title="Lo pagas tú directo"
          >
            <b>Planillas e impuestos</b> de la aduana — no pasan por nosotros.
            Transparencia: no cobramos la aduana, cobramos la gestión.
          </VscardF2>
          <VscardF2 hero icon={<DocIc />} title="Lo gestionamos nosotros">
            <b>Documentación de importación incluida</b>: facturas de embarque,
            declaraciones, certificados y requerimientos normativos — y tu
            representación como agente.
          </VscardF2>
        </VersusF2>
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              <b>Súmalo a tu carga LCL o FCL hasta puerto</b> con tu asesor, a tu
              nombre o al de tu empresa.
            </>,
            <>
              Firmas la <b>carta poder</b> para que te representemos como tu agente
              ante la aduana.
            </>,
            <>
              Preparamos y tramitamos los <b>documentos de importación</b>: facturas
              de embarque, declaraciones, certificados y requerimientos normativos.
            </>,
            <>
              Gestionamos el paso por la aduana;{" "}
              <b>las planillas y los impuestos los pagas tú directamente a la
              aduana</b>{" "}
              — no pasan por nosotros.
            </>,
            <>
              Tu mercancía queda <b>nacionalizada a tu nombre</b>, lista para retirar.
              Si quieres, sumamos el <b>transporte hasta tu destino</b> como extra
              adicional.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              Importas formalmente <b>a tu nombre</b> sin pelear con el trámite:
              nuestro equipo lo hace todos los días.
            </>,
            <>
              <b>Transparencia:</b> las planillas de la aduana las pagas tú directo —
              nosotros no cobramos la aduana, cobramos la gestión.
            </>,
            <>
              Cierra el circuito del Consolidado LCL: del puerto a tu mercancía
              legalizada, <b>con un solo interlocutor</b>.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              Aplica como servicio adicional para cargas <b>LCL y FCL hasta puerto</b>;
              en el <b>Puerta a Puerta y el FCL todo pagado ya va incluido</b>.
            </>,
            <>
              Necesitamos tu <b>carta poder</b> y tus datos (tu nombre o el de tu
              empresa) para representarte.
            </>,
            <>
              <b>Las planillas y los impuestos</b> los pagas tú directamente a la
              aduana; no pasan por nosotros.
            </>,
            <>
              Los <b>servicios portuarios, el almacén fiscal y el transporte
              interno</b>{" "}
              se facturan aparte.
            </>,
            <>
              Nacionalización: <b>5 a 6 días hábiles</b>.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <PriceF2
          text={
            <>
              Se cotiza según el <b>valor de tu carga</b> (por valorización de la
              factura).
            </>
          }
          sub="Intervienen muchos factores — consulta el aproximado con tu asesor."
          ctaLabel="Consulta la tarifa con tu asesor"
          ctaHref={CTA("Hola DTD Cargo, quiero información sobre el Tránsito de aduana y desaduanaje.")}
        />
      </SecF2>
    </FichaF2>
  );
}

function VisadoDeNegocios() {
  return (
    <FichaF2
      capa="tramites"
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Independiente — no depende de tu carga</ChipF2>
          <ChipF2>Activo</ChipF2>
        </>
      }
      hook="Tu visado de negocios, sin dolores de cabeza."
      sub={
        <>
          Gestionamos todo el trámite <b>desde nuestras oficinas en Valencia</b>:
          documentos, formularios, fotografía y coordinación con el consulado.
        </>
      }
      seal={{ top: "7 DÍAS URGENTE", sub: "normal · 2 semanas" }}
      route={{
        stops: [
          { lb: "Agendas", sb: "por WhatsApp" },
          { lb: "Documentos", sb: "y formularios · VE" },
          { lb: "Fotografía", sb: "en Valencia" },
          { lb: "Consulado", sb: "seguimiento hasta respuesta" },
        ],
        segs: [true, true, true],
        cap: [
          <span key="a">
            <b>Todo el trámite desde Valencia</b> — hasta la foto
          </span>,
          "urgente 7 días · normal 2 semanas",
        ],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          Te acompañamos en todo el trámite del <b>visado de negocios chino</b>:
          asesoría documental, diligencia de formularios, toma de fotografía en
          nuestras oficinas y coordinación con el consulado. Todo se gestiona{" "}
          <b>desde Venezuela</b>.
        </p>
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              Escríbenos por <b>WhatsApp</b> para agendar y conocer los requisitos.
            </>,
            <>
              Te asesoramos con los <b>documentos</b> y diligenciamos los{" "}
              <b>formularios</b> contigo.
            </>,
            <>
              Tomamos tu <b>fotografía</b> en nuestras oficinas de <b>Valencia</b>.
            </>,
            <>
              <b>Coordinamos con el consulado</b> y te damos seguimiento hasta la
              respuesta.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              Si vas a visitar fábricas, ferias o proveedores en China,{" "}
              <b>necesitas el visado de negocios</b> — conocemos el trámite y te
              evitamos errores que retrasan tu viaje.
            </>,
            <>
              Todo el papeleo se resuelve <b>en Valencia</b>, en una sola oficina —
              hasta la foto.
            </>,
            <>
              El mismo equipo que te trae la carga <b>te prepara el viaje</b>.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              Tiempos del trámite: <b>urgente en 7 días</b> o{" "}
              <b>normal en 2 semanas</b>.
            </>,
            <>
              Los <b>requisitos que debes traer</b> te los pasamos por WhatsApp al
              agendar, según tu caso.
            </>,
            <>
              Nuestro honorario cubre <b>solo nuestra gestión</b>; la{" "}
              <b>tasa oficial del consulado se paga aparte, en bolívares</b> (mismo
              modelo que la aduana).
            </>,
            <>
              La <b>aprobación del visado la decide el consulado chino</b> — nuestro
              servicio llega hasta la preparación, la diligencia y la coordinación del
              trámite.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <PriceF2
          text={
            <>
              Honorario según la modalidad (urgente o normal) — cubre{" "}
              <b>solo nuestra gestión</b>.
            </>
          }
          sub="Consulta el monto con tu asesor · la tasa consular se paga aparte, en Bs."
          ctaLabel="Consulta el honorario con tu asesor"
          ctaHref={CTA("Hola DTD Cargo, quiero información sobre el visado de negocios chino.")}
        />
      </SecF2>
    </FichaF2>
  );
}

function RegistroDeMarca() {
  return (
    <FichaF2
      capa="tramites"
      hookAs="h2"
      chips={
        <>
          <ChipF2 variant="wine">Independiente — no depende de tu carga</ChipF2>
          <ChipF2>Activo</ChipF2>
        </>
      }
      hook="Tu marca es tuya — también en China."
      sub={
        <>
          La registramos ante la <b>CNIPA</b> para que nadie la copie ni la registre
          antes que tú. Todo el proceso lo gestionas{" "}
          <b>desde Venezuela, sin viajar</b>.
        </>
      }
      seal={{ top: "1–3 MESES", sub: "honorario único · todo incluido" }}
      route={{
        stops: [
          { lb: "Tu marca + rubro", sb: "por WhatsApp" },
          { lb: "Documentos", sb: "y traducciones · VE" },
          { lb: "Gestión CNIPA", sb: "en China" },
          { lb: "Registrada", sb: "seguimiento desde VE" },
        ],
        segs: [true, true, true],
        cap: [
          <b key="a">Tú no viajas ni tratas con nadie en China</b>,
          "DTD gestiona todo el proceso",
        ],
      }}
    >
      <SecF2 title="¿Qué es?">
        <p className="f2body">
          El registro de tu marca ante la <b>CNIPA</b> (la oficina de propiedad
          intelectual de China). Preparamos los documentos y las traducciones, te
          damos <b>asesoría estratégica y seguimiento desde Venezuela</b>, y
          coordinamos la <b>gestión legal en China</b>. El trámite final se hace allá,
          pero tú no viajas ni tratas con nadie en China:{" "}
          <b>DTD gestiona todo el proceso</b>.
        </p>
        <VersusF2>
          <VscardF2
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M12 3l7 3v5c0 4.4-3 8.2-7 9.5C8 19.2 5 15.4 5 11V6z" strokeDasharray="3 3" />
                <path d="M9 12l6-0.01M12 9v6" transform="rotate(45 12 12)" />
              </svg>
            }
            title="Sin registrar = expuesta"
          >
            Un tercero puede registrarla primero y <b>quedarse con ella</b> — el
            llamado <b>secuestro de marca</b> — o copiarla, justo en el país donde la
            producen.
          </VscardF2>
          <VscardF2 hero icon={<ShieldCheckIc />} title="Registrada = protegida">
            Fabricas en China <b>con tu marca en el empaque</b> y la marca queda a tu
            nombre ante la CNIPA.
          </VscardF2>
        </VersusF2>
      </SecF2>

      <SecF2 title="¿Cómo funciona?">
        <StepsF2
          steps={[
            <>
              Escríbenos por <b>WhatsApp</b> con tu <b>marca y tu rubro</b>.
            </>,
            <>
              Preparamos los <b>documentos y las traducciones</b> desde Venezuela, con
              asesoría estratégica.
            </>,
            <>
              Coordinamos la <b>gestión legal ante la CNIPA</b> en China.
            </>,
            <>
              Te damos <b>seguimiento del trámite</b> desde Venezuela hasta que tu
              marca quede registrada.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="¿Por qué te conviene?">
        <BenesF2
          items={[
            <>
              <b>Proteges tu marca antes de fabricar con ella.</b> Si no la registras
              en China, un tercero puede registrarla primero.
            </>,
            <>
              Fabricas en China con tu marca en el empaque,{" "}
              <b>sin dejarla expuesta</b> en el país donde la producen.
            </>,
            <>
              Todo el proceso <b>desde Venezuela</b>, con un solo interlocutor.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Reglas y condiciones">
        <RulesF2
          items={[
            <>
              El trámite final se hace <b>en China, ante la CNIPA</b>, pero DTD
              gestiona <b>todo el proceso desde Venezuela</b> — no necesitas viajar.
            </>,
            <>
              <b>El trámite puede durar de 1 a 3 meses.</b> Conviene iniciarlo antes
              de mandar a producir con tu marca.
            </>,
            <>
              La decisión final del registro la emite la <b>CNIPA</b> — nuestro
              servicio llega hasta la preparación, la presentación y el seguimiento del
              trámite hasta que tu marca quede registrada.
            </>,
          ]}
        />
      </SecF2>

      <SecF2 title="Precio" price>
        <PriceF2
          text={
            <>
              <b>Un solo honorario que cubre todo el trámite, incluida la tasa oficial
              de la CNIPA.</b>
            </>
          }
          sub="Consulta el monto vigente con tu asesor."
          ctaLabel="Consulta el honorario con tu asesor"
          ctaHref={CTA("Hola DTD Cargo, quiero registrar mi marca en China (CNIPA).")}
        />
      </SecF2>
    </FichaF2>
  );
}

/** Todas las fichas del hub, en orden por momento del viaje. */
export const HUB_FICHAS: { slug: string; node: ReactNode }[] = [
  // 01 · Origen
  { slug: "verificacion-de-proveedores", node: <VerificacionDeProveedores /> },
  { slug: "auditoria-de-calidad", node: <AuditoriaDeCalidad /> },
  { slug: "lab-testing", node: <LabTesting /> },
  { slug: "compra-asistida", node: <CompraAsistida /> },
  { slug: "pago-asistido", node: <PagoAsistido /> },
  // 02 · Recepción en bodega
  { slug: "pre-alerta", node: <PreAlerta /> },
  { slug: "validacion", node: <Validacion /> },
  { slug: "inspeccion-al-recibir", node: <InspeccionAlRecibir /> },
  { slug: "etiquetado-de-piezas", node: <EtiquetadoDePiezas /> },
  { slug: "hold", node: <Hold /> },
  { slug: "re-empaque", node: <ReEmpaque /> },
  // 03/04 · Trámites + transversales
  { slug: "transito-de-aduana", node: <TransitoDeAduana /> },
  { slug: "courier-de-muestras", node: <CourierDeMuestras /> },
  { slug: "visado-de-negocios", node: <VisadoDeNegocios /> },
  { slug: "registro-de-marca", node: <RegistroDeMarca /> },
];
