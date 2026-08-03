# Radiografía del ERP DTD Cargo — 2026-08-02

> **Método.** 10 auditores en paralelo sobre dimensiones distintas → 2 refutadores
> adversariales sobre los hallazgos graves → 1 crítico de completitud que trazó los
> flujos de negocio de punta a punta → síntesis. **44 veredictos: 39 hallazgos
> reales, 5 falsos positivos descartados.**
>
> **Rama:** `claude/radiografia-erp-20260802` · worktree
> `DTD-worktrees/radiografia-erp-20260802`. **Nada pusheado.**

---

## 0. Cierre de la jornada · qué quedó hecho

**Cubeta 1 completa.** 20 commits, cero push. `origin/main` mergeado (sin un solo
archivo en común, cero conflictos).

| Lote | Commit | Qué era |
|---|---|---|
| 1 | `2ee8c6fd` | el gate cantaba "TODO VERDE" con pasos omitidos en silencio |
| 2 | `681dd359` · `c15e41d3` | texto invisible (1,18:1) en 8 módulos del tema Oscuro |
| 3a | `696ccf18` | 15 bloques JSON-LD inyectaban sin escapar |
| 3b | `44b4f052` | el portal y el ERP móvil no refrescaban la sesión |
| 3c | `a0a67754` | 5 sub-rutas del Studio se abrían tipeando la URL |
| — | `93bbe6a3` | 6 rutas de `/api/studio` decían exigir sesión y no la verificaban |
| 4 | `5aba01d1` | el panel de feature flags no podía encender nada (SDD-0240) |
| 5 | `7a807805` · `08cac148` | `AGENTS.md` con 3 de 4 filas falsas · `.env.example` con 6 de 18 variables |
| — | `babeef38` | 4 páginas de venta fuera del sitemap |
| 6 | `04eee0f2` | 8 specs `in-progress` con el trabajo en producción |
| DB | `988cfa2c` · `0258052b` | `0316` recuperada · `0336` aplicada y verificada contra el objeto |

**Ocho contratos nuevos**, todos validados con **mutación** — si no los vi ponerse
rojos, no cuentan. Tres de ellos me corrigieron a mí en el acto: `vault` mal
clasificado, `0059` que yo daba por pendiente, y un guard de API que buscaba el
`import` en vez de la llamada (y tapaba dos rutas más).

**Lo que NO hice, y por qué:** no toqué `--ink-side-strong` (lo trabaja otra
ventana), ni las ramas de Codex (`0224`/`0235`), ni apliqué `0337` a producción
(requiere tu OK nombrándola). La poda de código muerto quedó pendiente: la lista del
auditor tenía un falso positivo que habría roto la calculadora, así que va archivo
por archivo, no por lista.

---

## 1. Dónde estamos

**El ERP no está roto: está desalineado.** Esa distinción define todo el plan.

La calidad interna es alta y verificable. Gate completo sobre `origin/main`: los 12
pasos verdes, **4.597 tests en 383 archivos sin un fallo**, `typecheck` y `lint` sin
una sola advertencia, 64 contratos SQL contra Postgres efímero, el schema se
reconstruye desde cero con las 326 migraciones, cero archivos con BOM, 27 políticas
de gobernanza aprobadas. Eso no es un proyecto enfermo.

**230 specs** (198 cerradas) · **326 migraciones** en repo contra **336** en el ledger
de prod · **57 módulos** registrados con sus 57 carpetas y sus 57 entradas RBAC —
el registro está sano, y sólo 2 de 57 son placeholder puro (`leads`, `no-olvidar`).

Lo que sí duele:

