/**
 * Destinos del transporte terrestre nacional — respaldo del sitio público.
 *
 * ═══════════════════════════════════════════════════════════════════
 *  ⚠️ ESTE ARCHIVO NO LLEVA EL COSTO. A propósito.
 *
 *  Entra al bundle del navegador. Lo que le pagamos al transportista
 *  (`cost_usd_cbm`) vive SOLO en la tabla `carrier_tariffs` y no sale
 *  nunca por la RPC pública. Acá está únicamente el precio de VENTA.
 *  Si algún día agregas el costo acá, se lo estás regalando a la
 *  competencia en el View Source.
 * ═══════════════════════════════════════════════════════════════════
 *
 * DE DÓNDE SALE. Del tarifario que **Benito Transporte Express, C.A**
 * (RIF J-50266334-7) confirmó por escrito el 31-jul-2026, firmado por
 * Mariotsy Mendoza, Gerente General. Ficha completa y trazabilidad en
 * `docs/operaciones/transporte-nacional/benito-transporte-express.md`.
 *
 * PARA QUÉ SIRVE ESTE ARCHIVO. Es el fallback, exactamente igual que
 * `CIUDADES` en `lib/calculadora.ts`: la calculadora lee el tarifario
 * de la DB por la RPC anon `public_carrier_tariffs()`, y si esa RPC no
 * devuelve filas (tabla vacía, Supabase caído, migración sin aplicar)
 * cae acá y sigue cotizando bien. La DB SIEMPRE manda cuando tiene datos
 * — así el founder edita precios desde el ERP sin deploy.
 *
 * LA REGLA QUE GOBIERNA EL PRECIO (founder, 31-jul-2026): el cobro es
 * por METRO CÚBICO y nada más. Murió el % ad valorem, murió el USD/kg y
 * murió el recargo por kilómetro. Ver SDD-0236 y SDD-0237.
 *
 * 178 destinos · 169 cubiertos · 9 sin cobertura · 8 en zona sin costo.
 */

/** Los tres tramos de precio. La zona no fija el precio; el tramo sí. */
export type TramoTerrestre = "Centro" | "Foráneo" | "Remota";

/**
 * Precio de VENTA por m³ de cada tramo (USD).
 *
 * ⚠️ NO se deriva del costo por un porcentaje. Salió de la PRIMERA oferta
 * de Benito, cotizada en pie cúbico ($3,00 · $3,50 · $5,00 × 35,3147), y se
 * sostiene aunque el costo baje o suba. Es un seguro, no un margen —
 * cualquier intento de recalcularlo como `costo × (1 + margen)` rompe la
 * decisión del founder (SDD-0236).
 */
export const PRECIO_TRAMO: Record<TramoTerrestre, number> = {
  Centro: 105.94,
  "Foráneo": 123.6,
  Remota: 176.57,
};

export type DestinoNacional = {
  /** Espeja `calculator_cities.slug`. Es el id que viaja en el formulario. */
  slug: string;
  /** Nombre visible. */
  label: string;
  /** Estado de Venezuela — con esto resolvemos la ciudad que nadie escribió. */
  estado: string;
  /** `null` = el transportista no llega hasta ahí. */
  tramo: TramoTerrestre | null;
  cubierta: boolean;
  /**
   * Zona sin costo: el cliente paga **$0** de entrega. DTD le paga ese tramo
   * al fletero aparte — es adquisición de clientes, no un descuento
   * (founder, 1-ago-2026). Espeja `calculator_cities.casco`.
   */
  casco: boolean;
  /** USD por m³ que paga el cliente. `null` si no está cubierta. */
  ventaCbm: number | null;
  /**
   * Cada cuántos días sale el camión. **15 = quincenal** → la calculadora le
   * avisa al cliente que puede tardar hasta una semana más.
   */
  frecuenciaDias: number | null;
  /** Lo que dijo el transportista, literal ("24 a 72 horas"). */
  transito: string | null;
  /** Sólo para las sin cobertura: el slug de la cubierta más cercana. */
  cercana: string | null;
};

