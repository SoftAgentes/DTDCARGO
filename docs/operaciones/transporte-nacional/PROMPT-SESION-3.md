# Sesión 3 — Reestructurar la calculadora al cobro por CBM

> **Estado: 🟡 LISTO PARA ARRANCAR.** La negociación con Benito está cerrada y confirmada
> por escrito. Falta construir. Este archivo es el traspaso completo: se puede abrir una
> ventana nueva y trabajar solo con esto.
>
> Viene de la Sesión 2 (30-31 jul 2026). Cuando la Sesión 3 termine, marcar ✅ o borrar.

---

## 1 · Lo que quedó decidido y ya no se discute

**Benito Transporte Express, C.A** — RIF **J-50266334-7** (ojo: *Transporte* en singular)
es el **proveedor n.º 1** del transporte terrestre nacional. Formulario de confirmación
firmado por **Mariotsy Mendoza, Gerente General, el 31-jul-2026**, con las 7 zonas
marcadas en frecuencia, tiempo de entrega y precio.

### El cobro es por metro cúbico. Punto.

Muere el % ad valorem, muere el USD/kg, muere el pie cúbico como unidad operativa y muere
el recargo por kilómetro. **Un solo eje: CBM.**

| Tramo | Costo (Benito) | Venta (DTD) | Margen | % |
|---|---:|---:|---:|---:|
| **Centro** | $70,00 | **$105,94** | $35,94 | 51,3% |
| **Foráneo** | $80,00 | **$123,60** | $43,60 | 54,5% |
| **Remota** | $80,00 | **$176,57** | $96,57 | 120,7% |

**De dónde sale cada columna.** El costo es lo que Benito confirmó por escrito. La venta
es lo que ofrecieron en la **primera** negociación, cotizado en pie cúbico
($3,00 · $3,50 · $5,00) y convertido a CBM con `1 m³ = 35,3147 ft³`.

**Por qué se hace así** (decisión del founder, 31-jul): el mercado cotiza ~$3/ft³ ≈
$105/CBM. Que Benito ofrezca $70 puede ser un error de ellos. Vendiendo a la tabla vieja,
si mañana el costo sube a lo que cotiza el mercado, DTD **no pierde**. Es un seguro, no
una ganancia. **Esto reemplaza la regla del 30% que se había fijado antes** — el margen
ya no es un porcentaje, es la diferencia entre las dos tablas.

### Mapa de tramos

- **Centro** → zona Centro (Carabobo · Yaracuy · Aragua · Miranda · Caracas · Vargas · Lara-Barquisimeto) — 46 destinos
- **Foráneo** → Llano Occidente · Los Andes · Occidente · Oriente Costa · Oriente Llano — 117 destinos
- **Remota** → Zonas especiales (Margarita · Carúpano · Tucupita) — 3 destinos

### Condiciones confirmadas por escrito

- **NO hay mínimo por despacho** — *"no aplica al método de cobro utilizado"*.
- **NO se cobra nada aparte**: ni seguro, ni IVA, ni manejo, ni estiba, ni entrega a
  domicilio. El $70/$80 es el costo final.
- **Pago**: efectivo en dólares, se cancela **todos los viernes**.
- **Vigencia**: hasta nuevo aviso, con **1 semana de aviso previo** si sube.
- **«Varía según la consolidez de la carga»** significa que **puede salir MÁS de una vez**,
  no menos. Que no salga en la semana es *"un caso muy extremo, rara vez se presenta"* y
  avisan. Deja de ser un riesgo para prometerle tiempos al cliente en Oriente y Bolívar.
- **Prueba de entrega: las dos vías.** *"Tenemos un personal un poco arcaico, por los
  momentos lo podemos manejar con nota de despacho en físico y también por la aplicación
  para que se vayan adaptando."*
- **9 destinos sin cobertura**: Cariaco, El Callao, El Manteco, El Dorado, KM 88, Santa
  Elena de Uairén, El Pilar, Güiria, Cumanacoa. Nunca cotizarlos.
- Los **"NO" del tabulador viejo están vencidos**: Temblador, Caripito, Caripe y Tucupita
  **sí** los cubren, cada 15 días.

---

## 2 · Dónde está cada cosa