- **El campo `status:` miente en las dos direcciones.** Trece specs están construidas
  y en producción sin voltear el campo. Y la 0224 dice `approved` ("no autoriza
  código") con su Fase 1 construida y **9 migraciones aplicadas en producción**.
- **Nadie auditó las 199 specs `done`.** Las dos dimensiones de specs se repartieron
  las 32 abiertas. Ya hay un caso probado de `done` falso: **SDD-0030**, cuya parte
  pendiente sigue declarada como TODO en el código. *Un `done` falso es peor que un
  `in-progress` falso: nadie lo vuelve a mirar.*
- **Trabajo real varado fuera de `main`:** 17 ramas con commits propios. Cinco
  migraciones de seguridad (0316, 0326–0329) que la spec 0235 —que sí está en
  `main`— lista como entregables, y cuyos archivos no están en el árbol.
- **El drift de migraciones va en la dirección que el gate no mira.** Repo→prod
  limpio. Pero prod tiene 336 filas contra 326 archivos, y
  `0316_nomina_settlement_void_governance` está **aplicada y activa en producción con
  su archivo ausente de `main`**.

---

## 2. Lo que impide que el ERP sea funcional: los dos flujos se cortan

El crítico de completitud trazó los dos caminos completos en el código. Esto es lo
que ninguna dimensión aislada vio.

### 2.1 Flujo operativo — el último metro no está cableado ⚠️ *(corregido con datos de prod)*

**`camionero_pod` sólo inserta en `dispatch_pods` y ahí termina.** No toca
`shipments.status`, no inserta en `shipment_events`, no programa aviso. Y
`camionero_advance_od` —que según el comentario del propio RPC "cambia el status"—
sólo actualiza `dispatch_orders`, nunca `shipments`. El módulo Tracking bloquea
`delivered` a mano y le dice al operador *"usa el POD sellado de Despacho"*: **una
promesa que el código no cumple.**

**Pero medido contra producción, esto NO está sangrando hoy:**

| Tabla | Filas en prod |
|---|---|
| `dispatch_orders` | **0** |
| `dispatch_order_packages` | **0** |
| `dispatch_pods` | **0** |
| `warehouse_receipts_cn` con `shipment_id` | **0 de 6** |
| `shipments` entregados | 4 (cerrados por `/studio/ve`, que sí funciona) |

El flujo del camionero **nunca se ha usado**. No se están perdiendo entregas: no ha
pasado ninguna por ahí. Es una bomba con la espoleta puesta, no un incendio.

**Y eso condiciona cómo se arregla.** El único camino legal para marcar `delivered`
es `complete_ve_delivery_governed` (migración 0321): el trigger
`guard_ve_delivery_completion` exige dos variables de sesión, restringe las columnas
que se pueden tocar y hace el hito **terminal e inmutable**. O sea que marcar el
embarque equivocado no se deshace.

Y el vínculo POD → embarque va por una cadena que hoy está vacía:
`dispatch_pods.od_id` → `dispatch_order_packages` (FK **polimórfico**) →
`warehouse_receipts_cn.shipment_id` → `shipments`. Ese último campo está **poblado al
0%**. Implementar el cierre siguiendo esa cadena, tal cual está, resolvería a `NULL`
siempre: un no-op silencioso que parece arreglado.

> El comentario de `dispatch_order_packages` dice *"FK polimórfico (FK explícito en
> SDD-0030)"*. **SDD-0030 está marcada `done`** y esa parte nunca se construyó — es el
> mismo `done` falso que detectó el crítico de completitud. **La deuda del POD y el
> `done` falso de 0030 son el mismo problema.**

**Decisión de diseño para el arreglo:** cuando el POD no pueda resolver el embarque,
**falla con error explícito, no sigue de largo**. Un cierre que se salta en silencio
reproduce exactamente el pecado que se está corrigiendo.

Y antes de eso hay otro corte: **Despacho arma las órdenes leyendo
`warehouse_receipts_cn`** (China) con status `consolidado`. "Consolidado" significa
que la caja entró al contenedor en Yiwu — o sea que **entra a la cola de despacho de
Valencia mientras todavía navega 40 días**. Las recepciones reales de Venezuela
(`warehouse_receipts_ve`, lo que escanea el bodeguero en `/m/ve`) no alimentan la cola.

Además, **ninguna de las 5 transiciones de Almacén VE programa aviso al cliente**: el
motor de SDD-0156 tiene sólo 2 llamadores y Almacén VE no es ninguno.

### 2.2 Flujo comercial — cableado, salvo el documento y el aviso 🔴

Estimado → OV/embarque → factura → cobro → asiento está conectado. Pero:

- **La factura no se puede imprimir** y **nadie le avisa al cliente de que existe**:
  `invoice_emitted` está declarado en el motor de correo y **jamás se dispara**.
- **6 de los 10 eventos del motor de correo no tienen un solo emisor**, incluidos
  «Factura emitida» y «Factura vencida». No existe cobranza automática.
