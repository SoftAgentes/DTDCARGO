// ──────────────────────────────────────────────────────────────────
// GEO-ZONAS — páginas locales "Importar de China a {zona}"
// ──────────────────────────────────────────────────────────────────
// Contenido GENUINO por zona (no doorway pages): cada una consolida ciudad +
// estado y describe la entrega con datos reales (municipios reales, cómo se
// cobra el tramo nacional). Generado y verificado adversarialmente (sin datos
// inventados, sin texto duplicable). Fuente única para el template
// app/importar-de-china/[ciudad]/page.tsx, el sitemap y los links internos.
//
// ⚠️ EL COPY YA NO HABLA DE KILÓMETROS (SDD-0237, founder 1-ago-2026).
//    La entrega nacional se cobra por METRO CÚBICO: murió `max(0, km−200) × $1`
//    y con ella el "casco central" de cara al cliente. Seguir escribiendo "a 410
//    km de nuestra bodega, fuera del casco central" insinúa un cobro por
//    distancia que ya no existe. El término que se usa ahora es
//    **"entrega incluida"** para la zona sin costo, y "se cobra por metro
//    cúbico" para el resto.
//
// Para sumar una zona: agrega un objeto acá (con su contenido verificado) — la
// ruta, el sitemap y los cross-links se generan solos.