export const DESTINOS_NACIONALES: DestinoNacional[] = [
  { slug: "acarigua", label: "Acarigua", estado: "Portuguesa", tramo: "Foráneo", cubierta: true, casco: true, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "barquisimeto", label: "Barquisimeto", estado: "Lara", tramo: "Centro", cubierta: true, casco: true, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "caracas", label: "Caracas", estado: "Caracas", tramo: "Centro", cubierta: true, casco: true, ventaCbm: 105.94, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "guacara", label: "Guacara", estado: "Carabobo", tramo: "Centro", cubierta: true, casco: true, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "maracay", label: "Maracay", estado: "Aragua", tramo: "Centro", cubierta: true, casco: true, ventaCbm: 105.94, frecuenciaDias: 1, transito: "Mismo día", cercana: null },
  { slug: "naguanagua", label: "Naguanagua", estado: "Carabobo", tramo: "Centro", cubierta: true, casco: true, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "san-diego", label: "San Diego", estado: "Carabobo", tramo: "Centro", cubierta: true, casco: true, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "valencia", label: "Valencia (sede)", estado: "Carabobo", tramo: "Centro", cubierta: true, casco: true, ventaCbm: 105.94, frecuenciaDias: 1, transito: "Mismo día", cercana: null },
  { slug: "abejales", label: "Abejales", estado: "Táchira", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "achaguas", label: "Achaguas", estado: "Apure", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "anaco", label: "Anaco", estado: "Anzoátegui", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "araure", label: "Araure", estado: "Portuguesa", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "bailadores", label: "Bailadores", estado: "Mérida", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "barbacoa", label: "Barbacoa", estado: "Guárico", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "barcelona", label: "Barcelona", estado: "Anzoátegui", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "barinas", label: "Barinas", estado: "Barinas", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "barinitas", label: "Barinitas", estado: "Barinas", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 72 horas", cercana: null },
  { slug: "bejuma", label: "Bejuma", estado: "Carabobo", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "biruaca", label: "Biruaca", estado: "Apure", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "biscucuy", label: "Biscucuy", estado: "Portuguesa", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 72 horas", cercana: null },
  { slug: "boca-de-aroa", label: "Boca de Aroa", estado: "Falcón", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "boca-de-uchire", label: "Boca de Uchire", estado: "Anzoátegui", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "bocono", label: "Boconó", estado: "Trujillo", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "cabimas", label: "Cabimas", estado: "Zulia", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "cabudare", label: "Cabudare", estado: "Lara · Barquisimeto", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 48 horas", cercana: null },
  { slug: "cagua", label: "Cagua", estado: "Aragua", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 1, transito: "Mismo día", cercana: null },
  { slug: "caja-seca", label: "Caja Seca", estado: "Zulia", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "calabozo", label: "Calabozo", estado: "Apure", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "camaguan", label: "Camaguán", estado: "Apure", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "camatagua", label: "Camatagua", estado: "Aragua", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 15, transito: "con zonas especiales de despachos", cercana: null },
  { slug: "cantaura", label: "Cantaura", estado: "Anzoátegui", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "caraballeda", label: "Caraballeda", estado: "Vargas", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 3, transito: "24 a 48 horas", cercana: null },
  { slug: "carayaca", label: "Carayaca", estado: "Vargas", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 3, transito: "24 a 48 horas", cercana: null },
  { slug: "cariaco", label: "Cariaco", estado: "Sucre", tramo: null, cubierta: false, casco: false, ventaCbm: null, frecuenciaDias: null, transito: null, cercana: "cumana" },
  { slug: "caripe", label: "Caripe", estado: "Monagas", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 15, transito: "zona especial de despacho", cercana: null },
  { slug: "caripito", label: "Caripito", estado: "Monagas", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 15, transito: "zona especial de despacho", cercana: null },
  { slug: "carora", label: "Carora", estado: "Lara · Barquisimeto", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 7, transito: "los viernes", cercana: null },
  { slug: "carrizal", label: "Carrizal", estado: "Miranda", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "carupano", label: "Carúpano", estado: "Sucre", tramo: "Remota", cubierta: true, casco: false, ventaCbm: 176.57, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "catia-la-mar", label: "Catia La Mar", estado: "Vargas", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 3, transito: "24 a 48 horas", cercana: null },
  { slug: "chabasquen", label: "Chabasquén", estado: "Portuguesa", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 72 horas", cercana: null },
  { slug: "chaguaramas", label: "Chaguaramas", estado: "Guárico", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "charallave", label: "Charallave", estado: "Miranda", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "chichiriviche", label: "Chichiriviche", estado: "Falcón", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "chivacoa", label: "Chivacoa", estado: "Yaracuy", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "ciudad-bolivia", label: "Ciudad Bolivia", estado: "Barinas", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 72 horas", cercana: null },
  { slug: "ciudad-bolivar", label: "Ciudad Bolívar", estado: "Bolívar", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "ciudad-ojeda", label: "Ciudad Ojeda", estado: "Zulia", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "clarines", label: "Clarines", estado: "Anzoátegui", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "coloncito", label: "Coloncito", estado: "Táchira", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "colonia-tovar", label: "Colonia Tovar", estado: "Aragua", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 7, transito: "24 a 72 horas", cercana: null },
  { slug: "coro", label: "Coro", estado: "Falcón", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "cumanacoa", label: "Cumanacoa", estado: "Sucre", tramo: null, cubierta: false, casco: false, ventaCbm: null, frecuenciaDias: null, transito: null, cercana: "cumana" },
  { slug: "cumana", label: "Cumaná", estado: "Sucre", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "cumarebo", label: "Cumarebo", estado: "Falcón", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "cua", label: "Cúa", estado: "Miranda", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "dabajuro", label: "Dabajuro", estado: "Falcón", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 15, transito: "zona especial de despacho", cercana: null },
  { slug: "dividive", label: "Dividive", estado: "Trujillo", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "duaca", label: "Duaca", estado: "Lara · Barquisimeto", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 3, transito: "24 a 48 horas", cercana: null },
  { slug: "ejido", label: "Ejido", estado: "Mérida", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "el-callao", label: "El Callao", estado: "Bolívar", tramo: null, cubierta: false, casco: false, ventaCbm: null, frecuenciaDias: null, transito: null, cercana: "puerto-ordaz" },
  { slug: "el-dorado", label: "El Dorado", estado: "Bolívar", tramo: null, cubierta: false, casco: false, ventaCbm: null, frecuenciaDias: null, transito: null, cercana: "puerto-ordaz" },
  { slug: "el-manteco", label: "El Manteco", estado: "Bolívar", tramo: null, cubierta: false, casco: false, ventaCbm: null, frecuenciaDias: null, transito: null, cercana: "puerto-ordaz" },
  { slug: "el-nula", label: "El Nula", estado: "Táchira", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 15, transito: "48 a 72 horas", cercana: null },
  { slug: "el-pilar", label: "El Pilar", estado: "Sucre", tramo: null, cubierta: false, casco: false, ventaCbm: null, frecuenciaDias: null, transito: null, cercana: "cumana" },
  { slug: "el-pinal", label: "El Piñal", estado: "Táchira", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "el-socorro", label: "El Socorro", estado: "Guárico", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "el-sombrero", label: "El Sombrero", estado: "Guárico", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "el-tigre", label: "El Tigre", estado: "Anzoátegui", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "el-tigrito", label: "El Tigrito", estado: "Anzoátegui", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "el-tocuyo", label: "El Tocuyo", estado: "Lara · Barquisimeto", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 7, transito: "los viernes", cercana: null },
  { slug: "el-venado", label: "El Venado", estado: "Zulia", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 15, transito: "24 a 48 horas", cercana: null },
  { slug: "el-vigia", label: "El Vigía", estado: "Zulia", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "elorza", label: "Elorza", estado: "Apure", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "flor-de-patria", label: "Flor de Patria", estado: "Trujillo", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "guanare", label: "Guanare", estado: "Portuguesa", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "guanarito", label: "Guanarito", estado: "Portuguesa", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 72 horas", cercana: null },
  { slug: "guanta", label: "Guanta", estado: "Anzoátegui", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "guarenas", label: "Guarenas", estado: "Caracas", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "guasdualito", label: "Guasdualito", estado: "Barinas", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 15, transito: "zona especial de entrega", cercana: null },
  { slug: "guasipati", label: "Guasipati", estado: "Bolívar", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 15, transito: "24 a 72 horas", cercana: null },
  { slug: "guatire", label: "Guatire", estado: "Caracas", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "guiria", label: "Güiria", estado: "Sucre", tramo: null, cubierta: false, casco: false, ventaCbm: null, frecuenciaDias: null, transito: null, cercana: "cumana" },
  { slug: "higuerote", label: "Higuerote", estado: "Caracas", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 7, transito: "24 a 72 horas", cercana: null },
  { slug: "margarita", label: "Isla Margarita", estado: "Nueva Esparta", tramo: "Remota", cubierta: true, casco: false, ventaCbm: 176.57, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "km-88", label: "KM 88", estado: "Bolívar", tramo: null, cubierta: false, casco: false, ventaCbm: null, frecuenciaDias: null, transito: null, cercana: "puerto-ordaz" },
  { slug: "la-concordia", label: "La Concordia", estado: "Táchira", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "la-fria", label: "La Fría", estado: "Táchira", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "la-grita", label: "La Grita", estado: "Táchira", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "la-guaira", label: "La Guaira", estado: "Vargas", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 3, transito: "24 a 48 horas", cercana: null },
  { slug: "la-miel", label: "La Miel", estado: "Lara · Barquisimeto", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 7, transito: "los viernes", cercana: null },
  { slug: "la-tendida", label: "La Tendida", estado: "Táchira", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "la-vela", label: "La Vela", estado: "Falcón", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "la-victoria", label: "La Victoria", estado: "Aragua", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "la-villa-aragua", label: "La Villa (Aragua)", estado: "Aragua", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "la-villa-zulia", label: "La Villa (Zulia)", estado: "Zulia", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 15, transito: "24 a 72 horas", cercana: null },
  { slug: "lagunillas", label: "Lagunillas", estado: "Mérida", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "las-mercedes", label: "Las Mercedes", estado: "Guárico", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "libertad", label: "Libertad", estado: "Barinas", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 15, transito: "zona especial de entrega", cercana: null },
  { slug: "los-llanitos-de-tabay", label: "Los Llanitos de Tabay", estado: "Mérida", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "los-teques", label: "Los Teques", estado: "Miranda", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "machiques", label: "Machiques", estado: "Zulia", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 15, transito: "24 a 72 horas", cercana: null },
  { slug: "maiquetia", label: "Maiquetía", estado: "Vargas", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "maracaibo", label: "Maracaibo", estado: "Zulia", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "maturin", label: "Maturín", estado: "Monagas", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "michelena", label: "Michelena", estado: "Táchira", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "miranda", label: "Miranda", estado: "Carabobo", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "mirimire", label: "Mirimire", estado: "Falcón", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "montalban", label: "Montalbán", estado: "Carabobo", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "moron", label: "Morón", estado: "Carabobo", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "mucuchies", label: "Mucuchíes", estado: "Mérida", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "merida", label: "Mérida", estado: "Mérida", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "naranjales", label: "Naranjales", estado: "Táchira", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "nirgua", label: "Nirgua", estado: "Yaracuy", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "nueva-bolivia", label: "Nueva Bolivia", estado: "Zulia", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "ocumare-del-tuy", label: "Ocumare del Tuy", estado: "Miranda", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "ospino", label: "Ospino", estado: "Portuguesa", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 72 horas", cercana: null },
  { slug: "pampanito", label: "Pampanito", estado: "Trujillo", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "pampan", label: "Pampán", estado: "Trujillo", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "pariaguan", label: "Pariaguán", estado: "Anzoátegui", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 15, transito: "24 a 48 horas", cercana: null },
  { slug: "pedraza", label: "Pedraza", estado: "Barinas", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 72 horas", cercana: null },
  { slug: "pueblo-llano", label: "Pueblo Llano", estado: "Mérida", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "puerto-cabello", label: "Puerto Cabello", estado: "Carabobo", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "puerto-la-cruz", label: "Puerto La Cruz", estado: "Anzoátegui", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "puerto-ordaz", label: "Puerto Ordaz", estado: "Bolívar", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "puerto-piritu", label: "Puerto Píritu", estado: "Anzoátegui", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "punta-de-mata", label: "Punta de Mata", estado: "Monagas", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "punto-fijo", label: "Punto Fijo", estado: "Falcón", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "quibor", label: "Quíbor", estado: "Lara · Barquisimeto", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 7, transito: "los viernes", cercana: null },
  { slug: "rubio", label: "Rubio", estado: "Táchira", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "sabana-de-mendoza", label: "Sabana de Mendoza", estado: "Trujillo", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "sabana-de-parra", label: "Sabana de Parra", estado: "Yaracuy", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "sabaneta", label: "Sabaneta", estado: "Barinas", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 15, transito: "zona especial de entrega", cercana: null },
  { slug: "san-antonio", label: "San Antonio", estado: "Miranda", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "san-antonio-del-golfo", label: "San Antonio del Golfo", estado: "Sucre", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "san-carlos", label: "San Carlos", estado: "Cojedes", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "san-cristobal", label: "San Cristóbal", estado: "Táchira", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "san-felipe", label: "San Felipe", estado: "Yaracuy", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "san-fernando", label: "San Fernando de Apure", estado: "Apure", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "san-felix", label: "San Félix", estado: "Bolívar", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 72 horas", cercana: null },
  { slug: "san-juan-de-los-morros", label: "San Juan de los Morros", estado: "Guárico", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "san-rafael-de-onoto", label: "San Rafael de Onoto", estado: "Portuguesa", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "sanare", label: "Sanare", estado: "Lara · Barquisimeto", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 7, transito: "los viernes", cercana: null },
  { slug: "santa-barbara", label: "Santa Bárbara", estado: "Zulia", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "santa-barbara-de-barinas", label: "Santa Bárbara de Barinas", estado: "Barinas", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "santa-cruz-de-mora", label: "Santa Cruz de Mora", estado: "Mérida", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "santa-elena-de-uairen", label: "Santa Elena de Uairén", estado: "Bolívar", tramo: null, cubierta: false, casco: false, ventaCbm: null, frecuenciaDias: null, transito: null, cercana: "puerto-ordaz" },
  { slug: "santa-lucia", label: "Santa Lucía", estado: "Miranda", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "santa-maria-de-ipire", label: "Santa María de Ipire", estado: "Guárico", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "santa-rita", label: "Santa Rita", estado: "Zulia", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "santa-teresa-del-tuy", label: "Santa Teresa del Tuy", estado: "Miranda", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "santo-domingo", label: "Santo Domingo", estado: "Mérida", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "sarare", label: "Sarare", estado: "Lara · Barquisimeto", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 7, transito: "los viernes", cercana: null },
  { slug: "socopo", label: "Socopó", estado: "Barinas", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "soledad", label: "Soledad", estado: "Anzoátegui", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "tabay", label: "Tabay", estado: "Mérida", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "tejerias", label: "Tejerías", estado: "Aragua", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 2, transito: "24 a 72 horas", cercana: null },
  { slug: "temblador", label: "Temblador", estado: "Monagas", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 15, transito: "zona especial de despacho", cercana: null },
  { slug: "timotes", label: "Timotes", estado: "Trujillo", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "tinaco", label: "Tinaco", estado: "Cojedes", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "tinaquillo", label: "Tinaquillo", estado: "Cojedes", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "tocuyito", label: "Tocuyito", estado: "Carabobo", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 1, transito: "Mismo día", cercana: null },
  { slug: "tovar", label: "Tovar", estado: "Mérida", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "tucacas", label: "Tucacas", estado: "Falcón", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 48 horas", cercana: null },
  { slug: "tucani", label: "Tucaní", estado: "Zulia", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "tucupido", label: "Tucupido", estado: "Guárico", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "tucupita", label: "Tucupita", estado: "Delta Amacuro", tramo: "Remota", cubierta: true, casco: false, ventaCbm: 176.57, frecuenciaDias: 15, transito: "42 a 72 horas", cercana: null },
  { slug: "tumeremo", label: "Tumeremo", estado: "Bolívar", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 72 horas", cercana: null },
  { slug: "turmero", label: "Turmero", estado: "Aragua", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 1, transito: "Mismo día", cercana: null },
  { slug: "turen", label: "Turén", estado: "Portuguesa", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "tariba", label: "Táriba", estado: "Táchira", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "upata", label: "Upata", estado: "Bolívar", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "24 a 72 horas", cercana: null },
  { slug: "valera", label: "Valera", estado: "Trujillo", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "valle-de-la-pascua", label: "Valle de la Pascua", estado: "Guárico", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "yaracal", label: "Yaracal", estado: "Falcón", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 3, transito: "24 a 72 horas", cercana: null },
  { slug: "yaritagua", label: "Yaritagua", estado: "Yaracuy", tramo: "Centro", cubierta: true, casco: false, ventaCbm: 105.94, frecuenciaDias: 1, transito: "Mismo día", cercana: null },
  { slug: "zaraza", label: "Zaraza", estado: "Guárico", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
  { slug: "zea", label: "Zea", estado: "Mérida", tramo: "Foráneo", cubierta: true, casco: false, ventaCbm: 123.6, frecuenciaDias: 7, transito: "48 a 72 horas", cercana: null },
];

/** Índice por slug — el lookup del motor no debe ser O(n) por cada cálculo. */
export const DESTINO_POR_SLUG: ReadonlyMap<string, DestinoNacional> = new Map(
  DESTINOS_NACIONALES.map((d) => [d.slug, d]),
);

/**
 * La cubierta más cercana a un destino al que no llegamos.
 *
 * Le sirve al copy honesto: en vez de "no disponible" a secas, el cliente ve
 * *hasta dónde sí* llegamos y cuánto cuesta ese tramo. Ese mensaje es lo que
 * convierte un "no" en una venta.
 */
export function destinoCercano(slug: string): DestinoNacional | null {
  const d = DESTINO_POR_SLUG.get(slug);
  if (!d?.cercana) return null;
  return DESTINO_POR_SLUG.get(d.cercana) ?? null;
}

/**
 * Destinos cubiertos de un estado, para resolver una ciudad que no está en
 * la lista ("soy de Guanare" → Portuguesa → los destinos de Portuguesa).
 */
export function destinosDeEstado(estado: string): DestinoNacional[] {
  const e = estado.trim().toLowerCase();
  return DESTINOS_NACIONALES.filter(
    (d) => d.cubierta && d.estado.toLowerCase() === e,
  );
}