- **Los leads públicos no se guardan en ningún lado.** `/contacto` y `/estimacion`
  mandan un email best-effort dentro de un `try/catch` que sólo hace `console.warn`,
  y devuelven `{ok:true}`. Cero filas. Por eso **CRM · Leads es un EmptyState: no
  porque falte construirlo, sino porque nada lo alimenta.**

### 2.3 Y un dato que cambia el costo del arreglo

Los auditores reportaron los botones PDF muertos como trabajo por construir. **No lo
es.** `@react-pdf/renderer` está instalado y en producción, con layout base
compartido, dos documentos escritos, dos route handlers de referencia y tests
unitarios. **La factura en PDF está a un documento de distancia, no a un proyecto.**

---

## 3. CUBETA 1 — sin autorización

### ✅ Lote 1 — Integridad del gate · `2ee8c6fd`

El gate imprimía `verify: TODO VERDE ✓` **habiendo omitido pasos en silencio**.
Cuatro de doce degradan si falta Docker, red o credenciales, y salían con código 0.
Justamente `schema-rebuild` y `migrations-applied` —los dos que vigilan el drift
contra producción— son los primeros en omitirse.

Ahora el gate pasa `VERIFY_CHILD=1`, los hijos devuelven 78 al omitirse (a mano
siguen saliendo 0), el resumen nombra lo no verificado y `VERIFY_STRICT=1` lo vuelve
rojo. **Probado con el gate completo: `[PARCIAL] 10/12 verdes, 2 sin verificar`.**

### ✅ Lote 2 — Texto invisible en tema Oscuro · `681dd359`

`--ink-inv*` voltea entre temas; `--bg-sidebar` es oscuro en los dos. Medido:
**1,18:1** en Contabilidad, Facturación, Cotizador, Despacho, Costing, Inventario,
SENIAT y Fidelización. 58 usos corregidos en 22 archivos.

Lo importante fue **no** hacer el reemplazo masivo: sobre `--danger` el token actual
es correcto (6,31/5,61) y el arreglo "obvio" lo habría roto (2,61).

Contrato de regresión validado **con mutación** — y la primera versión del contrato
era ciega: un divisor de 1px tapaba el contenedor navy y la ventana de 30 líneas no
alcanzaba a uno que estaba 62 líneas arriba. Al ampliarla aparecieron **8
violaciones más** que el barrido original no vio.

**`/ui-check` (2026-08-02).** Los tests prueban que ningún `--ink-inv*` quedó sobre
navy; no prueban que se vea bien. Se cerró ese hueco renderizando los tokens reales
con Playwright: [evidencia](assets/2026-08-02-lote2-contraste-antes-despues.png),
reproducible con `node scripts/proof-contraste-lote2.mjs`.

- En **oscuro** el antes está prácticamente borrado y el después es legible.
- En **claro** es un no-op. La preocupación de que la jerarquía se aplanara (el nivel
  intermedio pasa de `0.75` a `0.85` de opacidad) **no se materializa**.
- El Norte confirma las dos decisiones: *"sobre sidebar navy → cream/`--ink-side`"* y
  *"en dark, texto sobre relleno semántico = `--ink-inv`, nunca blanco"* — por eso
  `--danger` y `--success` se dejaron como estaban.
- ⚠️ **Deuda con el Norte:** `--ink-side-strong` **no existe** en el `tokens.css`
  canónico (que sólo tiene `--ink-side` y `--ink-side-soft`). Es vocabulario
  repo-local, con consumidores previos en `app/m/cn/`, así que no lo introdujo este
  lote — pero le suma 28 usos. Si un NORTE-SYNC reemplaza `tokens.css` completo, el
  token se evapora y `var()` sin fallback hereda en silencio. **Pedirle a Cloud Design
  que lo incorpore, o declararlo como extensión local.**

### ✅ Lote 3a — XSS de JSON-LD · `696ccf18`

15 bloques inyectaban `JSON.stringify` pelado con `dangerouslySetInnerHTML`,
incluidos los de `/noticias` que serializan **contenido del CMS**. Contrato validado
con mutación.

### ✅ Lote 3b — Sesión del portal y del ERP móvil · `44b4f052`

`proxy.ts` existe para refrescar el access token en cookies, pero su matcher era
sólo `/studio` y `/back`. `/portal` y `/m/erp` autentican con el **mismo** Supabase
y estaban fuera: al vencer el token (1 h) la navegación server-side veía la sesión
muerta y echaba al cliente **aunque su refresh token siguiera vivo**. Es el bug que
se reporta como *"me saca solo"* y que nadie reproduce porque hay que esperar una
hora. `/m/cn` y `/m/ve` quedan fuera a propósito: el operario entra con PIN.