export type GeoZona = {
  /** Slug = segmento de URL (/importar-de-china/{slug}) y key. */
  slug: string;
  /** Ciudad principal (la más buscada). */
  ciudad: string;
  /** Estado que también cubre (para capturar ambas keywords). */
  estado: string;
  /**
   * Km desde la bodega de Valencia.
   *
   * ⚠️ Ya NO fija precio y NO se cita en el copy (SDD-0237). Sobrevive porque
   * ordena el índice de `/importar-de-china` (de la más cercana hacia afuera),
   * que es un criterio de navegación, no de precio.
   */
  km: number;
  /**
   * Zona sin costo: la entrega nacional va **incluida** ($0 para el cliente).
   * Espeja el flag `casco` de `lib/data/destinos-nacionales.ts` — son las 7
   * ciudades que decidió el founder, y DTD sí le paga ese tramo al fletero.
   */
  casco: boolean;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  /** 1-2 frases específicas de la zona (municipios reales, no plantilla). */
  anguloLocal: string;
  /** 1 frase sobre cómo se cobra la entrega en esa zona. */
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
      "Importar de China a Valencia, estado Carabobo: carga consolidada puerta a puerta. Bodega propia en la ciudad, entrega incluida y pagas cuando llega.",
    h1: "Importar de China a Valencia (Carabobo)",
    anguloLocal:
      "Valencia es nuestra casa: la bodega propia está aquí mismo. Recibimos tu carga de China y la entregamos en Valencia, Naguanagua o San Diego con la entrega incluida, y movemos también para Guacara, Los Guayos y Puerto Cabello.",
    notaEntrega:
      "Como nuestra bodega está en la propia Valencia, la entrega va incluida: no pagas nada por el tramo nacional, ni en la ciudad ni en Naguanagua, San Diego o Guacara.",
  },
  {
    slug: "maracay",
    ciudad: "Maracay",
    estado: "Aragua",
    km: 70,
    casco: true,
    metaTitle: "Importar de China a Maracay, Aragua | DTD Cargo",
    metaDescription:
      "Importar de China a Maracay, estado Aragua: carga consolidada puerta a puerta con entrega incluida. Pagas cuando llega.",
    h1: "Importar de China a Maracay (Aragua)",
    anguloLocal:
      "Maracay y todo el eje de Aragua mueven mercancía china a diario: el comercio del centro, los repuestos de Turmero y la distribución que sube por Cagua y La Victoria. Desde nuestra bodega en Valencia la zona nos queda al lado, así que tu carga consolidada llega rápido y con un solo equipo responsable de punta a punta.",
    notaEntrega:
      "Maracay es una de las ciudades donde la entrega va incluida: recibes tu carga en tu puerta sin pagar nada por el tramo nacional.",
  },
  {
    slug: "maracaibo",
    ciudad: "Maracaibo",
    estado: "Zulia",
    km: 410,
    casco: false,
    metaTitle: "Importar de China a Maracaibo, Zulia | DTD Cargo",
    metaDescription:
      "Importar de China a Maracaibo, Zulia: carga consolidada puerta a puerta. Pagas cuando llega, inspección en fábrica y last-mile hasta tu puerta.",
    h1: "Importar de China a Maracaibo, Zulia",
    anguloLocal:
      "El Zulia mueve comercio fuerte: desde los mayoristas de Maracaibo y San Francisco hasta los proveedores de la zona petrolera de Cabimas y Ciudad Ojeda, traer mercancía de China consolidada te baja el costo por kilo frente a comprar suelto. Nosotros movemos tu carga desde Yiwu hasta el lago, con el last-mile coordinado al municipio que sea.",
    notaEntrega:
      "En Maracaibo la entrega nacional se cobra por metro cúbico —según el volumen de tu carga, no según la distancia—, así que la calculadora te da el estimado al instante y tu asesor te confirma el número final por WhatsApp.",
  },
  {
    slug: "caracas",
    ciudad: "Caracas",
    estado: "Distrito Capital y Miranda",
    km: 150,
    casco: true,
    metaTitle: "Importar de China a Caracas y Miranda | DTD Cargo",
    metaDescription:
      "Importar de China a Caracas, Distrito Capital y Miranda: carga consolidada puerta a puerta, pagas al llegar y entrega incluida.",
    h1: "Importar de China a Caracas (Distrito Capital y Miranda)",
    anguloLocal:
      "Caracas no es una sola jurisdicción: tu carga puede ir al casco de Libertador en el Distrito Capital o cruzar a Miranda hacia Chacao, Baruta o Petare, y nosotros coordinamos el last-mile a cualquiera de esos municipios sin que tengas que mover un dedo. También llegamos al eje Guarenas-Guatire y a Los Teques cuando tu proveedor en China despacha hacia la Gran Caracas.",
    notaEntrega:
      "Caracas es una de las ciudades donde la entrega va incluida: llevamos tu carga hasta tu puerta sin cobrarte el tramo nacional.",
  },
  {
    slug: "barquisimeto",
    ciudad: "Barquisimeto",
    estado: "Lara",
    km: 220,
    // Zona sin costo desde el 1-ago-2026 (SDD-0237). Antes decía `false` y esta
    // landing seguía mandando al cliente a preguntarle el precio al asesor por
    // un tramo que ya no le cobramos.
    casco: true,
    metaTitle: "Importar de China a Barquisimeto (Lara) | DTD Cargo",
    metaDescription:
      "Importar de China a Barquisimeto, Lara: carga consolidada puerta a puerta con entrega incluida, pagas al llegar e inspección en fábrica.",
    h1: "Importar de China a Barquisimeto, estado Lara",
    anguloLocal:
      "Barquisimeto es el punto de distribución del centro-occidente, así que mucha de la carga que traemos de China termina surtiendo comercios y talleres de Cabudare, Quíbor y El Tocuyo. Consolidamos tu mercancía en Yiwu y la movemos en LCL hasta la zona, sin que tengas que armar contenedor completo.",
    notaEntrega:
      "Barquisimeto es una de las ciudades donde la entrega va incluida: no te cobramos el tramo nacional hasta la ciudad. Para Cabudare, Quíbor o El Tocuyo el tramo se cobra por metro cúbico y lo estimas en la calculadora.",
  },
  {
    slug: "puerto-la-cruz",
    ciudad: "Puerto La Cruz",
    estado: "Anzoátegui",
    km: 430,
    casco: false,
    metaTitle: "Importar de China a Puerto La Cruz, Anzoátegui | DTD Cargo",
    metaDescription:
      "Importar de China a Puerto La Cruz y Barcelona, Anzoátegui: carga consolidada puerta a puerta, pagas al llegar y last-mile a tu puerta.",
    h1: "Importar de China a Puerto La Cruz (Anzoátegui)",
    anguloLocal:
      "Puerto La Cruz no se mueve sola: forma un solo eje urbano con Barcelona, Lechería y Guanta, y entre las cuatro concentran el comercio costero de Anzoátegui. Buena parte de la carga que traemos de China surte las tiendas de la zona y baja también hacia El Tigre y Anaco, en el sur del estado. Nosotros consolidamos tu mercancía en Yiwu y la movemos en LCL hasta la costa oriental, con un solo equipo responsable de tu carga de punta a punta.",
    notaEntrega:
      "En Puerto La Cruz la entrega nacional se cobra por metro cúbico: pagas por el volumen que ocupa tu carga, y el mismo precio aplica en Barcelona, Lechería o Guanta. Lo estimas en la calculadora y tu asesor te confirma el final.",
  },
  {
    slug: "maturin",
    ciudad: "Maturín",
    estado: "Monagas",
    km: 650,
    casco: false,
    metaTitle: "Importar de China a Maturín, Monagas | DTD Cargo",
    metaDescription:
      "Importar de China a Maturín, estado Monagas: carga consolidada puerta a puerta, pagas al llegar e inspección en fábrica.",
    h1: "Importar de China a Maturín (Monagas)",
    anguloLocal:
      "Maturín es el motor comercial del oriente: la capital de Monagas surte los comercios del centro, los repuestos de la zona petrolera de Punta de Mata y Caripito, y la distribución que sube hacia Caripe y Temblador. Consolidamos tu carga en Yiwu y la traemos en LCL hasta el oriente, sin que tengas que armar un contenedor completo y con un solo equipo respondiendo por tu carga de punta a punta.",
    notaEntrega:
      "En Maturín la entrega nacional se cobra por metro cúbico, así que el precio depende del volumen de tu carga y no de lo lejos que quede el oriente. La calculadora te lo estima al instante.",
  },
  {
    slug: "puerto-ordaz",
    ciudad: "Puerto Ordaz",
    estado: "Bolívar",
    km: 770,
    casco: false,
    metaTitle: "Importar de China a Puerto Ordaz, Bolívar | DTD Cargo",
    metaDescription:
      "Importar de China a Puerto Ordaz y Ciudad Guayana, Bolívar: carga consolidada puerta a puerta, pagas al llegar e inspección en fábrica.",
    h1: "Importar de China a Puerto Ordaz (Bolívar)",
    anguloLocal:
      "Puerto Ordaz y San Félix forman Ciudad Guayana, el polo industrial pesado del sur: siderúrgica, aluminio y minería mueven una demanda constante de insumos, maquinaria y repuestos que muchas veces salen de China. Traemos tu carga consolidada desde Yiwu hasta Guayana y coordinamos también la entrega hacia Ciudad Bolívar y Upata cuando tu proveedor despacha hacia el estado.",
    notaEntrega:
      "Puerto Ordaz es de los destinos más lejanos que cubrimos, pero la entrega nacional se cobra por metro cúbico igual que en el resto del país: paga el volumen de tu carga, no la distancia. Lo estimas en la calculadora.",
  },
  {
    slug: "san-cristobal",
    ciudad: "San Cristóbal",
    estado: "Táchira",
    km: 580,
    casco: false,
    metaTitle: "Importar de China a San Cristóbal, Táchira | DTD Cargo",
    metaDescription:
      "Importar de China a San Cristóbal, estado Táchira: carga consolidada puerta a puerta, pagas al llegar e inspección en fábrica.",
    h1: "Importar de China a San Cristóbal (Táchira)",
    anguloLocal:
      "San Cristóbal es el corazón comercial de los Andes y la puerta de la frontera: la capital de Táchira surte tiendas y talleres de Táriba, La Concordia y todo el eje que baja hacia San Antonio y Ureña. Traer tu mercancía de China consolidada te conviene frente a comprar suelto del otro lado de la frontera, y nosotros movemos tu carga desde Yiwu hasta el Táchira con el last-mile coordinado al municipio que sea.",
    notaEntrega:
      "En San Cristóbal la entrega nacional se cobra por metro cúbico, y el mismo precio aplica bajando hacia Táriba o San Antonio. La calculadora te da el estimado antes de que hables con nadie.",
  },
  {
    slug: "merida",
    ciudad: "Mérida",
    estado: "Mérida",
    km: 520,
    casco: false,
    metaTitle: "Importar de China a Mérida | DTD Cargo",
    metaDescription:
      "Importar de China a Mérida, estado Mérida: carga consolidada puerta a puerta, pagas al llegar e inspección en fábrica.",
    h1: "Importar de China a Mérida (estado Mérida)",
    anguloLocal:
      "Mérida mezcla la ciudad universitaria de los Andes con el comercio agrícola que baja por El Vigía y Ejido: desde insumos y herramientas hasta lo que surte las tiendas del casco merideño, mucho de eso sale de China. Consolidamos tu mercancía en Yiwu y la traemos en LCL hasta la cordillera, sin que tengas que armar un contenedor completo y con un solo equipo respondiendo por tu carga de punta a punta.",
    notaEntrega:
      "En Mérida la entrega nacional se cobra por metro cúbico: subir a la cordillera no encarece el tramo, lo que cuenta es el volumen de tu carga. Lo estimas en la calculadora.",
  },
  {
    slug: "punto-fijo",
    ciudad: "Punto Fijo",
    estado: "Falcón",
    km: 290,
    casco: false,
    metaTitle: "Importar de China a Punto Fijo, Falcón | DTD Cargo",
    metaDescription:
      "Importar de China a Punto Fijo y Paraguaná, Falcón: carga consolidada puerta a puerta, pagas al llegar y last-mile a tu puerta.",
    h1: "Importar de China a Punto Fijo (Falcón)",
    anguloLocal:
      "Punto Fijo es el polo comercial de la península de Paraguaná, y junto con Punta Cardón y Los Taques concentra buena parte del movimiento del estado; más al sur, Coro suma el comercio de la capital falconiana. Mucha de la carga que traemos de China surte esas tiendas, y nosotros consolidamos tu mercancía en Yiwu y la movemos en LCL hasta Falcón.",
    notaEntrega:
      "En Punto Fijo la entrega nacional se cobra por metro cúbico, así que subir a la península no cambia la cuenta: lo que pagas depende del volumen de tu carga. La calculadora te lo estima al instante.",
  },
  {
    slug: "coro",
    ciudad: "Coro",
    estado: "Falcón",
    km: 260,
    casco: false,
    metaTitle: "Importar de China a Coro, Falcón | DTD Cargo",
    metaDescription:
      "Importar de China a Coro (Santa Ana de Coro), Falcón: carga consolidada puerta a puerta, pagas al llegar e inspección en fábrica.",
    h1: "Importar de China a Coro (Falcón)",
    anguloLocal:
      "Coro, la capital de Falcón, mueve el comercio del norte del estado: desde el casco histórico de Santa Ana de Coro hasta La Vela y el eje que conecta con la península, las tiendas se surten de mercancía que muchas veces llega de China. Consolidamos tu carga en Yiwu y la traemos en LCL hasta Falcón, sin que tengas que armar un contenedor completo y con un solo equipo respondiendo por tu carga de punta a punta.",
    notaEntrega:
      "En Coro la entrega nacional se cobra por metro cúbico —el volumen de tu carga es lo único que mueve el precio— y lo estimas en la calculadora antes de comprometerte con nada.",
  },
  {
    slug: "margarita",
    ciudad: "Isla Margarita",
    estado: "Nueva Esparta",
    km: 540,
    casco: false,
    metaTitle: "Importar de China a Isla Margarita | DTD Cargo",
    metaDescription:
      "Importar de China a Isla Margarita (Porlamar), Nueva Esparta: carga consolidada puerta a puerta. Coordinamos el cruce a la isla y entregamos en tu puerta.",
    h1: "Importar de China a Isla Margarita (Nueva Esparta)",
    anguloLocal:
      "Margarita vive del comercio: Porlamar, Pampatar y La Asunción concentran tiendas que se surten todo el año, y mucho de eso llega de China. Como es una isla, el last-mile incluye el cruce en ferry desde tierra firme, y nosotros lo coordinamos para que tu mercancía consolidada en Yiwu termine en tu puerta en Nueva Esparta sin que tengas que mover un dedo.",
    notaEntrega:
      "En Isla Margarita la entrega nacional se cobra por metro cúbico y el cruce en ferry lo coordinamos nosotros. La calculadora te estima ese tramo y tu asesor te confirma el número final por WhatsApp.",
  },
  {
    slug: "ciudad-bolivar",
    ciudad: "Ciudad Bolívar",
    estado: "Bolívar",
    km: 700,
    casco: false,
    metaTitle: "Importar de China a Ciudad Bolívar | DTD Cargo",
    metaDescription:
      "Importar de China a Ciudad Bolívar, estado Bolívar: carga consolidada puerta a puerta, pagas al llegar e inspección en fábrica.",
    h1: "Importar de China a Ciudad Bolívar (Bolívar)",
    anguloLocal:
      "Ciudad Bolívar, capital del estado, es el paso histórico del Orinoco y centro de servicios del sur: su comercio surte tanto a la ciudad como a las poblaciones que dependen de ella a lo largo del río. Traemos tu carga consolidada desde Yiwu hasta el estado Bolívar y coordinamos también la entrega hacia Ciudad Guayana cuando tu proveedor despacha hacia la región.",
    notaEntrega:
      "En Ciudad Bolívar la entrega nacional se cobra por metro cúbico, el mismo criterio que aplicamos en todo el país: paga el volumen, no el viaje. Lo estimas en la calculadora.",
  },
  {
    slug: "acarigua",
    ciudad: "Acarigua",
    estado: "Portuguesa",
    km: 175,
    // SDD-0504: Acarigua usa la tarifa de entrega vigente, igual que Araure.
    casco: false,
    metaTitle: "Importar de China a Acarigua-Araure, Portuguesa | DTD Cargo",
    metaDescription:
      "Importar de China a Acarigua y Araure, Portuguesa: carga consolidada puerta a puerta, pagas al llegar y last-mile a tu puerta.",
    h1: "Importar de China a Acarigua y Araure (Portuguesa)",
    anguloLocal:
      "Acarigua y Araure forman el eje comercial de Portuguesa, el granero de Venezuela: entre la agroindustria del arroz y el maíz y el comercio que surte a Guanare y Turén, mucha de la maquinaria, los repuestos y la mercancía llegan de China. Consolidamos tu carga en Yiwu y la movemos en LCL hasta los llanos, sin que tengas que armar un contenedor completo.",
    notaEntrega:
      "En Acarigua, Araure y el resto de Portuguesa la entrega nacional se cobra por metro cúbico. La calculadora te muestra el estimado y tu asesor confirma la tarifa vigente.",
  },
  {
    slug: "valera",
    ciudad: "Valera",
    estado: "Trujillo",
    km: 360,
    casco: false,
    metaTitle: "Importar de China a Valera, Trujillo | DTD Cargo",
    metaDescription:
      "Importar de China a Valera, estado Trujillo: carga consolidada puerta a puerta, pagas al llegar e inspección en fábrica.",
    h1: "Importar de China a Valera (Trujillo)",
    anguloLocal:
      "Valera es el corazón comercial de Trujillo —más movida que la propia capital del estado— y el paso del comercio andino que sube hacia Boconó, La Puerta y la ciudad de Trujillo. Buena parte de lo que surte esas tiendas llega de China, y nosotros consolidamos tu mercancía en Yiwu y la traemos en LCL hasta los Andes, con un solo equipo responsable de tu carga de punta a punta.",
    notaEntrega:
      "En Valera la entrega nacional se cobra por metro cúbico, y el mismo precio aplica subiendo hacia Boconó o Trujillo. La calculadora te da el estimado al instante.",
  },
  {
    slug: "cumana",
    ciudad: "Cumaná",
    estado: "Sucre",
    km: 560,
    casco: false,
    metaTitle: "Importar de China a Cumaná, Sucre | DTD Cargo",
    metaDescription:
      "Importar de China a Cumaná, estado Sucre: carga consolidada puerta a puerta, pagas al llegar e inspección en fábrica.",
    h1: "Importar de China a Cumaná (Sucre)",
    anguloLocal:
      "Cumaná, la capital de Sucre y una de las ciudades más antiguas del continente, vive del comercio costero y la pesca; su mercado y sus tiendas se surten de mercancía que muchas veces llega de China, y más al este Carúpano suma el movimiento de la península de Paria. Consolidamos tu carga en Yiwu y la traemos en LCL hasta el oriente, sin que tengas que armar un contenedor completo.",
    notaEntrega:
      "En Cumaná la entrega nacional se cobra por metro cúbico y lo estimas en la calculadora. Cumaná es además el punto más cercano al que llegamos para varias poblaciones de Sucre que todavía no cubrimos.",
  },
  {
    slug: "san-fernando",
    ciudad: "San Fernando de Apure",
    estado: "Apure",
    km: 370,
    casco: false,
    metaTitle: "Importar de China a San Fernando de Apure | DTD Cargo",
    metaDescription:
      "Importar de China a San Fernando de Apure: carga consolidada puerta a puerta, pagas al llegar e inspección en fábrica.",
    h1: "Importar de China a San Fernando de Apure (Apure)",
    anguloLocal:
      "San Fernando de Apure, capital del estado y puerto sobre el río Apure, es el centro comercial del llano profundo: surte el comercio ganadero y a las poblaciones que dependen de la ciudad río abajo. Traer mercancía de China consolidada te conviene frente a comprar suelto, y nosotros movemos tu carga desde Yiwu hasta el llano con el last-mile coordinado hasta tu puerta.",
    notaEntrega:
      "En San Fernando de Apure la entrega nacional se cobra por metro cúbico: bajar al llano no encarece el tramo, lo que cuenta es el volumen de tu carga. Lo estimas en la calculadora.",
  },
];

export function getGeoZona(slug: string): GeoZona | null {
  return GEO_ZONAS.find((z) => z.slug === slug) ?? null;
}
