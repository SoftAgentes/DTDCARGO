import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { ENLACE_PRO, type IdBloque, type InicioSimple as Datos } from "@/lib/portal/simple/bloques";
import { PortalTrackingEnConstruccion } from "../../_components/PortalTrackingEnConstruccion";
import { Ayuda, Glosario } from "./Ayuda";
import { BloqueProveedor } from "./BloqueProveedor";
import { GuiaPortal } from "./GuiaPortal";

/**
 * SDD-0654 fase 2 · Inicio de la Vista simple (§6, AC-8, AC-9).
 *
 * Seis bloques numerados, siempre los mismos y en el mismo orden; un bloque sin
 * datos dice que no hay nada y enseña qué hacer. Nada se mueve: no hay tarjetas
 * que aparezcan arriba ni avisos que empujen el contenido; lo urgente entra en
 * «Lo que te toca hacer». Cada bloque enlaza a su pantalla de la Vista Pro.
 *
 * Colores (§6.3, EXC-0654-01): el vino claro solo en el botón principal, el
 * avatar y la parte «proveedor» del código; la selección en tinta; el saldo en
 * navy; el dorado solo en «Atención». Los tintes viven en `app/globals.css`
 * (bloque `.vs`).
 */
function fecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-VE", { day: "numeric", month: "short", timeZone: "UTC" });
  } catch {
    return "";
  }
}

function iniciales(nombre: string): string {
  return (nombre.trim()[0] ?? "").toUpperCase();
}

function Bloque({
  n,
  id,
  titulo,
  ancla,
  tinte = "ink",
  children,
}: {
  n: number;
  id: IdBloque;
  titulo: string;
  ancla?: string;
  tinte?: "ink" | "wine";
  children: ReactNode;
}) {
  const enlace = ENLACE_PRO[id];
  return (
    <section
      aria-labelledby={`vs-${id}`}
      data-guia={ancla}
      data-bloque={id}
      className="vs-bloque overflow-hidden rounded-[16px] border border-grey-200"
    >
      <header className={`vs-bloque-cabeza flex items-center gap-3 px-4 py-3 sm:px-5 ${tinte === "wine" ? "vs-tinte-wine" : ""}`}>
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-ink text-[15px] font-extrabold"
        >
          {n}
        </span>
        <h2 id={`vs-${id}`} className="text-[18px] font-extrabold leading-tight">
          {titulo}
        </h2>
      </header>
      <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">{children}</div>
      <footer className="border-t border-grey-200 px-4 py-3 sm:px-5">
        <Link href={enlace.href} className="text-[15px] font-bold text-ink underline underline-offset-2">
          {enlace.texto}
        </Link>
      </footer>
    </section>
  );
}