### ✅ Lote 3c — Gates RBAC de sub-rutas · `a0a67754`

Mi primer intento fue **mal**: grepeé sólo `page.tsx` y concluí que faltaban 48
gates. Parcheé 46 de una y el test anti-drift `rbac-view-guard.test.ts` —que yo
no había visto— se puso rojo con un mensaje que no esperaba: *"el módulo X ya
tiene gate"*. Dos cosas que el repo sabía y yo no:

1. **Un `layout.tsx` cubre todo el subtree.** 35 de mis 46 cambios eran
   redundantes: ya estaban protegidos por un layout ancestro.
2. **`dashboard`, `bugs`, `mis-bugs` y `menciones` están sin gate a propósito**,
   con la razón escrita. El dashboard es el destino del redirect `?denied=`:
   gatearlo crea un **bucle infinito** para cualquier rol denegado.

Reverti las 46. El hueco real eran **5 sub-rutas** cuyo padre gatea en `page.tsx`,
que no envuelve a sus hijos: `clientes/[markbox]` (PII), `tracking/nuevo` (alta de
embarques), `tracking/[id]`, `cotizador/[code]`, `cola-qr/[id]/imprimir` y
`/studio/debug` (entorno, deploys de Vercel). RLS no cubría nada de esto: filtra
por **tenant**, no por rol.

- [x] 5 `layout.tsx` nuevos con el patrón documentado de `cobranzas/layout.tsx`
- [x] `lib/studio/rbac-subroute-guard.test.ts` audita **la clase** de hueco, no los
      5 casos. Mutación: borrar `clientes/layout.tsx` lo pone rojo nombrando
      `clientes/[markbox]/page.tsx`

### ✅ Route handlers sin sesión · `93bbe6a3`

Cuatro rutas de `/api/studio` traen en su docblock *"Auth: sesión Supabase válida
obligatoria"* y **no había una sola llamada a `getUser()`**. La única defensa era
RLS, que no filtraba datos —un anónimo veía cero filas— pero dejaba dos agujeros:

- Un `update … .eq("id", …)` que RLS bloquea **afecta 0 filas y no devuelve
  error**: el DELETE de un envío respondía `{ok: true}` a un llamador sin sesión.
- Cero defensa en profundidad. Si una policy regresa, no queda nada detrás.

Y ninguna estaba cubierta por el proxy: refresca la sesión en `/studio/*`, no
autoriza, y su matcher ni siquiera incluye `/api/studio`.

> ⚠️ **`kpis` y `shipments` no tienen un solo consumidor en el repo.** Es API
> muerta que exponía GET/POST/PATCH/DELETE de envíos. Las dejé **gateadas, no
> borradas**: borrar una superficie HTTP puede romper un integrador que no veo
> desde acá. Decisión tuya (Cubeta 2).

**El contrato nació decorado y la mutación lo delató.** La primera versión buscaba
el nombre del guard en todo el archivo, así que la línea del `import` ya lo
satisfacía: le saqué la llamada a `kpis`, dejé el import, y siguió verde. Al
apretarlo a la **llamada** aparecieron dos rutas más que la versión floja tapaba —
`bugs/[id]` PATCH (hueco real, arreglado) y `audit/export` GET (falso positivo:
autoriza en la **base**, vía la RPC `audit_authorize_export_download`, que es un
patrón más fuerte; queda declarado con su motivo en vez de aflojar la regla).

### ✅ Lote 4 — Feature flags que mienten · `5aba01d1` · SDD-0240

Eran tres bugs que se tapaban entre sí:

- [x] **`marketing_news` nunca pudo encenderse.** Se agregó al catálogo del
      *código* sin migración que lo sembrara; la RPC de toggle hace `UPDATE` sobre
      una fila que tiene que existir → `invalid_state`. Y como `noticias-web` exige
      el flag para dejar entrar, **el módulo quedó inalcanzable**: no había forma de
      encender lo único que lo abre.
- [x] **El error era invisible.** El UI filtra el mensaje por flag
      (`state.flagKey === flagKey`) y el `catch` devolvía `{ error }` **sin
      `flagKey`**. La condición nunca se cumplía. Por eso el bug de arriba sobrevivió
      sin que nadie lo reportara: no había nada que reportar, sólo un botón muerto.