| Qué | Dónde |
|---|---|
| **Tabla completa: 175 destinos, costo, venta, margen, frecuencias** | `C:\Users\Trabajo\Downloads\DTD-transporte-nacional-benito.xlsx` (4 hojas) |
| Script que genera ese Excel | `scratchpad/build-excel-benito.py` |
| Formulario que Benito llenó (vivo) | https://dtd-confirmacion-benito-hailu-wey.vercel.app · proyecto Vercel `dtd-confirmacion-benito`, equipo HailuWey |
| Transcripción de la reunión (18 min, Whisper medium) | `scratchpad/transcripcion/benito-reunion.{txt,srt,vtt,json}` |
| Plan aprobado de 4 fases | `C:\Users\Trabajo\.claude\plans\lazy-swimming-mountain.md` |
| Motor actual de la calculadora pública | [`lib/calculadora.ts`](../../../lib/calculadora.ts) |
| Motor terrestre viejo (queda informativo) | [`lib/calc/fleteTerrestre.ts`](../../../lib/calc/fleteTerrestre.ts) |

⚠️ Los PDFs originales de Benito (TABULADOR y CRONOGRAMA DE DESPACHO) **no están en el
repo todavía** — hay que guardarlos en `docs/operaciones/transporte-nacional/assets/`.
⚠️ La transcripción es material comercial sensible: **no va a git**.

---

## 3 · Checklist

### A · Simulador antes de tocar código ← *empezar por aquí*
- [ ] Artefacto HTML que simule la calculadora con el modelo nuevo: escoger ciudad + CBM
      y ver el desglose completo, incluyendo el flete China→VE y el tramo nacional.
- [ ] Mostrar **lado a lado** lo que cobra hoy (`km × $1`) contra lo nuevo (`CBM × tramo`),
      para que el founder vea el salto antes de que llegue a producción.
- [ ] Incluir el texto que le saldría al cliente, para aprobar el copy nuevo ahí mismo.
- [ ] Simular **los tres casos de cobertura** de la sección G, no solo el feliz: ciudad
      cubierta · ciudad sin cobertura con sugerencia de la cercana · ciudad desconocida.
      El mensaje de "no llegamos hasta ahí, pero sí hasta X" se aprueba en el simulador
      antes de escribirlo en el código.

### B · Documentación (Fases 1-2 del plan)
- [ ] `docs/operaciones/transporte-nacional/benito-transporte-express.md` — ficha del
      proveedor n.º 1 con todo lo de la sección 1.
- [ ] Guardar los PDFs y el PDF del formulario confirmado en `assets/`.
- [ ] Reemplazar `benitez-rm.md` (mezcla tres razones sociales, tiene el ad valorem muerto).
- [ ] Actualizar el `README.md` del tree: Benito = n.º 1, negociación cerrada.

### C · Modelo de datos (Fase 3)
- [ ] Spec SDD nueva. ⚠️ **El número NO es correlativo automático** — verificar en TODAS
      las ramas (`git branch -a`), no solo en `origin/main`. Van cinco colisiones.
- [ ] Migración: `rates` **no tiene columna de costo** — solo `per_cbm`, `flat_rate`,
      `min_charge`, `transit_days`. Hay que agregar el lado del costo y el vínculo al
      transportista, o crear `freight_carriers` + `carrier_tariffs` (ver plan).
- [ ] El precio de venta debe ser **editable** desde el ERP sin deploy.
- [ ] Prueba contractual en `supabase/tests/`, validada con **mutación** o queda decorada.
- [ ] GRANT antes que policy. Respetar `-text` de `.gitattributes` en los `.sql`.
- [ ] UI en `/studio/admin`, sección "Calculadora pública", al lado de `CiudadesPanel`.
- [ ] Aplicar a prod: runbook `docs/runbooks/aplicar-migraciones-prod.md`, de a UNA, con
      OK del founder nombrando el archivo.
- [ ] Borrar o marcar obsoleta la tarifa sembrada `transporte_terrestre` Valencia→Maracaibo
      a $650 flat en `rates` (migración 0005) — no corresponde a nada real.

### D · La calculadora (Fase 4)
- [ ] [`lib/calculadora.ts:555-560`](../../../lib/calculadora.ts) — reemplazar
      `recargoCiudad = max(0, km − 200) × $1` por `cbmFacturable × precio_venta(tramo)`.
- [ ] `thresholdCascoKm` y `tarifaKmFueraCasco` (`lib/calculadora.ts:87,93`) quedan muertos
      para LCL. Decidir: se retiran de la UI del admin o se marcan legacy.
- [ ] **Deduplicar**: la misma fórmula por km está copiada en
      [`lib/studio/client-address-types.ts:107`](../../../lib/studio/client-address-types.ts)
      (`lastMileEstimate`), consumida por `DeliveryAddressesCard` y `PortalAddresses`. Si
      no se toca, el ERP y el portal muestran el número viejo mientras la web muestra el nuevo.
