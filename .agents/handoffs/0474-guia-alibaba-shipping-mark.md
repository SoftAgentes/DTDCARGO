# Handoff — SDD-0474 · Guía de Alibaba: Shipping Mark, costo real y servicios plegados

- **Fecha:** 2026-09-17
- **Rama:** `claude/alibaba-guide-registration-services-d3f97c`
- **Base:** `747637e6` (merge del PR #129, SDD-0468)
- **Spec:** [`docs/specs/0474-guia-alibaba-shipping-mark-y-costo-real/spec.md`](../../docs/specs/0474-guia-alibaba-shipping-mark-y-costo-real/spec.md)
- **Encargo:** founder, 2026-09-17, con capturas de la guía en producción.

## Qué quedó hecho

| # | Cambio | Dónde |
|---|---|---|
| 1 | «MARKBOX» → «Shipping Mark» (18 apariciones). Identificadores internos intactos | `public/guias/comprar-en-alibaba.html` |
| 2 | El Shipping Mark no se puede inventar: campo bloqueado con mark real, dos puertas sin él. La plantilla del proveedor lo lleva. El link de registro del Paso 7 ya es un `<a>` | ídem |
| 3 | Calculadora sin arancel / IVA / last mile; flete desde el CBM con la tarifa viva del ERP; la regla de los 1.000 kg por m³ explicada | ídem + `app/api/public/cbm-rate/route.ts` |
| 4 | Los 10 bloques de servicio plegados (`<details>`) y sin «Pedirlo por WhatsApp» | ídem |
| 5 | Compra mínima **$1.000** (las dos tablas); dirección una vez por propósito; «FOB Yiwu»; QC con enlaces reales | ídem |
| 6 | El alta guarda por qué puerta entró (`clients.registration_channel`) | `lib/public/registro-origen.ts`, `app/registro/*`, `app/academia/page.tsx` |
| 7 | El cierre de la guía lleva al registro, con los datos recogidos del `localStorage` (no de la URL) | guía + `app/registro/RegisterForm.tsx` |
| 8 | **Red nueva:** `pnpm guia:check` valida sintaxis e invariantes de la guía; entra en `verify` por test | `scripts/check-guia-alibaba.ts`, `__tests__/guia-alibaba-html.test.ts` |

## Evidencia

| Comprobación | Resultado |
|---|---|
| `pnpm exec tsc --noEmit` | **PASÓ** (exit 0) |
| `pnpm exec eslint` (archivos tocados) | **PASÓ** (exit 0, 0 warnings) |
| `pnpm guia:check` | **PASÓ** |
| `vitest` — guía + origen + endpoint | **PASÓ** (18 tests) |
| `vitest` — canal del alta | **PASÓ** (7 tests) |
| `vitest` — calculadora y Paso 7 en jsdom | **PASÓ** (13 tests) |
| Control rojo · canal del alta | **PASÓ** — mutante → 3 rojos |
| Control rojo · calculadora (×2) | **PASÓ** — mutantes → 1 y 2 rojos |
| Control rojo · copiar todo | **PASÓ** — mutante → 1 rojo |
| `pnpm sdd:check` | **PASÓ** (sin números repetidos) |
| `pnpm docs:index` | **PASÓ** (461 specs) |
| Revisión visual en navegador | **PASÓ** — encontró un bug, ver abajo |
| `pnpm verify` | ver al cierre de la sesión |

### Los tres hallazgos que valieron la pena

**1 · El check de la guía evitó una página en blanco.** Durante la
implementación se introdujo `<a href="https://…">` **con comillas dobles dentro
de un string delimitado por comillas dobles**. Eso deja la guía en blanco —el
`<script>` entero no parsea— y **nada en el repo lo habría visto**: no pasa por
build, ni ESLint, ni `tsc`. Se detectó con un check ad hoc, y por eso el check
se quedó en el repo (`scripts/check-guia-alibaba.ts` + test).

**2 · La revisión visual encontró un botón invisible.** El «Regístrate y obtén el
tuyo» se pintaba como un **rectángulo wine sin texto**: la regla preexistente
`.dir-mark .h a` (0-3-0) le ganaba en especificidad a `.dir-mark .mk-prim`
(0-2-0), así que el texto salía wine sobre fondo wine. Arreglado subiendo la
especificidad a `.dir-mark .h .mk-puertas a.mk-prim`. Comprobado en el navegador:
`color: rgb(255,255,255)` sobre `rgb(127,15,26)`. **Ningún test de texto lo
habría visto** — hacía falta mirar.

**3 · La auto-revisión del diff encontró un bug que las pruebas a mano no
vieron.** El «Copiar todo» del Paso 7 copiaba **sólo el destinatario**, sin
dirección ni teléfono, cuando SÍ había Shipping Mark: el handler reconstruía
`"林冠 "+mark` para todo botón con `data-field="destinatario"`, que es lo
correcto en el Paso 1 (ahí copia un campo suelto del formulario) pero no en la
tarjeta compacta. **No se vio al probarlo en el navegador porque se probó el caso
sin mark**, donde el guardarraíl corta antes de copiar — y el caso con mark es
el normal. Arreglado, con test de las tres líneas y su mutante. Commit
`ebf91e47`.

**4 · Los controles rojos confirman que los tests detectan.**
- Canal del alta: con la action confiando en el formData
  (`String(formData.get("origen"))`), **3 casos rojos** — origen inventado,
  `'admin'` declarado desde la web, y valor larguísimo.
- Calculadora: ignorando el mínimo cobrable → **1 rojo** ($12,55 vs $15,00);
  calculando el flete sobre las unidades en vez del CBM → **2 rojos** ($853,00
  vs $6,40).
- Copiar todo: reintroduciendo el bug → **1 rojo** (`'林冠 DTD-1042'` no
  contiene la dirección).

### Sobre el test de la calculadora

`__tests__/guia-alibaba-calculadora.test.ts` **carga la guía en jsdom y la
ejecuta**: monta el HTML con `runScripts: "outside-only"`, prepara el entorno
(`matchMedia`, que jsdom no trae; `Element.animate`, que tampoco) con el `fetch`
simulado, corre el script una vez con `window.eval` y avanza por la UI hasta el
Paso 4 esperando a que el DOM confirme cada cambio de etapa —`completarEtapa`
tiene un `setTimeout` de 650 ms que no depende de `prefers-reduced-motion`, y con
esperas fijas la guía rebotaba entre etapas.

Verifica el número que el cliente va a leer: **FOB $3 × 500 unidades × 2 m³ →
$6,40 la unidad puesta en Venezuela**, el mínimo cobrable, que no aparezca
arancel/IVA/last mile, y los dos caminos de fallo (sin tarifa y con el `fetch`
caído). Necesitó `@types/jsdom` como devDependency (el repo ya usaba `jsdom`).

## Lo comprobado en el navegador (dev server, `localhost:3000`)

| Caso | Resultado |
|---|---|
| **Inicio** | sin dirección; solo la promesa que remite al Paso 1 |
| **Anónimo · Paso 1** | **no hay input** (`hayInput: false`); placeholder `DTD-XXXX`; las dos puertas con sus hrefs (`/registro?origen=guia-alibaba` y `/portal/academia`) |
| **Con `?mark=DTD-1042&name=Sam`** | saludo «Hola Sam · tu Shipping Mark es DTD-1042…»; campo `readonly` con el valor; destinatario `林冠 DTD-1042` |
| **Plantilla del Paso 4** | trae `DTD-1042` en el texto, en el glosario y en lo que copia el botón |
| **Paso 7 · dirección** | tarjeta compacta, 3 campos, **un solo «Copiar todo»**, cero campos individuales; el portapapeles lleva destinatario + dirección (con `金华市`) + teléfono, bilingüe |
| **Guardarraíl sin mark** | copiar avisa «Regístrate primero ↑» en vez de pegar `DTD-XXXX` |
| **Servicios** | cerrados, abren con clic y el chevron gira; **cero `wa.me` dentro**; único CTA «Ver todos los servicios →» / «Ver la línea de inspección →» |
| **Endpoint** | `200` con `Cache-Control: s-maxage=300`; sin credenciales devuelve `per_cbm: null` y la guía cae a su fallback **sin romperse** |
| **«MARKBOX» en la página** | cero |

> El worktree **no tiene** `.env.local` (AGENTS: no se copian secretos a
> worktrees), así que el navegador probó el **camino de fallo** del endpoint. El
> camino con tarifa está cubierto por el test en jsdom con `fetch` simulado.

## Pendientes de esta tarea

1. **`/ui-check` sobre el diff visual.** Los `<details>`, la tarjeta del Shipping
   Mark y el cierre nuevo son cambio de UI sustancial. No se corrió.
2. **El alta, extremo a extremo con DB local.** El camino de la action está
   cubierto por 7 tests con control rojo; falta completar un registro real contra
   Supabase local y ver la fila con `registration_channel = 'guia-alibaba'`.
   Nunca contra producción.
3. **Prellenado desde la guía, a mano**, incluida la ventana privada
   (localStorage bloqueado → el registro debe cargar vacío, sin error en
   consola). El lector está entre `try/catch` y la clave/forma se verificaron
   contra el `persist()` de la guía, pero el recorrido completo no se probó.
4. Nada más. (`.claude/launch.json` se creó para levantar el dev server desde la
   sesión, pero `.gitignore:88` ya lo excluye: no entra al repo.)

## FUERA DE ALCANCE DETECTADO

- **`supabase/migrations/0393_academia_widget_alibaba_curso.sql` sigue sin
  aplicar a producción** (viene señalado desde 2026-08-25). Cualquier lección
  con `widget='alibaba_curso'` revienta el CHECK `academy_lessons_widget_chk`.
  Exige OK del founder nombrándola y el
  [runbook de producción](../../docs/runbooks/aplicar-migraciones-prod.md).
- **`syncLead()` de la guía es un `console.log`** (línea del comentario
  `// === ENVIAR A SUPABASE/KOMMO ===`). Perfil, nombre, WhatsApp, producto, CBM,
  landed y scorecard se capturan y mueren en `localStorage`. Ojo: el precedente
  de `/api/public/estimacion` dice que el visitante **no registrado no genera
  filas en el ERP** (founder 2026-07), así que conectarlo es una decisión de
  producto, no una tarea técnica pendiente.
- **`lib/calculadora.ts:66` (`tarifaBaseCBM: 800`) está desalineado del $850
  vivo**, a propósito según la cabecera de la migr 0336. Y **el 2026-10-05 la
  tarifa de la DB cae sola a $800** si nadie la renueva desde `/studio/tarifas`:
  el `pg_cron` de la 0336 puso vigencia hasta el 2026-10-04. La guía ahora la lee
  en vivo, así que se actualizará sola — pero la caída sigue ahí.
- **La guía no está en `app/sitemap.ts`** (ni en `llms.txt`). Se alcanza desde
  `/academia`, el FAQ y dos tarjetas del portal.
- **La dirección de Yiwu sigue hardcodeada** en la guía en vez de venir de
  `CONTACT.cn` (`lib/design-tokens.ts:265-310`). Inherente a un HTML estático sin
  build; al menos quedó en **una** constante (`DIR_AUTOFILL`) y no en tres
  literales divergentes.
- **Los otros dos HTML sueltos de `/public`** (`public/interno/guia-peso.html`,
  `public/marca/Portada Animada FB · DTD-Cargo.html`) tampoco pasan por ningún
  check. El molde de `scripts/check-guia-alibaba.ts` se generaliza fácil si se
  quiere cubrirlos.

## Autorizaciones que faltan

- **Publicar la rama y abrir el PR** — no pedido aún.
- Merge y deploy: fuera de esta tarea.
- **Nada de DB de producción.** Este trabajo no lleva migración.