- [x] **Ningún trigger siembra los flags de un tenant nuevo.** `0042` y `0066` usan
      un `DO` de una sola pasada sobre los tenants de ese día. Un tenant creado
      después nace con **cero filas** y todos sus toggles levantan `invalid_state`:
      el panel llega roto de fábrica a los **aliados white-label**.
- [x] **17 de 22 flags no tienen un solo consumidor** (no 16 de 21: `vault` sí
      esconde `no-olvidar`, y el contrato me lo corrigió). Cada tarjeta ahora dice
      qué hace la suya y la grilla ordena por efecto real.
- [x] `dispatch.show_warehouse_location` expuesto en el panel: se lee de verdad en
      la PWA del bodeguero y sólo se podía tocar por SQL.

> **`sidebar` no es un permiso.** Apagar `customs_seniat` esconde el link, pero
> `/studio/seniat` sigue abriendo por URL — la misma clase de hueco que cerró
> SDD-0085. La tarjeta lo dice con todas las letras. Convertirlos en guard real es
> cambio de comportamiento → Cubeta 2.

Migración **0337 no aplicada**: queda como archivo. Mutaciones: quitar
`marketing_news` del catálogo SQL → rojo nombrando la cura; desconectar el trigger
→ *"tenant NUEVO nació con 0 filas, esperaba 22"*.

### ✅/⬜ Lote 5 — Poda y documentación de entrada

- [x] **`AGENTS.md`** · `7a807805` — la tabla de integraciones públicas tenía **3 de
      4 filas falsas** y hasta la nota al pie. El RPC `public_track_shipment` figuraba
      usado por `/track`, que hoy es 301 a `/portal/login` y dejó al RPC **sin un solo
      consumidor**; `/api/contact` figuraba usado por `/contacto`, cuando en realidad
      `/contacto` manda sólo por WhatsApp y quien lo usa es `/academia`.
- [x] **`.env.example`** · `08cac148` — no eran 6 variables sino **18**, entre ellas
      `MARCA_ACCESS_SECRET` (sin valor cae a un default de desarrollo) y las tres de
      SeaRates que protegen la cuota mensual del plan.
- [x] **Sitemap** · `babeef38` — no eran 6 páginas sino **4**, y son las que más
      duelen: `/servicios/{puerta-a-puerta,fcl,lcl}` y `/llenado`. Existen, tienen
      metadata y OpenGraph propios, ningún `noindex`… y no estaban.
      `/servicios/inspeccion` **sí** estaba desde siempre: tener una de las cuatro
      adentro es lo que hizo que el hueco no saltara a la vista. Contrato nuevo en
      las dos direcciones (pública sin `noindex` → tiene que estar; con `noindex` →
      no puede estar), registrado en `docs/marketing/seo.md`.
- [ ] Código muerto **verificado uno por uno** (ver §5: la lista del auditor tenía un
      falso positivo que habría roto la calculadora)
- [ ] Basura de raíz: el informe stub está **sin trackear en el checkout principal**,
      no en git — hay que borrarlo desde allá, no desde esta rama
- [ ] 21+ URLs huérfanas sin enlace interno (distinto del sitemap: es navegación)

### ✅ Lote 6 — Alinear specs con la realidad · `04eee0f2`

- [x] **8 volteadas**, verificadas contra código y commits en `origin/main`, no
      contra el front-matter: `0059, 0149, 0157, 0159, 0169, 0170, 0171, 0184` → `done`.
- [x] **`0152` → `superseded`.** `0155` ya declaraba `supersedes: 0152`, pero `0152`
      tenía `superseded_by: null`: el enlace era de **una sola vía**, así que quien
      abriera `0152` primero no se enteraba de que estaba reemplazada.
- [x] `0184` §7 daba `0294-0296` y mandaba aplicar una `0296` de **otro
      workstream**. Las reales son `0297/0298/0299`, las tres en producción.
- [x] `0075` decía `SHIPMENT_ACCEPTANCE_CTA_LIVE = false` describiendo un gate que
      ya no existe (se prendió en `a08373a6`). Sigue `in-progress`, pero por el
      Slice B, no por el rollout.

**Tres hallazgos que explican por qué driftea** — y dos de ellos me corrigieron a mí:

