# RESUMEN — Reorden + Acordeón del Sidebar del Studio (Modo Forja)

- **Rama:** `feat/menu-orden`
- **Worktree:** `../DTD-worktrees/menu-orden`
- **Commits:**
  - `fd1db616` — refactor(studio): reordenar sidebar por lógica de negocio
  - `a8d036cc` — feat(studio): sidebar acordeón (una sección abierta a la vez, patrón Norte)
  - `bfaea38c` — feat(studio): sub-grupos anidados + slider de ancho (patrón Norte)
  - `98a6e21c` — docs(forja): RESUMEN de la sesión
  - `c9b2a368` — feat(portal): Referidos — invitar por correo + recompensa "Próximamente"
  - `6bf40663` — feat(portal): Referidos Fase 2A — capturar ?ref= en el registro
  - `ca8ba1ab` — feat(db): Referidos Fase 2B — trigger acreditación automática (migr 0195)
- **Archivos tocados:** `lib/studio/modules.ts` · `app/studio/(app)/_components/StudioSidebar.tsx` · `lib/i18n/{es-VE,zh-CN}/chrome.ts` · **+ Referidos portal** (ver Cambio 4).
- **Sin migración, sin tocar prod, sin push.**

> ⚠️ **Director:** esta rama lleva DOS temas por decisión explícita del founder
> (2026-07-01): el **sidebar** (Cambios 1-3) y **Referidos del portal** (Cambio 4).
> Son independientes; se pueden mergear/cherry-pickear por separado si se prefiere.

## Cambio 2 — Acordeón de secciones (alinear al Norte)

El founder pidió llevar el sidebar al comportamiento del Norte vigente: **no abrir
todo el menú, sino ir abriendo las secciones de a una**. Revisé
[`_norte/erp/shell.jsx`](docs/design/studio/_norte/erp/shell.jsx) — el Norte usa un
**acordeón** con estado `openGroup` (UN solo grupo abierto a la vez), no un dict de
todos-abiertos como tenía el Studio.

Porté ese patrón a `StudioSidebar.tsx`:
- **Una sola sección abierta a la vez.** Click en un header abre esa sección y
  colapsa las demás; si ya estaba abierta, la cierra (`null` = todas cerradas).
- **Auto-abre la sección del módulo activo** al navegar (colapsa el resto) — igual
  que el Norte (`useEffect` sobre `activeGroup`).
- **Arranca** en la sección del módulo donde estás parado (o la primera si ninguno).
- **Persistencia:** localStorage key `studio_sidebar_opengroup` (reemplaza el viejo
  dict `studio_sidebar_groups`); se restaura solo cuando no hay sección activa.
- **Colapsado (solo iconos):** el acordeón se ignora y se muestran todos los iconos,
  igual que antes.
- **Cero cambios de estilo/tokens** — solo la lógica de apertura. El chevron ya rota
  0/-90deg y los estados hover/active se mantienen.

> Nota: no porté los **sub-grupos anidados** del Norte (`parent`: almacenes,
> despachogrp) — eso es una segunda funcionalidad más grande (agrega clusters
> colapsables dentro de OPERACIÓN) y el founder pidió puntualmente "abrir por
> secciones" (el acordeón). Lo dejo anotado como posible siguiente paso si lo quiere.

