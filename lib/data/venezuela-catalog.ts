/**
 * Catálogo Venezuela · estados, municipios, ciudades, parroquias, barrios.
 *
 * Fuente: nomenclatura administrativa VE + códigos postales IPOSTEL.
 * Portado de Claude Design v1.7 (erp/modules/venezuela-catalog.jsx)
 * a TypeScript puro · sin window.* · namespaced exports.
 *
 * 24 estados + Distrito Capital + Dependencias Federales (uno virtual
 * "Caracas Metropolitana" agrupa 4 municipios fuera de DC).
 *
 * Habilita: CityPicker para registro cliente, admin-routes, despacho,
 * estado-cuenta, lookup por código postal en facturación.
 *
 * Helpers:
 *  - `allCities()`        — flatten Estado→Municipio→Ciudad a array plano
 *  - `findCity(name)`     — match exacto por nombre (case-insensitive)
 *  - `findByPostal(code)` — todas las ciudades con ese CP
 *  - `searchCities(q)`    — substring match en city/state/municipio/CP
 *  - `getRegions()`       — lista única de regiones
 *  - `statesByRegion(r)`  — estados de una región
 *  - `stats()`            — métricas del catálogo (UI)
 */

export interface VECity {
  name: string;
  postalCode: string;
  parroquias: string[];
  barrios: string[];
}

export interface VEMunicipio {
  name: string;
  cities: VECity[];
}

export interface VEState {
  code: string;
  name: string;
  capital: string;
  region: string;
  postalRange: string;
  virtual?: boolean;
  municipios: VEMunicipio[];
}

/** City flat · con todos los campos de su estado/municipio. */
export interface VEFullCity {
  city: string;
  state: string;
  stateCode: string;
  region: string;
  municipio: string;
  parroquias: string[];
  postalCode: string;
  barrios: string[];
}

// ─────────────────────────────────────────────────────────────
// Data · 24 estados + DC + Dependencias Federales
// ─────────────────────────────────────────────────────────────