1. **`0059` no estaba a medias: su Slice C se construyó bajo otro número.**
   `SDD-0115` dice en su línea 16 *"Cierre del Slice C de SDD-0059"* y está `done`
   desde junio. Incluso el "Pendiente: parser CSV" de `0059` §6 se resolvió ahí
   (`57e09236`). Yo mismo lo había dado por pendiente leyendo sólo `0059`.
2. **`0160` aparecía con CERO commits y sin embargo está en producción.** La spec se
   escribió como `0157` —número ya tomado por Kommo— y se renumeró en `cdc8d1a7`,
   pero el código, la migración `0249` y todos los mensajes de commit se quedaron
   con el número viejo. Buscar `SDD-0160` no devuelve nada. Anotado en la spec y en
   la cabecera de `0249` (el **número** de la migración no se toca: ya corrió así).
3. **Siete specs `done` citaban migraciones inexistentes**, todas por renumeración
   que no se propagó al cuerpo: `0020` (0012→**0015**`_agents`), `0044`
   (0087→**0088**`_tesoreria`), `0095` (0145→**0146**`_ocean_rates`), `0109`
   (0178→**0179**`_nomina_settlements`), `0113` (0178→**0180** y 0179→**0181**).
   `docs:check` no lo veía: valida el front-matter, **no el cuerpo**.

Contrato nuevo `scripts/__tests__/spec-migration-refs.test.ts`: toda migración
citada por una spec `done`/`in-progress` existe (las `proposed`/`draft` quedan
fuera a propósito — nombrar la migración que vas a crear es legítimo), y
`supersedes`/`superseded_by` tienen que ser recíprocos. Ambas dimensiones
validadas con mutación.

> **No tocadas a propósito:** `0224` y `0235` (`approved` con migraciones en el
> repo) son del workstream de **Codex**, con ramas activas en `origin`. Tu regla:
> no toco ramas de otras ventanas.

`in-progress`: 21 → 12 · `done`: 199 → 207

- [ ] `/portal/envios` sin sus tabs — hallazgo abierto de SDD-0179 §5 desde el 20-jun

---

## 4. CUBETA 2 — requiere tu decisión

| # | Qué es | La pregunta |
|---|---|---|
| 1 | **POD que no cierra el embarque.** La entrega muere en `dispatch_pods`. | ¿Construyo el cierre (POD → `shipments` + evento + aviso)? Es el corte más grave del ERP. |
| 2 | **Rescatar las 5 migraciones de seguridad varadas** (0316, 0326–0329). `git merge-tree` dice que mergea limpio. | ¿Las rescato a mi rama, o queda para su propia ventana? |
| 3 | **Aplicar 0316 a prod.** Sin ella "Anular" de Finiquito falla y descuadra el asiento. Además, con su archivo fuera del repo, `schema-rebuild` y los contratos SQL **validan un schema que no es el de producción**. | ¿Autorizas aplicarla, nombrándola? |
| 4 | **`ve_locality_catalog`**: RLS sin política deja 98 localidades invisibles → `/studio/admin/rutas` roto en prod. | ¿Escribo la migración y la aplicas tú? |
| 5 | **Leads que no se guardan.** | ¿Persisto los leads públicos en tabla? Sin eso, CRM·Leads y la medición de Ads no existen. |
| 6 | **Factura en PDF** — está a un documento, no a un proyecto. Pero `invoices` **no tiene `control_number`** y el Libro de Ventas lo declara vacío. | ¿Construyo el PDF? ¿Y agrego el número de control fiscal? |
| 7 | **Despacho lee China, no Venezuela.** | ¿Extiendo la cola a `warehouse_receipts_ve`? |
| 8 | **SDD-0195: el sync de Kommo se auto-traba.** Incidente real de 13 días muertos. | ¿Lo construyo? |
| 9 | **Studio sin recuperación de contraseña.** Hoy se arregla por SQL. | ¿Lo construyo? |
| 10 | **Storage sin respaldo ni runbook de recuperación.** Los backups de Supabase cubren la base, **no los objetos**: POD, comprobantes, cédulas, evidencia legal. | ¿Prioridad? Bloquea evaluar la migración a VPS. |
| 11 | **`mobile_operator = false`** oculta "Cola de QR" y "Operarios PWA" con la PWA en producción. | ¿Lo enciendo? |
| 12 | **`/servicios` promete un recargo que DTD no cobra.** El copy vive en una **fila de producción**. | ¿Corrijo el texto en la base? |
| 13 | **Google Ads**: Final URL y 2 de 3 sitelinks apuntan a URLs que hacen 301. | ¿Actualizo la campaña? |
| 14 | **53 de 70 ramas locales y 26 worktrees sin un commit propio.** | ¿Podo? |

