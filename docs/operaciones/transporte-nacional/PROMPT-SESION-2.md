# ⏭️ PENDIENTE — abrir la Sesión 2 el 30-jul-2026

> **Estado: 🔴 SIN EMPEZAR.** Este archivo existe para que no se pierda el hilo.
> Cuando la Sesión 2 termine, marcarlo ✅ o borrarlo.

**Cuándo:** 30-jul-2026, **después de las 11:00 / 12:00** — la reunión con
Transportes Benítez / R&M es a las **10:30 AM**, y la llamada con **Fletes GAG** ese
mismo día por la tarde.

**Qué hay que traer de las reuniones** (sin esto la Sesión 2 no puede avanzar):

1. **El factor volumétrico (kg/m³) de cada proveedor.** Es el número que hace
   comparables las ofertas. GAG usa 200; con 333 el mismo bulto sube 66% sin que la
   tarifa por kg se mueva.
2. **Los porcentajes que faltan de Benítez** — entregaron 2 de ~20 zonas (Centro 5%,
   Cumaná 8%) y los dos mínimos por despacho (`CENTRO` / `FORÁNEO`) en blanco.
3. **El tarifario oficial de GAG desde Valencia** — nunca lo dieron: sus 4 PDFs son de
   Maracay, Caracas, Pto Ordaz y Coro. El mapa de Valencia lo armó el equipo por
   analogía.
4. **La tabla renovada de GAG.** ⚠️ La vigente **vence el 1-ago-2026**.
5. **El valor declarado típico** de la mercancía de los clientes (lo define el
   founder): sin ese dato no se puede enfrentar un % ad valorem contra un USD/kg.

---

## Prompt para pegar en la ventana nueva

```
Esta sesión se llama: "Sesión 2: Transporte Terrestre, Proveedores y Recargo por
Ciudad - Chat 2". Es la continuación de la Sesión 1 del 29-jul-2026.

Contexto: DTD Cargo, repo c:\Users\Trabajo\Desktop\Developer\software\DTDCargo.
Vengo de dos reuniones con transportistas nacionales y traigo tablas de tarifas.

LEE PRIMERO, en este orden:
1. docs/operaciones/transporte-nacional/README.md  (índice, los 3 modelos de
   cobro, estado de cada negociación)
2. docs/operaciones/transporte-nacional/plantilla-solicitud-tarifario.md
   (cuestionario único + la canasta E1-E7 para comparar)
3. docs/operaciones/transporte-nacional/benitez-rm.md  (ficha del proveedor)

DÓNDE ESTÁ EL MATERIAL FUENTE (no lo busques de nuevo, ya está mapeado):
- Estudio de mercado terrestre (mayo 2026): /admin/cbm-estudio →
  app/admin/cbm-estudio/content.html
- PDFs originales de Fletes GAG + transcripciones JSON + el xlsx consolidado:
  wiki-personal/wiki/entidades/cbm-china-vzla-PROYECTO-COMPLETO/tarifas-terrestres/
- Documento HTML de la investigación:
  wiki-personal/wiki/entidades/cbm-china-vzla-PROYECTO-COMPLETO/
  transporte-cbm-china-venezuela/index.html
- Tabla vigente (GAG, 33 tramos × 11 zonas): lib/data/tarifas-terrestres-vzla.ts
- Motor de cálculo ya escrito y con 20 tests: lib/calc/fleteTerrestre.ts

QUÉ SE HIZO EN LA SESIÓN 1 (ya está en main, no lo repitas):
- Migración 0277 aplicada a prod: se agregaron Maturín, Acarigua, Valera, Cumaná
  y San Fernando de Apure a calculator_cities (tenían landing SEO y no cotizaban).
  Producción verificada: 19 filas, la RPC pública las devuelve.
- Cumaná y San Fernando DERIVAN AL ASESOR (no dan precio) vía la lista
  CIUDADES_DERIVAN_A_ASESOR en lib/calculadora.ts, porque no tienen zona en
  VALENCIA_ZONAS y ninguna tarifa confirmada les pone precio.
  → AL CONFIRMAR TARIFA: sacar el slug de esa lista y agregar su zona.

EL HALLAZGO QUE MANDA (medido con el motor real, no estimado):
La calculadora pública cobra "$1 × km fuera del casco", plano, y no corresponde
a ningún modelo del mercado:
- Puerto Ordaz 0,5 CBM: cobra $570 cuando debería ser ~$71  (+706%)
- Barquisimeto 5 CBM:   cobra $20 cuando debería ser ~$99   (−80%)
No existe fórmula por km que reproduzca la tabla: el $/km/CBM implícito varía 37×
(de 2,40 a 0,065). La salida correcta es que la calculadora LCL consuma
lib/calc/fleteTerrestre.ts en modo "cbm-lejos", que ya descuenta el tramo del
casco que cubre el CBM.

LO QUE TRAIGO Y QUÉ HACER CON ELLO:
[pega acá las tablas/tarifas de las reuniones]
1. Registrá cada tarifario en su ficha bajo docs/operaciones/transporte-nacional/
   (una ficha por proveedor, y guardá el PDF/Excel original en assets/).
2. Cotizá la canasta E1-E7 con cada tarifario y armá el cuadro comparativo. Ojo
   E6 y E7: son las pruebas trampa (factor volumétrico y castigo por densidad).
3. Decime qué proveedor gana por zona — es probable que haya que combinar 2-3,
   porque el más barato no llega a todos los destinos.
4. NO implementes ningún modelo en la calculadora hasta que yo elija cuál. Primero
   el análisis, después el código.

DATOS QUE FALTAN Y SON LA LLAVE:
- El factor volumétrico (kg/m³) de cada proveedor. GAG usa 200; con 333 el mismo
  bulto sube 66% sin que la tarifa por kg cambie. Sin este número las ofertas no
  son comparables.
- El valor declarado típico de la mercancía de nuestros clientes (lo defino yo):
  sin eso no se puede enfrentar un % ad valorem contra un USD/kg.
- La tabla de GAG VENCE EL 1-AGO-2026 (dice "próxima revisión agosto 2026").
- GAG nunca nos dio tarifario desde VALENCIA (sus 4 PDFs son de Maracay, Caracas,
  Pto Ordaz y Coro). El mapa de Valencia lo armó el equipo por analogía.

GOTCHAS DE ESTE REPO (no los re-descubras):
- Trato: español venezolano, TUTEO, cero voseo.
- Antes de numerar spec o migración: git fetch y chequear origin/main. Van CINCO
  colisiones. Y volvé a chequear justo antes del push.
- Aplicar migración a prod exige mi OK nombrando el archivo exacto
  (docs/runbooks/aplicar-migraciones-prod.md). De a UNA, nunca en bundle.
- Toda migración nueva necesita su prueba contractual en supabase/tests/ — el gate
  ganó los pasos `sql-tests` y `schema-rebuild`. Validala con una prueba de
  MUTACIÓN o queda decorada.
- Si los tests fallan raro en Windows: es CRLF. El repo fuerza LF por
  .gitattributes; un worktree viejo necesita `git add --renormalize .`
- Si `next dev`/`next build` falla con "Turbopack ... couldn't find the Next.js
  package": es el virtual store de pnpm apuntando a otro worktree. Cura:
  `CI=true pnpm install`. NO pierdas tiempo con turbopack.root.
- No pushees sin mi OK. Commits selectivos, nunca git add -A.
- Gate: `node scripts/verify.mjs`. main avanza ~10 commits/hora, así que
  esperá que el push rebote: `git merge origin/main` y reintentá.
```