- [ ] Ciudad sin tarifa → derivar al asesor (`CIUDADES_DERIVAN_A_ASESOR`, `lib/calculadora.ts:319`).
      Revisar si Cumaná y San Fernando salen de esa lista: ahora **sí** tienen precio.
- [ ] Tests: `__tests__/calculadora.test.ts`, `calculadora-ciudades.test.ts` y
      `calculadora-deriva-asesor.test.ts` **esperan los valores por km** y van a romper —
      hay que reescribirlos, no silenciarlos.
- [ ] Regresión con los casos medidos: **Puerto Ordaz 0,5 CBM pasa de $570 a $61,80** ·
      **Barquisimeto 5 CBM pasa de $20 a $529,70**.

### E · El copy que hoy habla de kilómetros
- [ ] [`lib/geo-zonas.ts`](../../../lib/geo-zonas.ts) — **8+ `notaEntrega`** dicen cosas
      como *"Maracaibo está a 410 km de nuestra bodega en Valencia, fuera del casco
      central…"*. Se reescriben al modelo CBM.
- [ ] `app/servicios/puerta-a-puerta/page.tsx:193-194` — *"fuera del casco central aplica un…"*.
- [ ] `app/importar-de-china/page.tsx:133` — *"Entrega en el casco central, sin recargo por distancia."*
- [ ] `components/CalculadoraForm.tsx:1014-1018` — línea de desglose "Entrega a {ciudad}".
- [ ] `app/portal/(app)/perfil/PortalAddresses.tsx:158` — *"Entrega incluida (casco central)"*.
- [ ] ⚠️ **SEO**: esas landings están indexadas y hay bitácora en `docs/marketing/seo.md`.
      Cambiar el copy sin romper el posicionamiento, y anotar el cambio ahí.
- [ ] Decidir si el concepto "casco central" sobrevive. Con el modelo nuevo **Centro es un
      tramo con precio ($105,94/CBM)**, no una zona gratis. Hoy el copy promete entrega
      incluida sin recargo en el casco — eso deja de ser cierto y hay que decidir si se
      absorbe en el precio base o se cobra aparte.

### F · Pendientes con Benito
- [ ] **El descuento por pagar en divisas.** En la reunión dijo que sí lo hay; nunca lo
      cuantificaron y en el formulario no lo mencionaron. Es plata que el founder quiere
      convertir en abono para el cliente.
- [ ] **El Excel del contenedor** que el founder prometió: un contenedor real separado por
      cliente con totales de cajas, peso y CBM, y una columna libre para que ellos pongan
      el precio. Es el primer ejercicio conjunto.
- [ ] **Comprobante de entrega** — nombre acordado en la reunión. Va impreso, uno por
      cliente, en carpeta. Lleva **"Entregar a"**, no "Cliente", porque quien recibe muchas
      veces no es el titular. Las cajas llevan solo el código, nunca el nombre. **No existe
      en el ERP**; el founder se comprometió a armarlo.
- [ ] **Acceso de choferes a la PWA con código de 4 dígitos** (no nombre ni correo), una
      sola cuenta compartida para los choferes de Benito.

### G · Cobertura: ciudades que faltan y "no llegamos, pero sí cerca" ← *feature nuevo*

**El hueco medido:** la calculadora ofrece **19 ciudades**; Benito cubre **166 destinos**.
Un cliente de Guanare, Turmero, El Tigre o Cabudare hoy **no tiene opción** y se va sin
cotizar, aunque Benito llegue ahí sin problema. Lista actual en
[`lib/calculadora.ts:274-300`](../../../lib/calculadora.ts): casco-central (agrupada),
Valencia, Maracay, Caracas, Barquisimeto, Maracaibo, Puerto La Cruz, San Cristóbal,
Mérida, Ciudad Bolívar, Puerto Ordaz, Punto Fijo, Coro, Acarigua, Valera, San Fernando,
Cumaná, Maturín, Margarita.

Cada destino pasa a tener **tres estados posibles**, y la calculadora responde distinto
a cada uno:

| Estado | Qué es | Qué ve el cliente |
|---|---|---|
| **Cubierto** | Está en los 166 de Benito | Precio al instante: `CBM × tramo` |
| **Sin cobertura** | Benito confirmó que no llega | *"No llegamos hasta ahí"* + la ciudad cubierta más cercana con su precio + CTA a asesor |
| **Desconocido** | No está en ninguna lista | Misma respuesta, resuelta por estado |

- [ ] **Subir la calculadora de 19 a 166 ciudades.** Es el cambio de mayor impacto
      comercial de todo el lote: hoy se pierden clientes por no aparecer su ciudad.