export function InicioSimple({ datos, guiaVista }: { datos: Datos; guiaVista: boolean }) {
  const { saludo, donde, tareas, saldo, papeles, proveedores, asesor } = datos;

  return (
    <div className="vs mx-auto flex max-w-[760px] flex-col gap-4">
      {/* Saludo */}
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="vs-avatar inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[19px] font-extrabold"
        >
          {iniciales(saludo.nombre)}
        </span>
        <div className="min-w-0">
          <h1 className="text-[24px] font-extrabold leading-tight">Hola, {saludo.nombre}.</h1>
          <p className="mt-1 text-[15px] leading-[1.55] text-grey-700">
            Esto es lo importante de tu cuenta hoy. Siempre en este mismo orden.
          </p>
          <p className="vs-tinte-ink mt-2 inline-flex flex-wrap items-center gap-2 rounded-[10px] px-3 py-1.5 text-[14px]">
            <span className="font-bold">Tu Shipping Mark</span>
            <span className="font-mono font-bold text-ink">
              {saludo.markbox}
            </span>
          </p>
        </div>
      </header>

      {/* 1 · ¿Dónde está tu carga? */}
      <Bloque n={1} id="donde" titulo="¿Dónde está tu carga?" ancla="donde">
        {donde.principal ? (
          <>
            <p className="text-[14px] text-grey-700">
              <span className="font-mono font-bold text-ink">{donde.principal.code}</span>
              {donde.principal.servicio ? ` · ${donde.principal.servicio}` : ""}
            </p>
            {donde.principal.frase ? (
              <p className="text-[18px] font-extrabold leading-snug">{donde.principal.frase}</p>
            ) : (
              <p className="text-[15px] leading-[1.55]">
                Ahora no podemos mostrarte en qué va. Mira el detalle en la Vista Pro.
              </p>
            )}
            {donde.principal.ruta && (
              <ol className="grid grid-cols-5 gap-1" aria-label="Ruta de tu carga">
                {donde.principal.ruta.map((e) => (
                  <li
                    key={e.id}
                    aria-current={e.estado === "actual" ? "step" : undefined}
                    className="flex flex-col items-center gap-1 text-center text-[12px] leading-tight"
                  >
                    <span
                      aria-hidden="true"
                      className={`h-3 w-3 rounded-full border-2 border-ink ${e.estado === "pendiente" ? "" : "bg-ink"}`}
                    />
                    <span className={e.estado === "actual" ? "font-extrabold" : "text-grey-700"}>{e.nombre}</span>
                  </li>
                ))}
              </ol>
            )}
            {donde.enConstruccion && <PortalTrackingEnConstruccion />}
            {donde.principal.etaIso && (
              <p className="text-[15px]">
                Llegada estimada: <b>{fecha(donde.principal.etaIso)}</b>
              </p>
            )}
            {donde.principal.etaIso && (
              <Ayuda tipo="recuerda">
                La fecha de llegada es un estimado. Si la naviera la mueve, la cambiamos aquí mismo.
              </Ayuda>
            )}
            <div>
              <Link
                href={`/portal/envios/${encodeURIComponent(donde.principal.code)}`}
                className="vs-btn-principal"
              >
                Ver el detalle de este envío
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-[18px] font-extrabold leading-snug">Todavía no tienes envíos en camino.</p>
            {donde.enConstruccion && <PortalTrackingEnConstruccion />}
            <Ayuda tipo="consejo">
              Cuando le compres a un proveedor, avísanos la compra con «Nueva compra». Así sabemos que la caja es tuya
              apenas llegue.
            </Ayuda>
            <div>
              <Link href="/portal/compras/nueva" className="vs-btn-principal">
                Avisar una compra
              </Link>
            </div>
          </>
        )}
        {donde.otros.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-grey-700">Tus otros envíos</h3>
            <ul className="flex flex-col gap-1">
              {donde.otros.map((o) => (
                <li key={o.code} className="text-[15px] leading-[1.5]">
                  <span className="font-mono font-bold">{o.code}</span>
                  {o.servicio ? ` · ${o.servicio}` : ""}
                  {o.frase ? <span className="text-grey-700"> — {o.frase}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Glosario id="consolidado" />
      </Bloque>

      {/* 2 · Lo que te toca hacer */}
      <Bloque n={2} id="tareas" titulo="Lo que te toca hacer" ancla="tareas">
        {tareas.length === 0 ? (
          <>
            <p className="text-[18px] font-extrabold leading-snug">No tienes nada pendiente.</p>
            <p className="text-[15px] leading-[1.55] text-grey-700">
              Si falta un papel o un pago, aparece aquí con su botón.
            </p>
          </>
        ) : (
          <ul className="flex flex-col gap-3">
            {tareas.map((t, i) => (
              <li key={t.id} className="flex flex-col gap-1.5">
                <b className="text-[16px]">{t.titulo}</b>
                <p className="text-[15px] leading-[1.55] text-grey-700">{t.texto}</p>
                <div>
                  <Link href={t.href} className={i === 0 ? "vs-btn-principal" : "vs-btn-secundario"}>
                    {t.accion}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Bloque>

      {/* 3 · Cuánto debes */}
      <Bloque n={3} id="saldo" titulo="Cuánto debes">
        {!saldo.disponible ? (
          <p className="text-[15px] leading-[1.55]">Ahora no pudimos leer tus facturas. Intenta más tarde.</p>
        ) : saldo.debe ? (
          <>
            <p className="font-mono text-[28px] font-extrabold leading-none text-ink">{saldo.monto}</p>
            <p className="text-[15px] text-grey-700">
              {saldo.facturasPorPagar === 1 ? "1 factura por pagar" : `${saldo.facturasPorPagar} facturas por pagar`}
            </p>
            {saldo.variasMonedas && (
              <Ayuda tipo="recuerda">Tienes facturas en más de una moneda. El detalle está en tus facturas.</Ayuda>
            )}
            <Ayuda tipo="consejo">
              Cuando pagues, repórtalo con tu comprobante. Te avisamos cuando lo confirmemos.
            </Ayuda>
            <div>
              <Link href="/portal/facturas" className="vs-btn-principal">
                Reportar un pago
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-[18px] font-extrabold leading-snug">Estás al día.</p>
            <p className="text-[15px] leading-[1.55] text-grey-700">No tienes facturas por pagar.</p>
          </>
        )}
      </Bloque>

      {/* 4 · Tus papeles */}
      <Bloque n={4} id="papeles" titulo="Tus papeles">
        {papeles.bloqueado ? (
          <>
            <p className="text-[15px] leading-[1.55]">Completa tu perfil para ver tus papeles.</p>
            <div>
              <Link href="/portal/perfil" className="vs-btn-principal">
                Completar mi perfil
              </Link>
            </div>
          </>
        ) : papeles.ultimos.length === 0 ? (
          <p className="text-[15px] leading-[1.55]">
            Todavía no tienes papeles. Aquí verás tus facturas, la lista de empaque y las fotos de tu carga.
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-1.5">
              {papeles.ultimos.map((d) => (
                <li key={d.id} className="text-[15px] leading-[1.5]">
                  <b className="break-words">{d.nombre}</b>
                  <span className="text-grey-700">
                    {" "}
                    · {d.tipo}
                    {d.envio ? ` · ${d.envio}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <div>
              <Link href="/portal/documentos" className="vs-btn-principal">
                Ver y descargar
              </Link>
            </div>
          </>
        )}
        <Glosario id="packing-list" />
      </Bloque>

      {/* 5 · ¿Vas a comprar en China? */}
      <Bloque
        n={5}
        id="proveedor"
        titulo="¿Vas a comprar en China? Envíale esto a tu proveedor"
        ancla="proveedor"
        tinte="wine"
      >
        <BloqueProveedor proveedores={proveedores} markbox={saludo.markbox} />
      </Bloque>

      {/* 6 · ¿Te quedó una duda? */}
      <Bloque n={6} id="duda" titulo="¿Te quedó una duda?" ancla="duda">
        <p className="text-[15px] leading-[1.55]">
          {asesor
            ? `Escríbele a ${asesor.nombre}${asesor.cargo ? `, ${asesor.cargo.toLowerCase()}` : ""}. Te atiende en horario de oficina y, para cambios en tu cuenta, es la persona.`
            : "Escríbenos por el chat. Te atendemos en horario de oficina."}
        </p>
        <div>
          <Link href="/portal/soporte" className="vs-btn-principal">
            Abrir el chat
          </Link>
        </div>
      </Bloque>

      <Suspense fallback={null}>
        <GuiaPortal guiaVista={guiaVista} />
      </Suspense>
    </div>
  );
}
