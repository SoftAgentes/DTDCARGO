// ──────────────────────────────────────────────────────────────────
// GEO-ZONAS — páginas locales "Importar de China a {zona}"
// ──────────────────────────────────────────────────────────────────
// Contenido GENUINO por zona (no doorway pages): cada una consolida ciudad +
// estado y describe la entrega con datos reales (km desde la bodega de Valencia,
// casco central, municipios reales). Generado y verificado adversarialmente
// (sin datos inventados, sin texto duplicable). Fuente única para el template
// app/importar-de-china/[ciudad]/page.tsx, el sitemap y los links internos.
//
// Para sumar una zona: agregá un objeto acá (con su contenido verificado) — la
// ruta, el sitemap y los cross-links se generan solos.

export type GeoZona = {
  /** Slug = segmento de URL (/importar-de-china/{slug}) y key. */
  slug: string;
  /** Ciudad principal (la más buscada). */
  ciudad: string;
  /** Estado que también cubre (para capturar ambas keywords). */
  estado: string;
  /** Km desde la bodega de Valencia (de lib/calculadora). */
  km: number;
  /** Si entra en el flat del casco central (sin recargo por distancia). */
  casco: boolean;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  /** 1-2 frases específicas de la zona (municipios reales, no plantilla). */
  anguloLocal: string;
  /** 1 frase sobre la entrega según km/casco. */
  notaEntrega: string;
};