- [ ] **Cambiar el selector.** Con 166 destinos el `<select>` actual no sirve — hace falta
      un combobox con búsqueda. Ya hay precedente en el repo (SDD-0108, combobox
      cédula-first): reusar el patrón, no inventar otro.
- [ ] **Aprovechar [`ve_locality_catalog`](../../../supabase/migrations/0024_dispatch_core.sql)**
      — ya existe en la base: 24 estados, ~98 ciudades, con `state_code`, `state_name`,
      `state_region`, `municipio`, `postal_code` IPOSTEL y parroquias. Es el sustrato para
      que el cliente escriba cualquier pueblo y el sistema sepa en qué estado cae.
- [ ] **Mapa de "ciudad cercana cubierta".** Para los 9 sin cobertura, hacerlo **a mano y
      que lo revise el founder** — son 9, no hace falta geolocalización:
      El Manteco · El Dorado · KM 88 · Santa Elena de Uairén → *Puerto Ordaz* ·
      El Pilar · Güiria · Cumanacoa · Cariaco → *Cumaná* · El Callao → *Puerto Ordaz*.
      ⚠️ Son sugerencias mías: **el founder las confirma antes de que salgan a producción**.
- [ ] **Para lo desconocido**, resolver por `state_code` del catálogo → la ciudad cubierta
      de ese estado. Si el estado tampoco tiene cobertura, derivar al asesor.
- [ ] **El copy tiene que ser honesto.** No decir "no disponible" a secas: decir *hasta
      dónde sí* llegamos, cuánto cuesta ese tramo, y que el cliente resuelve el último
      trecho o lo conversa con un asesor. Ese mensaje es lo que convierte un "no" en venta.
- [ ] **Marcar el precio sugerido como aproximado.** Si al cliente le mostramos el precio
      de la ciudad vecina, tiene que quedar claro que su entrega final no está incluida.
- [ ] `CIUDADES_DERIVAN_A_ASESOR` (`lib/calculadora.ts:319`) hoy tiene `cumana` y
      `san-fernando` **porque no había tarifa**. Ahora las dos tienen precio ($123,60
      foráneo) → **salen de esa lista**. El mecanismo se recicla para los sin cobertura.
- [ ] Medir en GA4 qué ciudades busca la gente y no encuentra. Es la señal para decidir
      con qué transportista se negocia después.

---

## 4 · Decisión abierta que hay que resolver

**¿Qué cuenta como tramo "Remota"?** Hoy se aplicó solo a la zona Especiales (Margarita,
Carúpano, Tucupita). Pero en la reunión el founder también nombró **Guasipati** a $5, y
Guasipati quedó en Oriente Llano pagando $123,60.

Mirando la tabla confirmada, **15 destinos salen cada 15 días** repartidos entre todas las
zonas: Camatagua · Guasdualito · Libertad · Sabaneta · El Nula · El Venado · Machiques ·
La Villa · Dabajuro · Pariaguán · Temblador · Caripito · Caripe · Guasipati · Tucupita.

Ese patrón quincenal define "remoto" mejor que la zona. **Preguntar al founder** si esos
15 pasan al tramo de $176,57.

---

## 5 · Gotchas del repo — no re-descubrirlos

- **Trato**: español venezolano, **tuteo, cero voseo**. Regla dura.
- **Numeración**: antes de crear spec o migración, `git fetch` y revisar `origin/main`
  **y todas las ramas**. Volver a chequear justo antes del push.
- **Migración a prod**: OK del founder nombrando el archivo exacto. De a UNA, nunca en
  bundle. Runbook obligatorio.
- **Toda migración nueva** necesita su prueba contractual en `supabase/tests/`. El gate
  tiene los pasos `sql-tests` y `schema-rebuild`.
- **Tests raros en Windows** = CRLF → `git add --renormalize .`
- **`next dev`/`build` falla con "Turbopack no encuentra Next.js"** → `CI=true pnpm install`.
  **No** perder tiempo con `turbopack.root`.
- **Gate**: `node scripts/verify.mjs`. `main` avanza rápido; si el push rebota,
  `git merge origin/main` y reintentar.
- **No pushear sin OK del founder.** Commits selectivos, nunca `git add -A`.
- **Estado del árbol**: al cerrar la Sesión 2, `main` local estaba **71 commits detrás**
  de `origin/main`. Ponerse al día antes de tocar código.
- **Frontera dura**: la web pública nunca importa `@/lib/studio`, `@/lib/db` ni
  `@supabase/*`. Está forzada por ESLint como error.
- **Cambio visual** → pasa por `/ui-check` antes del commit.