**Revisión ui-ux-designer:** OK-con-notas. La única nota High ("al cerrar la sección
activa se pierde el rastro de dónde estás") **quedó cerrada** con el label en
`--ink-side-strong` + dot `--wine-soft` en el header del grupo activo colapsado. Las
otras 3 notas eran paridad con el Norte (sin acción). Menor pendiente advisory: en
rutas sin módulo en `MODULES` (ej. `/studio/ajustes`) el acordeón arranca abriendo la
primera sección (OPERACIÓN) — igual que el Norte defaultea a `INICIO`; inofensivo.

## Cambio 3 — Sub-grupos anidados + Slider de ancho (alinear al Norte)

El founder pidió alinear también la **parte visual** del sidebar al Norte —
puntualmente el **Slider** (ajuste de ancho) — y los **sub-grupos anidados**.

**Sub-grupos anidados (clusters).** Porté el registro `PARENTS` del Norte a
[`modules.ts`](lib/studio/modules.ts) (nuevo campo `parent` en `ModuleDef`, no toca
routing ni RBAC — solo presentación). Dentro de OPERACIÓN hay ahora dos clusters
colapsables con header indentado:
- **Almacenes** (warehouse): Almacén CN · Cola de QR · Etiquetas CN · Almacén VE
- **Despacho** (truck): Despacho · Reglas despacho · Dashboard despacho

Render en `StudioSidebar.tsx`: `buildUnits()` arma hojas y clusters; `renderParent()`
dibuja el header toggle + hijos indentados (16px, ícono 16, chevron 0/-90deg). Si un
hijo está activo, el cluster se fuerza abierto (nunca perdés el activo). En modo
colapsado (solo iconos) los clusters se aplanan a iconos sueltos, igual que el Norte.
Estado por cluster en localStorage `studio_sidebar_parents`.

**Slider de ancho.** Handle draggable de 5px en el borde derecho (`startResize`) que
ajusta la var CSS `--sb-expanded` en vivo (rango **200–280px**), persistido en
`studio_sb_w` y restaurado al montar. Hover tiñe el handle con `var(--wine-soft)`.
Portado 1:1 del Norte.

**Decisión del founder (2026-07-01): "ALMACÉN VE SÍ AGRUPAR".** ✅ Se queda dentro del
cluster **Almacenes** junto a Almacén CN (fiel al Norte, almacenes = un área). No se
mueve después de aduana. Cerrado, sin pendiente.

**i18n:** agregué 3 claves a es-VE y zh-CN (`chrome.sidebar.cluster_almacenes`,
`chrome.sidebar.cluster_despacho`, `chrome.sidebar.resize`).

**Nota menor (redundancia):** el cluster "Despacho" contiene un hijo también llamado
"Despacho" (header Despacho › item Despacho) — es exactamente como el Norte; los
labels no se acortaron para no tocar i18n de más. Fácil de pulir si molesta.

**Revisión ui-ux-designer (2ª pasada):** OK-con-notas. Las 3 notas High/Medium eran
todas del slider y **quedaron cerradas**: (1) era invisible en reposo → ahora tiene
hairline `--border-side` visible que pasa a `--wine-soft` en hover; (2) target 5px +
`clientX` crudo → hit-area 8px + delta desde `startX` + doble-click resetea; (3) sin
pointer-capture → ahora `setPointerCapture` (no se pierde el `up` fuera del viewport).
Las 2 notas Low las dejé (coinciden con el Norte): la redundancia "Despacho › Despacho"
(renombrar el hijo rompería el label del topbar en `/studio/despacho`) y el force-open
del cluster cuando hay hijo activo (es el comportamiento seguro: nunca ocultás el activo).

**Verificación (Cambio 2 + 3):** `verify.mjs` TODO VERDE (2965 tests, lint 0 errores) ·
typecheck · `next build` exit 0.

## Qué es esto

Trabajo de **ORDEN**, no de features. El array `MODULES` en
[`lib/studio/modules.ts`](lib/studio/modules.ts) es la fuente única del orden en
pantalla (el sidebar agrupa por `group` y respeta el orden del array dentro de
cada grupo). Reordené ese array y corregí **un** `group`. **No agregué ni quité
módulos** → los 55 siguen intactos, la matriz RBAC no se toca y el test
anti-drift (`rbac.test.ts`) queda verde.

## Qué reordené (por grupo)

### OPERACIÓN — sigue el viaje de la carga
Antes `Almacén VE` e `Inventario` quedaban **antes** de naviera/aduana, rompiendo
la secuencia física. Nuevo orden:

1. Cockpit: Dashboard · Embarques · Tracking · Calendario
2. Origen CN: Almacén CN · Cola de QR · Etiquetas CN
3. Tránsito: **Naviera & Consolidación → Aduana SENIAT → Almacén VE**
4. Última milla: TMS · Despacho · Reglas despacho · Dashboard despacho · Rutas y ciudades
5. Stock + post-venta: Inventario · WMS · Reclamos · Inspecciones

Sub-páginas de despacho (reglas/dashboard) quedan juntas y debajo de su padre.
`Rutas y ciudades` (config de ruteo, RBAC operations) se queda en OPERACIÓN,
pegada al bloque despacho/TMS que la usa.

### COMERCIAL — cliente → CRM → órdenes → catálogo → lealtad
Estimados · Clientes → CRM (Conversaciones · Leads · Kommo) → Órdenes (venta →
sourcing: proveedores → compra) → Catálogo (Servicios · Tarifas) → Lealtad
(Fidelización · Club · Academia agrupadas; antes Academia partía a Club).

### FINANZAS — dashboard → dinero diario → libros → análisis → admin
Dirección (exec, admin) → dinero diario (Facturación · Cobranzas · Gastos ·
Tesorería) → libros/fiscal (Contabilidad · Fiscal) → análisis (Costing ·
Reportes) → personas + admin-only al fondo (Nómina · Rendiciones · Financiero
China). Antes los admin-only estaban intercalados con lo operativo del día.

### MARKETING
Sin cambios (Marketing · Noticias Web).

### SISTEMA — utilidades de todos primero, config/admin al final
Menciones · Documentos · Mis reportes · Bug Tracker → luego config/admin
(Operarios PWA · Usuarios · Administración · Mailing · Legal · No-Olvidar).
El más sensible (No-Olvidar, recovery custodial) queda de último.

## Único cambio de `group`

- **`documents` (Documentos): FINANZAS → SISTEMA.** Es un hub polimórfico de
  documentos de todas las áreas y su RBAC lo da a **todos los roles** (igual que
  menciones/bugs), no es módulo de dinero → encaja con las utilidades
  transversales de SISTEMA, no en FINANZAS. ✅ **CONFIRMADO por el founder
  (2026-07-01): "DOC SISTEMA" → se queda en SISTEMA.**

## No toqué

- **StudioSidebar.tsx** — cero cambios de estilo, tokens o estructura visual. El
  componente ya tiene grupos colapsables; no hacía falta agregar separadores ni
  chrome nuevo. Por eso **no se dispara el gate de `ui-ux-designer`** (ese aplica
  cuando se tocan colapsables/separadores en el componente). El render es idéntico;
  solo cambia el orden de los ítems.
- **rbac.ts / rbac.test.ts** — intactos. Solo reorden + un `group` (el test no
  valida `group`, valida ids/adminOnly/roles).
- **i18n (es-VE / zh-CN)** — intactos. No renombré ni moví labels; reordenar el
  array no toca las claves `chrome.sidebar.*`.

## Módulos que creo que sobran/faltan (NO los toqué — decisión del Director)

- **`admin-rutas` (Rutas y ciudades):** su slug es `/studio/admin/rutas` pero vive
  en OPERACIÓN. Funcionalmente es config de ruteo para despacho/TMS, así que lo
  dejé en OPERACIÓN pegado a ese bloque. Si se prefiere tratarlo como config puro,
  podría ir a SISTEMA. Lo dejé como está por coherencia operativa.
- No detecté módulos duplicados ni claramente faltantes. `direccion` y `dashboard`
  y `despacho-dashboard` son tres "dashboards" distintos (exec / operación / despacho)
  — correcto, no son redundantes.

## Verificación (todo verde)

- `node scripts/verify.mjs` → **TODO VERDE**: lint (0 errores), rsc-boundary,
  typecheck, **test 2965 passed (205 files)**, docs:check.
- `tsc --noEmit` → exit 0.
- `next build` → exit 0 (todas las rutas `/studio/*` compilan).

> Nota de entorno: el worktree no traía `node_modules` (gitignored). Para verificar
> instalé deps con `pnpm install --frozen-lockfile` (hardlinks del store; el exit 1
> es el conocido `ERR_PNPM_IGNORED_BUILDS` de esbuild, no bloqueante). El primer
> intento de build con junction falló porque Turbopack rechaza symlinks fuera del
> root — se resolvió con install real.

## Para el Director (integración)

Merge de `feat/menu-orden` (3 commits: `fd1db616`, `a8d036cc`, `bfaea38c`) → correr
`node scripts/verify.mjs` + `pnpm build` → push con OK del founder. 4 archivos de
producción: `modules.ts`, `StudioSidebar.tsx`, i18n es-VE/zh-CN.

**Decisiones del founder ya cerradas (2026-07-01), sin pendientes:**
- **Documentos → SISTEMA:** ✅ confirmado, se queda.
- **Almacén VE:** ✅ confirmado, se agrupa dentro del cluster "Almacenes".

---

## Cambio 4 — Referidos del portal: invitar por correo + recompensa "Próximamente"

**Contexto (founder 2026-07-01):** la pantalla `/portal/referidos` era solo-lectura y
mostraba un saldo en dólares (`$0 acreditados`) como si el crédito fuera dinero
disponible. El founder quiso: (a) habilitar **invitar por correo** a un nuevo
importador ya, (b) **NO** encender pagos todavía, y (c) dejar claro que el bono se
gana **solo con la primera compra del referido**, con acreditación **automática** —
esa parte va como **"Próximamente"**.

**Lo que se construyó (ahora):**
- `lib/portal/referral-invite.ts` — core testeable: `inviteReferral` (valida correo,
  dedupe por referidor+correo, tope 10/día, genera código, inserta `referrals` en
  `invitado` con `reward_usd:0`) + `buildReferralInviteEmail` (correo de marca →
  `/registro?ref=CÓDIGO`). Aislamiento: admin client scopeado explícito por
  tenant+markbox (patrón de `portal-referral-queries.ts`).
- `app/portal/(app)/referidos/actions.ts` — server action fina (identidad por sesión,
  correo best-effort, `revalidatePath`).
- `app/portal/_components/ReferralInviteForm.tsx` — card "Invita por correo".
- `app/portal/(app)/referidos/page.tsx` — tile $80 con chip "Próximamente", tarjeta
  de créditos → "En construcción" (sin saldo falso), bloque "Cómo funciona".
- `lib/portal/__tests__/referral-invite.test.ts` — 9 casos.

**Fase siguiente (NO en este cambio · con pagos ON · SDD aparte):** captura del código
en `/registro` (linkear al referido) + **acreditación automática on-first-purchase**
(cuando el referido registra su primer embarque/factura → acredita el bono al
referidor solo). El estado enum ya lo soporta (`invitado→registrado→primer-embarque→
acreditado`). Recomendación: **Slice C de SDD-0051** — pedir correlativo al Director.

**Sin migración** (reusa `referrals`, migr 0098). **Revisado por ui-ux-designer:** OK
(3 pulidos Low aplicados: chip legible, disclaimer menos redundante, preheader del
correo). **Verificado:** test 9/9 · `verify.mjs` verde (2974 tests) · typecheck ·
`next build` OK.

---

## Cambio 5 — Referidos Fase 2: captura del código + acreditación automática

**Contexto (founder 2026-07-01, "SÍ ARRANCA"):** cerrar el lazo del programa. El bono
se gana **solo con la primera compra del referido** y se acredita **automático**.
Decisiones: señal = **primera factura emitida** (no el embarque); "acreditar" =
**registrar** el crédito (status + $80 visible), **advisory** — el asesor lo aplica,
cero movimiento de plata automático.

**Fase 2A — captura del `?ref=` en el registro** (commit `6bf40663`):
- `lib/portal/referral-link.ts` — `linkReferralOnRegister` (core testeable): dos
  caminos (invitación por correo = `referral_code`; código compartido = shareCode/markbox),
  guard anti-autoreferido + dedupe, best-effort. + test 10 casos.
- `app/registro/{page,RegisterForm,actions}.ts` — leer `?ref=` (patrón `?est=`), hidden
  input `ref`, llamada best-effort tras crear el cliente (no rompe el alta). `/registro`
  es Supabase-backed por diseño (no restringido por la frontera). El prop se llama
  `refCode` (`ref` es reservado en React); el campo del form sí es `"ref"`.

**Fase 2B — trigger de acreditación** (commit `ca8ba1ab` · **MIGRACIÓN 0195**):
- `supabase/migrations/0195_referral_auto_accredit.sql` — trigger `AFTER INSERT OR
  UPDATE OF status ON invoices` → función SECURITY DEFINER que, en la 1ª factura
  billable del cliente, resuelve `client_markbox→clients.id→referred_client_id` y
  acredita **idempotente por estado** (`registrado→acreditado` + `reward_usd=80`).
  Advisory: NO postea a CxC. + índice FK `referrals_referred_client_idx` (buenas
  prácticas Postgres, skill invocado) + `revoke execute` de la función (no expuesta).

> ⚠️ **DIRECTOR — MIGRACIÓN 0195 SIN APLICAR:** la escribí en la rama, **NO la apliqué
> a prod** (ventana secundaria). Aplicala y validala vos (dry-run `begin…rollback` o
> branch efímero). Los tests de vitest NO ejercen la DB (stubs). **E2E tras aplicar:**
> invitar por correo → `/registro?ref=REF-YYYY-NNNN` → registrarse (queda `registrado`)
> → emitir su 1ª factura → queda `acreditado` +$80 → el referidor lo ve en el portal.

**Recomendación:** formalizar Fase 2 como **Slice C de SDD-0051** (pedir correlativo).
**Verificado:** test 10/10 · `verify.mjs` verde (2984 tests) · typecheck · `next build` OK.