### Nuevas · salieron del trabajo de esta ronda

| # | Qué es | La pregunta |
|---|---|---|
| 15 | **Aplicar `0337` a prod** (siembra de feature flags + trigger por tenant). Sin ella, el interruptor de Noticias Web sigue sin poder encenderse y el panel de admin nace roto para cada aliado white-label. No pisa ningún valor ya elegido (`ON CONFLICT DO NOTHING`). | ¿Autorizas, nombrándola? |
| 16 | **`/api/studio/kpis` y `/api/studio/shipments` son API muerta**: cero consumidores en el repo, y exponían GET/POST/PATCH/DELETE de envíos. Las dejé gateadas, no borradas. | ¿Las borro? Sólo tú sabés si hay un integrador externo llamándolas. |
| 17 | **`customs_seniat` y `mobile_operator` sólo esconden del sidebar.** `/studio/seniat` sigue abriendo por URL. Convertirlos en guard real es cambio de comportamiento. | ¿Los convierto en gate de verdad, o quedan como preferencia de producto? |
| 18 | **17 de 22 feature flags no tienen consumidor.** Hoy están etiquetados honestamente. | ¿Se podan (perdés la intención registrada) o se van cableando de a uno? |
| 19 | **El número de SDD en los commits no es confiable** tras una renumeración por colisión: `SDD-0160` está en producción y `git log --grep` devuelve cero. `pnpm sdd:next` evita la colisión *futura*, pero no repara la trazabilidad de lo ya renumerado. | ¿Vale un barrido de residuos, o alcanza con anotarlo caso por caso? |

---

## 5. Los 5 falsos positivos (no los persigas)

La refutación adversarial mató cinco hallazgos que parecían graves:

1. **`/contacto` "perdió la captura server-side"** → decisión tuya documentada en el
   propio código (mockup Cloud Design, variante C).
2. **El aviso del estimado "está muerto"** → intencional: el CTA es WhatsApp directo
   desde Fase 3.
3. **`review-no-olvidar` "sin backup fuera de git"** → falso: está publicada en
   `origin/feat/no-olvidar`.
4. **La 0257 sin aplicar** → declarada a propósito en `migrations-baseline.json`.
5. **3 funciones SECURITY DEFINER "expuestas a anon"** → falso positivo del advisor:
   son funciones de *trigger*, no RPCs.

Y uno más que caché yo al verificar antes de borrar: el auditor reportó
**`EstimadoModal.tsx` como código muerto**. Es falso — está importado y usado en
`CalculadoraForm.tsx`. Borrarlo rompía la calculadora. `EstimacionForm.tsx` sí está
muerto. **Por eso el Lote 5 se ejecuta archivo por archivo, no por lista.**

---

## 6. Orden de ataque

1. **Sincronizar primero.** `origin/main` avanzó durante la auditoría (a `9a178614`,
   otra ventana cerró SDD-0238). Ya está mergeado en esta rama. Los `archivo:línea`
   de los informes pueden estar corridos: verificar antes de aplicar.
2. **Integridad del gate antes que nada** (hecho): sin un gate honesto, el verde de
   todo lo demás no prueba nada.
3. La 0316 envenena `schema-rebuild` y `sql-tests`: **su archivo tiene que entrar al
   repo antes de confiar en cualquier verde de esos dos pasos.**
4. **El gate no compila el proyecto** — no hay paso `build` en `verify.mjs` ni CI
   remoto. En una corrida sin supervisión hay que correr `pnpm build` a mano.

---

## 7. Lo que no se toca

- **`PURGE_RECEIPT_ORPHANS_ENABLED` y `BITACORA_PURGE_ORPHANS_ENABLED`**: prohibidos
  por mandato del founder (SDD-0224 §8.1).
- **SDD-0025 (No-Olvidar)**: dormante por decisión del founder. Cero gasto.
- **Los 104 `BASELINE-*.md`**: son registro de gobernanza referenciado. No se borran.
- **Ninguna migración ya aplicada se renumera.**
- **Cero push.**
