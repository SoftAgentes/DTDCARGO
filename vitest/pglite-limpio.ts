import { PGlite, type Extensions } from "@electric-sql/pglite";

/**
 * SDD-0570 · Un PGlite recién inicializado sin pagar el initdb en cada caso.
 *
 * `new PGlite()` corre initdb dentro del WASM: ~1,3 s en la máquina de Sam,
 * casi todo el costo de un caso de contrato (medido el 2026-10-20: 48 casos de
 * `portal-bandeja-avisos` en 66 s). Cargar el directorio de datos de un cluster
 * recién inicializado cuesta ~0,3 s.
 *
 * La plantilla es el cluster JUSTO después del initdb: sin migraciones, sin
 * fixture y sin una sola consulta del caso. Cada llamada devuelve una instancia
 * propia, cargada de una copia; lo que un caso escribe muere con su `close()`.
 * Comparada con un `new PGlite()`, da la misma versión, los mismos roles, bases,
 * extensiones y catálogo, y hasta el mismo txid y el mismo OID siguiente
 * (`vitest/pglite-limpio.test.ts`).
 *
 * Una plantilla por juego de extensiones y por archivo de prueba: Vitest aísla
 * los módulos de cada archivo, así que el caché no cruza archivos.
 */
const plantillas = new Map<string, Promise<Blob>>();

function plantilla(extensions: Extensions | undefined): Promise<Blob> {
  const clave = Object.keys(extensions ?? {}).sort().join(",");
  let dump = plantillas.get(clave);
  if (!dump) {
    dump = (async () => {
      const db = new PGlite(extensions ? { extensions } : {});
      try {
        await db.waitReady;
        return await db.dumpDataDir("none");
      } finally {
        await db.close();
      }
    })();
    // Una plantilla que falló no se queda en el caché: el caso siguiente reintenta.
    const propia = dump;
    propia.catch(() => {
      if (plantillas.get(clave) === propia) plantillas.delete(clave);
    });
    plantillas.set(clave, propia);
  }
  return dump;
}

/** Equivale a `new PGlite(extensions ? { extensions } : {})`, sin el initdb. */
export async function pgliteLimpio(extensions?: Extensions): Promise<PGlite> {
  const loadDataDir = await plantilla(extensions);
  return new PGlite(extensions ? { extensions, loadDataDir } : { loadDataDir });
}