export const VE_STATES: VEState[] = [
  { code: "DTF", name: "Distrito Capital", capital: "Caracas", region: "Capital", postalRange: "1010–1090",
    municipios: [
      { name: "Libertador", cities: [
        { name: "Caracas (Centro)", postalCode: "1010", parroquias: ["Catedral", "San José", "La Pastora", "El Recreo"], barrios: ["El Silencio", "San Bernardino", "Cotiza", "La Candelaria"] },
        { name: "Caracas (Oeste)", postalCode: "1020", parroquias: ["Antímano", "Caricuao", "La Vega", "Macarao"], barrios: ["Caricuao", "Antímano", "La Yaguara"] },
        { name: "Caracas (Sur)", postalCode: "1080", parroquias: ["El Valle", "Coche", "Santa Rosalía"], barrios: ["El Valle", "Coche", "Las Acacias"] },
      ] },
    ],
  },
  { code: "CCS-METRO", name: "Caracas Metropolitana", capital: "Caracas", region: "Capital", postalRange: "1060–1080", virtual: true,
    municipios: [
      { name: "Chacao", cities: [{ name: "Chacao (Caracas)", postalCode: "1060", parroquias: ["Chacao"], barrios: ["Chacao", "La Castellana", "Country Club", "Altamira"] }] },
      { name: "Baruta", cities: [{ name: "Baruta (Caracas)", postalCode: "1080", parroquias: ["Baruta", "El Cafetal", "Las Minas"], barrios: ["Las Mercedes", "Santa Mónica", "Sorocaima"] }] },
      { name: "Sucre", cities: [{ name: "Petare", postalCode: "1070", parroquias: ["Petare", "Caucagüita", "Filas de Mariche", "La Dolorita", "Leoncio Martínez"], barrios: ["Petare", "Mariperez", "Cumbres de Curumo"] }] },
      { name: "El Hatillo", cities: [{ name: "El Hatillo", postalCode: "1083", parroquias: ["El Hatillo"], barrios: ["El Hatillo", "La Lagunita", "Oripoto"] }] },
    ],
  },
  { code: "AMA", name: "Amazonas", capital: "Puerto Ayacucho", region: "Guayana", postalRange: "7100–7199",
    municipios: [
      { name: "Atures", cities: [{ name: "Puerto Ayacucho", postalCode: "7101", parroquias: ["Atures"], barrios: ["Centro"] }] },
    ],
  },
  { code: "ANZ", name: "Anzoátegui", capital: "Barcelona", region: "Oriente", postalRange: "6001–6099",
    municipios: [
      { name: "Simón Bolívar", cities: [{ name: "Barcelona", postalCode: "6001", parroquias: ["Bergantín", "El Carmen", "San Cristóbal"], barrios: ["Centro", "Boyacá"] }] },
      { name: "Sotillo", cities: [{ name: "Puerto La Cruz", postalCode: "6023", parroquias: ["Pozuelos"], barrios: ["Centro", "Lechería"] }] },
      { name: "Diego Bautista Urbaneja", cities: [{ name: "Lechería", postalCode: "6016", parroquias: ["Lechería"], barrios: ["Lechería", "El Morro"] }] },
      { name: "Anaco", cities: [{ name: "Anaco", postalCode: "6003", parroquias: ["Anaco"], barrios: ["Centro"] }] },
      { name: "Pedro María Freites", cities: [{ name: "Cantaura", postalCode: "6004", parroquias: ["Cantaura"], barrios: [] }] },
      { name: "Independencia", cities: [{ name: "Soledad", postalCode: "6010", parroquias: ["Mamo"], barrios: [] }] },
    ],
  },
  { code: "APU", name: "Apure", capital: "San Fernando de Apure", region: "Llanos", postalRange: "7001–7099",
    municipios: [
      { name: "San Fernando", cities: [{ name: "San Fernando de Apure", postalCode: "7001", parroquias: ["San Fernando"], barrios: ["Centro"] }] },
      { name: "Páez", cities: [{ name: "Guasdualito", postalCode: "7011", parroquias: ["Guasdualito"], barrios: [] }] },
    ],
  },
  { code: "ARA", name: "Aragua", capital: "Maracay", region: "Centro", postalRange: "2101–2199",
    municipios: [
      { name: "Girardot", cities: [{ name: "Maracay", postalCode: "2101", parroquias: ["Las Delicias", "José Casanova Godoy", "Joaquín Crespo"], barrios: ["San Jacinto", "Las Delicias", "El Castaño", "Caña de Azúcar", "La Soledad"] }] },
      { name: "Mario Briceño Iragorry", cities: [{ name: "El Limón", postalCode: "2105", parroquias: ["Caña de Azúcar"], barrios: ["El Limón"] }] },
      { name: "Santiago Mariño", cities: [{ name: "Turmero", postalCode: "2115", parroquias: ["Turmero"], barrios: ["Centro"] }] },
      { name: "Sucre", cities: [{ name: "Cagua", postalCode: "2122", parroquias: ["Cagua"], barrios: ["Centro"] }] },
      { name: "José Ángel Lamas", cities: [{ name: "Santa Cruz", postalCode: "2128", parroquias: ["Santa Cruz"], barrios: [] }] },
      { name: "Linares Alcántara", cities: [{ name: "Santa Rita", postalCode: "2123", parroquias: ["Santa Rita"], barrios: [] }] },
    ],
  },
  { code: "BAR", name: "Barinas", capital: "Barinas", region: "Llanos", postalRange: "5201–5299",
    municipios: [
      { name: "Barinas", cities: [{ name: "Barinas", postalCode: "5201", parroquias: ["Barinas", "Alto Barinas"], barrios: ["Centro", "Alto Barinas"] }] },
      { name: "Antonio José de Sucre", cities: [{ name: "Socopó", postalCode: "5212", parroquias: ["Socopó"], barrios: [] }] },
    ],
  },
  { code: "BOL", name: "Bolívar", capital: "Ciudad Bolívar", region: "Guayana", postalRange: "8001–8099",
    municipios: [
      { name: "Heres", cities: [{ name: "Ciudad Bolívar", postalCode: "8001", parroquias: ["Catedral", "Vista Hermosa"], barrios: ["Centro", "Vista Hermosa", "Sabana del Hueso"] }] },
      { name: "Caroní", cities: [{ name: "Ciudad Guayana / Puerto Ordaz", postalCode: "8050", parroquias: ["Cachamay", "Universidad", "Unare", "Vista al Sol", "Once de Abril"], barrios: ["Alta Vista", "Castillito", "Los Olivos", "Villa Bolívar"] }] },
      { name: "Piar", cities: [{ name: "Upata", postalCode: "8021", parroquias: ["Upata"], barrios: ["Centro"] }] },
    ],
  },
  { code: "CAR", name: "Carabobo", capital: "Valencia", region: "Centro", postalRange: "2001–2099",
    municipios: [
      { name: "Valencia", cities: [{ name: "Valencia", postalCode: "2001", parroquias: ["San José", "San Blas", "Catedral", "Candelaria"], barrios: ["El Viñedo", "Trigal Norte", "San José", "Prebo", "El Recreo", "La Granja"] }] },
      { name: "Naguanagua", cities: [{ name: "Naguanagua", postalCode: "2005", parroquias: ["Naguanagua"], barrios: ["Mañongo", "La Granja", "Bárbula"] }] },
      { name: "San Diego", cities: [{ name: "San Diego", postalCode: "2006", parroquias: ["San Diego"], barrios: ["Yuma", "Castillito"] }] },
      { name: "Los Guayos", cities: [{ name: "Los Guayos", postalCode: "2014", parroquias: ["Los Guayos"], barrios: [] }] },
      { name: "Guacara", cities: [{ name: "Guacara", postalCode: "2015", parroquias: ["Guacara"], barrios: ["Centro"] }] },
      { name: "Puerto Cabello", cities: [{ name: "Puerto Cabello", postalCode: "2050", parroquias: ["Fraternidad", "Bartolomé Salom", "Goaigoaza"], barrios: ["Centro", "Cumboto"] }] },
    ],
  },
  { code: "COJ", name: "Cojedes", capital: "San Carlos", region: "Llanos", postalRange: "2201–2299",
    municipios: [
      { name: "Ezequiel Zamora", cities: [{ name: "San Carlos", postalCode: "2201", parroquias: ["San Carlos"], barrios: ["Centro"] }] },
      { name: "Tinaquillo", cities: [{ name: "Tinaquillo", postalCode: "2204", parroquias: ["Tinaquillo"], barrios: ["Centro"] }] },
    ],
  },
  { code: "DEL", name: "Delta Amacuro", capital: "Tucupita", region: "Guayana", postalRange: "9001–9099",
    municipios: [
      { name: "Tucupita", cities: [{ name: "Tucupita", postalCode: "9001", parroquias: ["Tucupita"], barrios: ["Centro"] }] },
    ],
  },
  { code: "FAL", name: "Falcón", capital: "Coro", region: "Occidente", postalRange: "4101–4199",
    municipios: [
      { name: "Miranda", cities: [{ name: "Coro", postalCode: "4101", parroquias: ["Santa Ana", "San Antonio"], barrios: ["Centro", "Cruz Verde", "Curazaito"] }] },
      { name: "Carirubana", cities: [{ name: "Punto Fijo", postalCode: "4102", parroquias: ["Carirubana", "Norte", "Punta Cardón"], barrios: ["Centro", "Las Pioneras", "Cardón"] }] },
      { name: "Los Taques", cities: [{ name: "Santa Cruz de Los Taques", postalCode: "4106", parroquias: ["Los Taques"], barrios: [] }] },
      { name: "Federación", cities: [{ name: "Churuguara", postalCode: "4115", parroquias: ["Churuguara"], barrios: [] }] },
    ],
  },
  { code: "GUA", name: "Guárico", capital: "San Juan de los Morros", region: "Llanos", postalRange: "2301–2399",
    municipios: [
      { name: "Juan Germán Roscio", cities: [{ name: "San Juan de los Morros", postalCode: "2301", parroquias: ["San Juan"], barrios: ["Casco Central", "Pariata", "La Toscana"] }] },
      { name: "Francisco de Miranda", cities: [{ name: "Calabozo", postalCode: "2312", parroquias: ["Calabozo"], barrios: ["Centro"] }] },
      { name: "Camaguán", cities: [{ name: "Camaguán", postalCode: "2317", parroquias: ["Camaguán"], barrios: [] }] },
      { name: "José Tadeo Monagas", cities: [{ name: "Altagracia de Orituco", postalCode: "2304", parroquias: ["Altagracia"], barrios: [] }] },
    ],
  },
  { code: "LAG", name: "La Guaira", capital: "La Guaira", region: "Capital", postalRange: "1160–1199",
    municipios: [
      { name: "Vargas", cities: [
        { name: "La Guaira", postalCode: "1163", parroquias: ["Catia La Mar", "Maiquetía", "La Guaira"], barrios: ["Maiquetía", "Macuto"] },
        { name: "Catia La Mar", postalCode: "1162", parroquias: ["Catia La Mar"], barrios: ["Centro", "Puerto Viejo"] },
        { name: "Maiquetía", postalCode: "1161", parroquias: ["Maiquetía"], barrios: ["Centro"] },
      ] },
    ],
  },
  { code: "LAR", name: "Lara", capital: "Barquisimeto", region: "Centro-Occidente", postalRange: "3001–3099",
    municipios: [
      { name: "Iribarren", cities: [{ name: "Barquisimeto", postalCode: "3001", parroquias: ["Catedral", "Concepción", "Tamaca", "El Cuji"], barrios: ["Centro", "El Tostado", "Las Trinitarias", "Patarata"] }] },
      { name: "Palavecino", cities: [{ name: "Cabudare", postalCode: "3023", parroquias: ["Cabudare"], barrios: ["Centro"] }] },
      { name: "Crespo", cities: [{ name: "Duaca", postalCode: "3050", parroquias: ["Duaca"], barrios: [] }] },
      { name: "Torres", cities: [{ name: "Carora", postalCode: "3040", parroquias: ["Carora"], barrios: ["Centro"] }] },
    ],
  },
  { code: "MER", name: "Mérida", capital: "Mérida", region: "Andes", postalRange: "5101–5199",
    municipios: [
      { name: "Libertador", cities: [{ name: "Mérida", postalCode: "5101", parroquias: ["El Llano", "Milla", "Domingo Peña", "Mariano Picón Salas"], barrios: ["La Hechicera", "Belensate", "Glorias Patrias", "Mérida Centro"] }] },
      { name: "Campo Elías", cities: [{ name: "Ejido", postalCode: "5113", parroquias: ["Ejido"], barrios: ["Centro"] }] },
      { name: "Tovar", cities: [{ name: "Tovar", postalCode: "5131", parroquias: ["Tovar"], barrios: ["Centro"] }] },
      { name: "Alberto Adriani", cities: [{ name: "El Vigía", postalCode: "5145", parroquias: ["El Vigía"], barrios: ["Centro"] }] },
    ],
  },
  { code: "MIR", name: "Miranda", capital: "Los Teques", region: "Capital", postalRange: "1201–1299",
    municipios: [
      { name: "Guaicaipuro", cities: [{ name: "Los Teques", postalCode: "1201", parroquias: ["Los Teques", "San Pedro"], barrios: ["Centro", "San Pedro", "Lomas de Urquía"] }] },
      { name: "Plaza", cities: [{ name: "Guarenas", postalCode: "1220", parroquias: ["Guarenas"], barrios: ["Centro", "Camatagua"] }] },
      { name: "Zamora", cities: [{ name: "Guatire", postalCode: "1221", parroquias: ["Guatire"], barrios: ["Centro"] }] },
      { name: "Cristóbal Rojas", cities: [{ name: "Charallave", postalCode: "1210", parroquias: ["Charallave"], barrios: ["Centro"] }] },
      { name: "Urdaneta", cities: [{ name: "Cúa", postalCode: "1213", parroquias: ["Cúa"], barrios: ["Centro"] }] },
      { name: "Brión", cities: [{ name: "Higuerote", postalCode: "1240", parroquias: ["Higuerote"], barrios: ["Centro"] }] },
      { name: "Lander", cities: [{ name: "Ocumare del Tuy", postalCode: "1210", parroquias: ["Ocumare"], barrios: ["Centro"] }] },
    ],
  },
  { code: "MON", name: "Monagas", capital: "Maturín", region: "Oriente", postalRange: "6201–6299",
    municipios: [
      { name: "Maturín", cities: [{ name: "Maturín", postalCode: "6201", parroquias: ["San Simón", "San Vicente", "Las Cocuizas"], barrios: ["La Floresta", "Tipuro", "Las Avenidas", "Los Pinos"] }] },
      { name: "Caripe", cities: [{ name: "Caripe", postalCode: "6225", parroquias: ["Caripe"], barrios: [] }] },
      { name: "Punceres", cities: [{ name: "Quiriquire", postalCode: "6213", parroquias: ["Quiriquire"], barrios: [] }] },
    ],
  },
  { code: "NES", name: "Nueva Esparta", capital: "La Asunción", region: "Insular", postalRange: "6301–6399",
    municipios: [
      { name: "Arismendi", cities: [{ name: "La Asunción", postalCode: "6301", parroquias: ["La Asunción"], barrios: ["Centro"] }] },
      { name: "Mariño", cities: [{ name: "Porlamar", postalCode: "6313", parroquias: ["Porlamar"], barrios: ["Centro", "4 de Mayo", "Genovés"] }] },
      { name: "Maneiro", cities: [{ name: "Pampatar", postalCode: "6315", parroquias: ["Pampatar"], barrios: ["Centro", "La Caranta"] }] },
      { name: "Gómez", cities: [{ name: "Santa Ana", postalCode: "6311", parroquias: ["Santa Ana"], barrios: [] }] },
    ],
  },
  { code: "POR", name: "Portuguesa", capital: "Guanare", region: "Llanos", postalRange: "3301–3399",
    municipios: [
      { name: "Guanare", cities: [{ name: "Guanare", postalCode: "3322", parroquias: ["Guanare", "San Juan de Guanaguanare"], barrios: ["Centro", "Mesa de Cavacas"] }] },
      { name: "Páez", cities: [{ name: "Acarigua", postalCode: "3301", parroquias: ["Acarigua"], barrios: ["Centro", "Bolívar"] }] },
      { name: "Araure", cities: [{ name: "Araure", postalCode: "3303", parroquias: ["Araure"], barrios: ["Centro"] }] },
      { name: "Sucre", cities: [{ name: "Biscucuy", postalCode: "3330", parroquias: ["Biscucuy"], barrios: [] }] },
    ],
  },
  { code: "SUC", name: "Sucre", capital: "Cumaná", region: "Oriente", postalRange: "6101–6199",
    municipios: [
      { name: "Sucre", cities: [{ name: "Cumaná", postalCode: "6101", parroquias: ["Altagracia", "Santa Inés", "Valentín Valiente", "Ayacucho"], barrios: ["Centro", "Boca de Sabana", "Los Tarales"] }] },
      { name: "Bermúdez", cities: [{ name: "Carúpano", postalCode: "6150", parroquias: ["Santa Rosa", "Santa Catalina"], barrios: ["Centro"] }] },
      { name: "Cajigal", cities: [{ name: "Yaguaraparo", postalCode: "6173", parroquias: ["Yaguaraparo"], barrios: [] }] },
      { name: "Valdez", cities: [{ name: "Güiria", postalCode: "6164", parroquias: ["Güiria"], barrios: [] }] },
    ],
  },
  { code: "TAC", name: "Táchira", capital: "San Cristóbal", region: "Andes", postalRange: "5001–5099",
    municipios: [
      { name: "San Cristóbal", cities: [{ name: "San Cristóbal", postalCode: "5001", parroquias: ["La Concordia", "Pedro María Morantes", "San Juan Bautista"], barrios: ["Centro", "Pirineos", "Las Lomas"] }] },
      { name: "Cárdenas", cities: [{ name: "Táriba", postalCode: "5009", parroquias: ["Táriba"], barrios: ["Centro"] }] },
      { name: "Bolívar", cities: [{ name: "San Antonio del Táchira", postalCode: "5004", parroquias: ["San Antonio"], barrios: ["Centro"] }] },
      { name: "Pedro María Ureña", cities: [{ name: "Ureña", postalCode: "5005", parroquias: ["Ureña"], barrios: [] }] },
      { name: "Junín", cities: [{ name: "Rubio", postalCode: "5030", parroquias: ["Rubio"], barrios: ["Centro"] }] },
    ],
  },
  { code: "TRU", name: "Trujillo", capital: "Trujillo", region: "Andes", postalRange: "3101–3199",
    municipios: [
      { name: "Trujillo", cities: [{ name: "Trujillo", postalCode: "3101", parroquias: ["Trujillo"], barrios: ["Centro"] }] },
      { name: "Valera", cities: [{ name: "Valera", postalCode: "3102", parroquias: ["Valera", "Mendoza"], barrios: ["Centro", "La Plata", "Plata III"] }] },
      { name: "Boconó", cities: [{ name: "Boconó", postalCode: "3104", parroquias: ["Boconó"], barrios: ["Centro"] }] },
    ],
  },
  { code: "YAR", name: "Yaracuy", capital: "San Felipe", region: "Centro-Occidente", postalRange: "3201–3299",
    municipios: [
      { name: "San Felipe", cities: [{ name: "San Felipe", postalCode: "3201", parroquias: ["San Felipe", "Albarico"], barrios: ["Centro", "La Trinidad"] }] },
      { name: "Independencia", cities: [{ name: "Independencia", postalCode: "3206", parroquias: ["Independencia"], barrios: [] }] },
    ],
  },
  { code: "ZUL", name: "Zulia", capital: "Maracaibo", region: "Occidente", postalRange: "4001–4099",
    municipios: [
      { name: "Maracaibo", cities: [{ name: "Maracaibo", postalCode: "4001", parroquias: ["Chiquinquirá", "Coquivacoa", "Cristo de Aranza", "Bolívar", "Santa Lucía"], barrios: ["Bella Vista", "Tierra Negra", "El Milagro", "Indio Mara", "Sabaneta"] }] },
      { name: "San Francisco", cities: [{ name: "San Francisco", postalCode: "4002", parroquias: ["San Francisco", "Marcial Hernández"], barrios: ["Sierra Maestra", "San Francisco Centro"] }] },
      { name: "Cabimas", cities: [{ name: "Cabimas", postalCode: "4013", parroquias: ["Cabimas", "Punta Gorda", "Ambrosio"], barrios: ["Centro", "Las Cabillas", "La Rosa"] }] },
      { name: "Lagunillas", cities: [{ name: "Ciudad Ojeda", postalCode: "4019", parroquias: ["Ciudad Ojeda"], barrios: ["Centro"] }] },
      { name: "Mara", cities: [{ name: "San Rafael del Moján", postalCode: "4012", parroquias: ["Mara"], barrios: [] }] },
      { name: "Machiques de Perijá", cities: [{ name: "Machiques", postalCode: "4045", parroquias: ["Machiques"], barrios: ["Centro"] }] },
      { name: "Santa Rita", cities: [{ name: "Santa Rita", postalCode: "4030", parroquias: ["Santa Rita"], barrios: [] }] },
    ],
  },
  { code: "DEP", name: "Dependencias Federales", capital: "—", region: "Insular", postalRange: "1990–1999",
    municipios: [
      { name: "Los Roques", cities: [{ name: "Gran Roque", postalCode: "1990", parroquias: [], barrios: [] }] },
      { name: "La Tortuga", cities: [{ name: "Tortuga", postalCode: "—", parroquias: [], barrios: [] }] },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Flatten todos los Estado→Municipio→Ciudad a array plano. */
export function allCities(): VEFullCity[] {
  const out: VEFullCity[] = [];
  for (const s of VE_STATES) {
    for (const m of s.municipios) {
      for (const c of m.cities) {
        out.push({
          city: c.name,
          state: s.name,
          stateCode: s.code,
          region: s.region,
          municipio: m.name,
          parroquias: c.parroquias,
          postalCode: c.postalCode,
          barrios: c.barrios,
        });
      }
    }
  }
  return out;
}

/** Match exacto por nombre de ciudad (case-insensitive). */
export function findCity(name: string): VEFullCity | undefined {
  const target = name.trim().toLowerCase();
  return allCities().find((c) => c.city.toLowerCase() === target);
}

/** Todas las ciudades con un código postal dado. */
export function findByPostal(code: string | number): VEFullCity[] {
  const target = String(code).replace("-A", "").trim();
  return allCities().filter((c) => c.postalCode === target);
}

/** Substring match en city/state/municipio/CP. Vacío devuelve todo. */
export function searchCities(q: string): VEFullCity[] {
  if (!q) return allCities();
  const target = q.trim().toLowerCase();
  return allCities().filter(
    (c) =>
      c.city.toLowerCase().includes(target) ||
      c.state.toLowerCase().includes(target) ||
      c.municipio.toLowerCase().includes(target) ||
      c.postalCode.includes(target),
  );
}

/** Lista única de regiones, ordenadas alfabéticamente. */
export function getRegions(): string[] {
  return Array.from(new Set(VE_STATES.map((s) => s.region))).sort();
}

/** Estados pertenecientes a una región. */
export function statesByRegion(region: string): VEState[] {
  return VE_STATES.filter((s) => s.region === region);
}

/** Métricas del catálogo, útiles para mostrar en UI. */
export function stats(): {
  states: number;
  municipios: number;
  cities: number;
  parroquias: number;
  barrios: number;
} {
  const cities = allCities();
  return {
    states: VE_STATES.filter((s) => !s.virtual).length,
    municipios: VE_STATES.reduce((n, s) => n + s.municipios.length, 0),
    cities: cities.length,
    parroquias: cities.reduce((n, c) => n + c.parroquias.length, 0),
    barrios: cities.reduce((n, c) => n + c.barrios.length, 0),
  };
}