export const GEO_ZONAS: GeoZona[] = [
  {
    slug: "valencia",
    ciudad: "Valencia",
    estado: "Carabobo",
    km: 0,
    casco: true,
    metaTitle: "Importar de China a Valencia, Carabobo | DTD Cargo",
    metaDescription:
      "Importar de China a Valencia, estado Carabobo: carga consolidada DDP puerta a puerta. Bodega propia en la ciudad, entrega sin recargo y pagás cuando llega.",
    h1: "Importar de China a Valencia (Carabobo)",
    anguloLocal:
      "Valencia es nuestra casa: la bodega propia está aquí mismo, a 0 km de tu puerta. Recibimos tu carga de China y la entregamos en el casco central de Valencia, Naguanagua o San Diego sin recargo por distancia, y movemos también para Guacara, Los Guayos y Puerto Cabello.",
    notaEntrega:
      "Al estar nuestra bodega en la propia Valencia, entregamos en el casco central a 0 km, sin recargo por distancia.",
  },
  {
    slug: "maracay",
    ciudad: "Maracay",
    estado: "Aragua",
    km: 70,
    casco: true,
    metaTitle: "Importar de China a Maracay, Aragua | DTD Cargo",
    metaDescription:
      "Importar de China a Maracay, estado Aragua: carga consolidada DDP puerta a puerta, financiamiento 100% e inspección en fábrica. Pagás cuando llega.",
    h1: "Importar de China a Maracay (Aragua)",
    anguloLocal:
      "Maracay y todo el eje de Aragua mueven mercancía china a diario: el comercio del centro, los repuestos de Turmero y la distribución que sube por Cagua y La Victoria. Desde nuestra bodega en Valencia, a 70 km, la zona nos queda al lado, así que tu carga consolidada llega rápido y sin las vueltas de un intermediario remoto.",
    notaEntrega:
      "Maracay entra en nuestro casco central de entrega: a 70 km de la bodega de Valencia, dejamos tu carga en el casco central sin recargo por distancia.",
  },
  {
    slug: "maracaibo",
    ciudad: "Maracaibo",
    estado: "Zulia",
    km: 410,
    casco: false,
    metaTitle: "Importar de China a Maracaibo, Zulia | DTD Cargo",
    metaDescription:
      "Importar de China a Maracaibo, Zulia: carga consolidada DDP puerta a puerta. Pagás cuando llega, inspección en fábrica y last-mile hasta tu puerta.",
    h1: "Importar de China a Maracaibo, Zulia",
    anguloLocal:
      "El Zulia mueve comercio fuerte: desde los mayoristas de Maracaibo y San Francisco hasta los proveedores de la zona petrolera de Cabimas y Ciudad Ojeda, traer mercancía de China consolidada te baja el costo por kilo frente a comprar suelto. Nosotros movemos tu carga desde Yiwu hasta el lago, con el last-mile coordinado al municipio que sea.",
    notaEntrega:
      "Maracaibo está a 410 km de nuestra bodega en Valencia, fuera del casco central, así que coordinamos el last-mile hasta tu puerta y el recargo por km lo ves al instante en la calculadora.",
  },
  {
    slug: "caracas",
    ciudad: "Caracas",
    estado: "Distrito Capital y Miranda",
    km: 150,
    casco: true,
    metaTitle: "Importar de China a Caracas y Miranda | DTD Cargo",
    metaDescription:
      "Importar de China a Caracas, Distrito Capital y Miranda: carga consolidada DDP puerta a puerta, financiamiento 100% y entrega en el casco central.",
    h1: "Importar de China a Caracas (Distrito Capital y Miranda)",
    anguloLocal:
      "Caracas no es una sola jurisdicción: tu carga puede ir al casco de Libertador en el Distrito Capital o cruzar a Miranda hacia Chacao, Baruta o Petare, y nosotros coordinamos el last-mile a cualquiera de esos municipios sin que tengas que mover un dedo. También llegamos al eje Guarenas-Guatire y a Los Teques cuando tu proveedor en China despacha hacia la Gran Caracas.",
    notaEntrega:
      "Caracas entra en nuestro casco central de entrega: a 150 km de nuestra bodega de Valencia, llevamos tu carga hasta tu puerta sin recargo por distancia.",
  },
  {
    slug: "barquisimeto",
    ciudad: "Barquisimeto",
    estado: "Lara",
    km: 220,
    casco: false,
    metaTitle: "Importar de China a Barquisimeto (Lara) | DTD Cargo",
    metaDescription:
      "Importar de China a Barquisimeto, Lara: carga consolidada DDP puerta a puerta, financiamiento 100% (pagás cuando llega) e inspección en fábrica.",
    h1: "Importar de China a Barquisimeto, estado Lara",
    anguloLocal:
      "Barquisimeto es el punto de distribución del centro-occidente, así que mucha de la carga que traemos de China termina surtiendo comercios y talleres de Cabudare, Quíbor y El Tocuyo. Consolidamos tu mercancía en Yiwu y la movemos en LCL hasta la zona, sin que tengas que armar contenedor completo.",
    notaEntrega:
      "Barquisimeto queda a 220 km de nuestra bodega en Valencia, fuera del casco central, así que coordinamos el last-mile hasta tu puerta con un recargo por km que ves al instante en la calculadora.",
  },
  {
    slug: "puerto-la-cruz",
    ciudad: "Puerto La Cruz",
    estado: "Anzoátegui",
    km: 430,
    casco: false,
    metaTitle: "Importar de China a Puerto La Cruz, Anzoátegui | DTD Cargo",
    metaDescription:
      "Importar de China a Puerto La Cruz y Barcelona, Anzoátegui: carga consolidada DDP puerta a puerta, financiamiento 100% y last-mile a tu puerta.",
    h1: "Importar de China a Puerto La Cruz (Anzoátegui)",
    anguloLocal:
      "Puerto La Cruz no se mueve sola: forma un solo eje urbano con Barcelona, Lechería y Guanta, y entre las cuatro concentran el comercio costero de Anzoátegui. Buena parte de la carga que traemos de China surte las tiendas de la zona y baja también hacia El Tigre y Anaco, en el sur del estado. Nosotros consolidamos tu mercancía en Yiwu y la movemos en LCL hasta la costa oriental, sin las vueltas de un intermediario remoto.",
    notaEntrega:
      "Puerto La Cruz está a 430 km de nuestra bodega en Valencia, fuera del casco central, así que coordinamos el last-mile hasta tu puerta y el recargo por km lo ves al instante en la calculadora.",
  },
  {
    slug: "maturin",
    ciudad: "Maturín",
    estado: "Monagas",
    km: 650,
    casco: false,
    metaTitle: "Importar de China a Maturín, Monagas | DTD Cargo",
    metaDescription:
      "Importar de China a Maturín, estado Monagas: carga consolidada DDP puerta a puerta, financiamiento 100% (pagás cuando llega) e inspección en fábrica.",
    h1: "Importar de China a Maturín (Monagas)",
    anguloLocal:
      "Maturín es el motor comercial del oriente: la capital de Monagas surte los comercios del centro, los repuestos de la zona petrolera de Punta de Mata y Caripito, y la distribución que sube hacia Caripe y Temblador. Consolidamos tu carga en Yiwu y la traemos en LCL hasta el oriente, sin que tengas que armar un contenedor completo ni depender de un intermediario remoto.",
    notaEntrega:
      "Maturín queda a unos 650 km de nuestra bodega en Valencia, fuera del casco central, así que coordinamos el last-mile hasta tu puerta con un recargo por km que ves al instante en la calculadora.",
  },
  {
    slug: "puerto-ordaz",
    ciudad: "Puerto Ordaz",
    estado: "Bolívar",
    km: 770,
    casco: false,
    metaTitle: "Importar de China a Puerto Ordaz, Bolívar | DTD Cargo",
    metaDescription:
      "Importar de China a Puerto Ordaz y Ciudad Guayana, Bolívar: carga consolidada DDP puerta a puerta, financiamiento 100% e inspección en fábrica.",
    h1: "Importar de China a Puerto Ordaz (Bolívar)",
    anguloLocal:
      "Puerto Ordaz y San Félix forman Ciudad Guayana, el polo industrial pesado del sur: siderúrgica, aluminio y minería mueven una demanda constante de insumos, maquinaria y repuestos que muchas veces salen de China. Traemos tu carga consolidada desde Yiwu hasta Guayana y coordinamos también la entrega hacia Ciudad Bolívar y Upata cuando tu proveedor despacha hacia el estado.",
    notaEntrega:
      "Puerto Ordaz es uno de los destinos más lejanos que cubrimos, a 770 km de nuestra bodega en Valencia y fuera del casco central, así que coordinamos el last-mile hasta tu puerta con el recargo por km que ves al instante en la calculadora.",
  },
  {
    slug: "san-cristobal",
    ciudad: "San Cristóbal",
    estado: "Táchira",
    km: 580,
    casco: false,
    metaTitle: "Importar de China a San Cristóbal, Táchira | DTD Cargo",
    metaDescription:
      "Importar de China a San Cristóbal, estado Táchira: carga consolidada DDP puerta a puerta, financiamiento 100% (pagás cuando llega) e inspección en fábrica.",
    h1: "Importar de China a San Cristóbal (Táchira)",
    anguloLocal:
      "San Cristóbal es el corazón comercial de los Andes y la puerta de la frontera: la capital de Táchira surte tiendas y talleres de Táriba, La Concordia y todo el eje que baja hacia San Antonio y Ureña. Traer tu mercancía de China consolidada te conviene frente a comprar suelto del otro lado de la frontera, y nosotros movemos tu carga desde Yiwu hasta el Táchira con el last-mile coordinado al municipio que sea.",
    notaEntrega:
      "San Cristóbal queda a 580 km de nuestra bodega en Valencia, fuera del casco central, así que coordinamos el last-mile hasta tu puerta con un recargo por km que ves al instante en la calculadora.",
  },
  {
    slug: "merida",
    ciudad: "Mérida",
    estado: "Mérida",
    km: 520,
    casco: false,
    metaTitle: "Importar de China a Mérida | DTD Cargo",
    metaDescription:
      "Importar de China a Mérida, estado Mérida: carga consolidada DDP puerta a puerta, financiamiento 100% (pagás cuando llega) e inspección en fábrica.",
    h1: "Importar de China a Mérida (estado Mérida)",
    anguloLocal:
      "Mérida mezcla la ciudad universitaria de los Andes con el comercio agrícola que baja por El Vigía y Ejido: desde insumos y herramientas hasta lo que surte las tiendas del casco merideño, mucho de eso sale de China. Consolidamos tu mercancía en Yiwu y la traemos en LCL hasta la cordillera, sin que tengas que armar un contenedor completo ni depender de un intermediario remoto.",
    notaEntrega:
      "Mérida queda a 520 km de nuestra bodega en Valencia, fuera del casco central, así que coordinamos el last-mile hasta tu puerta con un recargo por km que ves al instante en la calculadora.",
  },
  {
    slug: "punto-fijo",
    ciudad: "Punto Fijo",
    estado: "Falcón",
    km: 290,
    casco: false,
    metaTitle: "Importar de China a Punto Fijo, Falcón | DTD Cargo",
    metaDescription:
      "Importar de China a Punto Fijo y Paraguaná, Falcón: carga consolidada DDP puerta a puerta, financiamiento 100% y last-mile a tu puerta.",
    h1: "Importar de China a Punto Fijo (Falcón)",
    anguloLocal:
      "Punto Fijo es el polo comercial de la península de Paraguaná, y junto con Punta Cardón y Los Taques concentra buena parte del movimiento del estado; más al sur, Coro suma el comercio de la capital falconiana. Mucha de la carga que traemos de China surte esas tiendas, y nosotros consolidamos tu mercancía en Yiwu y la movemos en LCL hasta Falcón.",
    notaEntrega:
      "Punto Fijo está a 290 km de nuestra bodega en Valencia, fuera del casco central, así que coordinamos el last-mile hasta tu puerta y el recargo por km lo ves al instante en la calculadora.",
  },
  {
    slug: "coro",
    ciudad: "Coro",
    estado: "Falcón",
    km: 260,
    casco: false,
    metaTitle: "Importar de China a Coro, Falcón | DTD Cargo",
    metaDescription:
      "Importar de China a Coro (Santa Ana de Coro), Falcón: carga consolidada DDP puerta a puerta, financiamiento 100% e inspección en fábrica.",
    h1: "Importar de China a Coro (Falcón)",
    anguloLocal:
      "Coro, la capital de Falcón, mueve el comercio del norte del estado: desde el casco histórico de Santa Ana de Coro hasta La Vela y el eje que conecta con la península, las tiendas se surten de mercancía que muchas veces llega de China. Consolidamos tu carga en Yiwu y la traemos en LCL hasta Falcón, sin que tengas que armar un contenedor completo ni depender de un intermediario remoto.",
    notaEntrega:
      "Coro queda a 260 km de nuestra bodega en Valencia, fuera del casco central, así que coordinamos el last-mile hasta tu puerta con un recargo por km que ves al instante en la calculadora.",
  },
  {
    slug: "margarita",
    ciudad: "Isla Margarita",
    estado: "Nueva Esparta",
    km: 540,
    casco: false,
    metaTitle: "Importar de China a Isla Margarita | DTD Cargo",
    metaDescription:
      "Importar de China a Isla Margarita (Porlamar), Nueva Esparta: carga consolidada DDP puerta a puerta. Coordinamos el cruce a la isla y entregamos en tu puerta.",
    h1: "Importar de China a Isla Margarita (Nueva Esparta)",
    anguloLocal:
      "Margarita vive del comercio: Porlamar, Pampatar y La Asunción concentran tiendas que se surten todo el año, y mucho de eso llega de China. Como es una isla, el last-mile incluye el cruce en ferry desde tierra firme, y nosotros lo coordinamos para que tu mercancía consolidada en Yiwu termine en tu puerta en Nueva Esparta sin que tengas que mover un dedo.",
    notaEntrega:
      "Isla Margarita está a unos 540 km de nuestra bodega en Valencia contando el cruce a la isla, fuera del casco central, así que coordinamos el last-mile —ferry incluido— y el recargo por distancia lo ves al instante en la calculadora.",
  },
  {
    slug: "ciudad-bolivar",
    ciudad: "Ciudad Bolívar",
    estado: "Bolívar",
    km: 700,
    casco: false,
    metaTitle: "Importar de China a Ciudad Bolívar | DTD Cargo",
    metaDescription:
      "Importar de China a Ciudad Bolívar, estado Bolívar: carga consolidada DDP puerta a puerta, financiamiento 100% e inspección en fábrica.",
    h1: "Importar de China a Ciudad Bolívar (Bolívar)",
    anguloLocal:
      "Ciudad Bolívar, capital del estado, es el paso histórico del Orinoco y centro de servicios del sur: su comercio surte tanto a la ciudad como a las poblaciones que dependen de ella a lo largo del río. Traemos tu carga consolidada desde Yiwu hasta el estado Bolívar y coordinamos también la entrega hacia Ciudad Guayana cuando tu proveedor despacha hacia la región.",
    notaEntrega:
      "Ciudad Bolívar queda a 700 km de nuestra bodega en Valencia, fuera del casco central, así que coordinamos el last-mile hasta tu puerta con un recargo por km que ves al instante en la calculadora.",
  },
];

export function getGeoZona(slug: string): GeoZona | null {
  return GEO_ZONAS.find((z) => z.slug === slug) ?? null;
}
