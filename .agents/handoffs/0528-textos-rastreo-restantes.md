# Handoff · SDD-0528 · Textos públicos de rastreo que quedan: /entrar, glosario y llms.txt

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15, Caracas 02:20 a 03:00 aprox. (UTC 06:20 a 07:00) |
| Task ID / owner | `textos-rastreo-restantes` / subagente Worker del Director |
| Claim del harness | `worker-textos-rastreo-restantes` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-af5818079f13959fd` |
| Rama | `codex/textos-rastreo-restantes` (creada con `git switch --no-track -c` desde `origin/main`) |
| Base | `origin/main` `a8d99acf` (merge de la #223) |
| SDD | [0528](../../docs/specs/0528-textos-rastreo-restantes/spec.md), `in-progress`. Reserva local `codex/sdd-reserve-0528-textos-rastreo-restantes` (`2336fe2c`), sin push; es el número que dio `sdd:next --reserve`. Sin migración. |
| Estado de la tarea | lista para revisión |
| Permisos | commits selectivos, push de la rama propia y PR contra `main`. Sin merge (congelados hasta después del corte de esta noche), sin rebase, sin force push, sin producción ni base de datos. `pnpm verify` completo sin turno asignado. |

## Objetivo

Continuación de la SDD-0521. Sam eligió «Textos públicos que quedan», que el
Director le describió así: «Que el login (/entrar), el glosario, /servicios
(«Ves el estado de tu compra en todo momento») y llms.txt dejen de prometer
rastreo mientras esté en construcción. Las FAQ con Kommo y la política de
privacidad quedan aparte para tu decisión.» El Director dejó fuera
`components/servicios/hub-fichas.tsx` por un posible cruce con la SDD-0524.

## Qué se hizo

- **`/entrar`** (`app/entrar/EntrarForm.tsx`): los dos beneficios que nombró el
  encargo y, del barrido, el párrafo del panel lateral («Cotiza, sigue tus
  envíos y paga»), todos con el interruptor. Sólo texto: acción, formulario,
  campos, botones y enlaces no cambian, y una prueba lo fija.
- **Glosario** (`lib/design-tokens.ts` + `app/glosario/page.tsx`): campo opcional
  `enConstruccion: { body }` en `GlossaryTerm`, sólo en DTDU y POD.
  `cuerpoVigente()` lo elige para la ficha y para el JSON-LD `DefinedTermSet`.
  `lib/design-tokens.ts` sigue sin imports.
- **`public/llms.txt`**: el enlace al Portal se llama «Portal del cliente». No
  hay generador ni prueba previa de `llms.txt` (búsqueda en todo el repo).
- **Interruptor**: comentario de `lib/portal/tracking-en-construccion.ts` y
  `significa` de `scripts/feature-constants.json` con los lugares nuevos.
  `value` sigue en `true`.
- **Docs**: spec 0528, índice regenerado, viñeta nueva en
  `docs/marketing/README.md`. La última frase de la viñeta de la 0521 decía en
  presente que esos cuatro lugares «siguen prometiendo»; ahora dice que
  quedaron fuera de esa spec, para que no contradiga a la viñeta nueva.

### Textos (viejo → nuevo)

| Archivo | Lugar | Apagado (de siempre) | Encendido |
|---|---|---|---|
| `app/entrar/EntrarForm.tsx` | Panel lateral, beneficio 1 | Seguimiento por compra y contenedor | Tus compras y pre-alertas en un solo lugar |
| `app/entrar/EntrarForm.tsx` | Fila «Crear mi cuenta», beneficio 3 | Seguimiento hasta tu puerta | Acompañamiento hasta tu puerta |
| `app/entrar/EntrarForm.tsx` | Panel lateral, párrafo (barrido) | Tu Shipping Mark identifica tu carga de punta a punta. Cotiza, sigue tus envíos y paga, todo en un lugar. | Tu Shipping Mark identifica tu carga de punta a punta. Cotiza y paga, todo en un lugar. |
| `lib/design-tokens.ts` (DTDU) | Párrafo 1, ficha y JSON-LD | … Te lo damos al confirmar la cotización y lo ves entrando a tu portal del cliente (dtdcargo.com/portal), donde sigues el estado en tiempo real. | … Te lo damos al confirmar la cotización y con él nuestro equipo sigue tu envío. El seguimiento desde tu portal del cliente (dtdcargo.com/portal) está en construcción. |
| `lib/design-tokens.ts` (POD) | Párrafo 2, ficha y JSON-LD | En el portal de tracking, el POD aparece como el último evento del envío junto con la fecha y firma escaneada. | Es el último evento del envío: lleva la fecha de la entrega y la firma de quien recibe. |
| `public/llms.txt:52` | Enlace a `/portal` (estático) | Rastrear envío (dentro del portal del cliente) | Portal del cliente (en las dos posiciones) |

**Alcance ampliado dentro del encargo, a revisar.** El párrafo del panel
lateral de `/entrar` no estaba nombrado, pero promete lo mismo en la misma
pantalla y el pedido es que el login deje de prometer rastreo. Sólo se quitó
«sigue tus envíos». Si Sam lo quiere distinto, se cambia sin tocar lo demás.

## VALIDACIÓN

Todo sobre el árbol de la rama, base `a8d99acf`.

| Comprobación | Estado y evidencia |
|---|---|
| Prueba nueva `app/__tests__/sin-promesa-rastreo-restantes.test.tsx` | PASÓ: «Tests 9 passed (9)». |
| Control rojo: la prueba nueva contra los 4 fuentes de `origin/main` (`EntrarForm.tsx`, `design-tokens.ts`, `glosario/page.tsx`, `llms.txt`), escritos con `git show` sin tocar el índice, restaurados y comprobados por sha256 | PASÓ como control: «Tests 5 failed \| 4 passed (9)». Caen `/entrar` prendido, glosario prendido, «sólo DTDU y POD tienen variante» y los dos de `llms.txt`. Pasan los dos «apagado» y las dos invariantes (acceso igual; demás términos iguales). |
| Mutantes (14, reemplazo exacto con una sola aparición, archivo restaurado y comprobado por sha256 después de cada uno) | PASÓ: 14/14 muertos, cada uno en el caso que le toca. Control verde «Tests 9 passed (9)» antes y después. M1 beneficio lateral sin interruptor → 1 (prendido). M2 beneficio de cuenta nueva sin interruptor → 1. M3 párrafo lateral sin interruptor → 1. M4 párrafo lateral fijo en la versión nueva → 1 (apagado). M5 texto nuevo con «Seguimiento» → 1. M6 el interruptor quita «Crear mi cuenta» → 1 (acceso igual). M7 `cuerpoVigente` sin interruptor → 1. M8 `cuerpoVigente` fijo en la variante → 1 (apagado). M9 JSON-LD con el cuerpo de siempre → 1. M10 ficha con el cuerpo de siempre → 1. M11 prendido recorta los demás términos → 1 (demás iguales). M12 variante DTDU con «tiempo real» → 1. M13 variante POD con «portal de tracking» → 1. M14 `llms.txt` vuelve a «Rastrear envío» → 2. |
| Focalizadas y vecinas: la nueva, `entrar-dos-filas` y `actions` de `/entrar` (0276/0094), las dos de la 0521, `PortalTrackingEnConstruccion`, `hub-fichas-sin-promesa-bodega` y `hub-fichas` (0519), `register-sin-promesa-bodega` (0517), `__tests__/design-tokens.test.ts`, `glosario-enlaces`, `TerminoGlosario`, `__tests__/text.test.tsx`, `json-ld-escape-contract`, `lib/public/__tests__/json-ld.test.ts`, `scripts/check-feature-constants.test.mjs` | PASÓ: «Test Files 16 passed (16)», «Tests 136 passed (136)». |
| `corepack pnpm typecheck` | PASÓ (exit 0; «[tipos-de-ruta] sanos — nada que podar»). |
| ESLint de los 5 archivos de código y prueba tocados | PASÓ (exit 0, sin salida). |
| `node scripts/check-feature-constants.mjs` | PASÓ: «feature-constants: 6 bandera(s) coinciden con lo declarado». |
| `node scripts/build-docs-index.mjs --check` | PASÓ: «índice sincronizado con 508 specs». |
| `node scripts/check-numbering.mjs` | PASÓ (exit 0): «numbering: sin números repetidos», con los choques históricos ya conocidos en ⏸. |
| `corepack pnpm sdd:check` | PASÓ (exit 0). |
| `git diff --check` | PASÓ. |
| Voseo en lo agregado | Revisado con grep: sin voseo. |
| `pnpm verify` completo | NO EJECUTADO: turno de corrida pesada no asignado. El CI de la PR es la evidencia de la suite completa y del build. |
| `/ui-check` | NO EJECUTADO: sólo cambia texto, sin elementos, clases, colores ni tamaños nuevos. El beneficio lateral nuevo tiene 42 caracteres contra 35 del viejo, en una lista que ya admite varias líneas. No se midió en pantalla. |
| e2e del glosario (`e2e/smoke.spec.ts`, `e2e/glosario-ancla.spec.ts`) | NO EJECUTADO localmente (corrida pesada). Por lectura no se cruzan: miden que no queden `<b>` sin convertir en el primer `article` y las anclas; ninguna ancla cambia. |
| `pnpm knowledge:status` | Corrido: `ok: false` en el worktree (Graphify `INVALID`, capas `PENDING`, `native_semantic_missing_or_changed`). Es lo esperado fuera de main. |

## COMMITS

- `b48c85aa` feat(web): SDD-0528 — /entrar, glosario y llms.txt sin promesa de rastreo mientras el seguimiento está en construcción.
- El commit que contiene este documento: spec, índice, viñeta de marketing y handoff.

## PR / BRANCH

Rama `codex/textos-rastreo-restantes` contra `main`; el número y la URL de la
PR van en la propia PR y en el reporte al Director.

## Impacto documental

- Documento canónico nuevo: la spec 0528.
- `docs/marketing/README.md`: una viñeta nueva y la última frase de la de la
  0521 en pasado. Es fuente del piloto semántico: el recibo lo renueva el
  Director después del merge. Las líneas siguientes se corren una posición.
- `docs/specs/README.md`: índice regenerado. Va a chocar con otras PRs que
  agreguen specs (0522 a 0527 aparecen como huecos aquí): se resuelve con el
  driver de main y regenerando el índice.
- No cambian `BRAND.md`, el Norte ni los runbooks.
- Graphify: entra 1 prueba nueva y 2 aristas de import nuevas hacia
  `lib/portal/tracking-en-construccion.ts` (`EntrarForm`, `glosario/page`).
  Pendiente: actualización estructural desde main integrado, a cargo del
  Director.

## PENDIENTES DE ESTA TAREA

- CI de la PR en verde (suite completa y build).
- Merge cuando se levante el congelamiento y Sam lo autorice.
- Smoke de Sam en producción después del merge:
  1. Abre `/entrar`: en el panel azul de la derecha, el primer punto dice «Tus
     compras y pre-alertas en un solo lugar» y el párrafo termina en «Cotiza y
     paga, todo en un lugar.»; en «Crear mi cuenta y Shipping Mark», el tercer
     punto dice «Acompañamiento hasta tu puerta». Pide el enlace con tu correo y
     comprueba que llega y entra igual que siempre.
  2. Abre `/glosario#dtdu`: dice «con él nuestro equipo sigue tu envío» y que el
     seguimiento del portal está en construcción; ya no dice «tiempo real».
  3. Abre `/glosario#pod`: el segundo párrafo dice «Es el último evento del
     envío…»; ya no menciona el «portal de tracking».
  4. Abre `https://dtdcargo.com/llms.txt`: en «Enlaces útiles» dice «Portal del
     cliente: https://dtdcargo.com/portal».
- Pasar la spec a `done` cuando el smoke pase.

## FUERA DE ALCANCE DETECTADO

- **Ficha de pre-alerta de `/servicios`** (`components/servicios/hub-fichas.tsx:923`,
  «Ves el estado de tu compra en todo momento.», con `<b>` en el fuente): no se tocó por orden del
  Director (posible cruce con la SDD-0524). Sigue prometiendo seguimiento.
  Propuesta, la misma de la 0519: con el interruptor encendido, «Tu compra queda
  registrada en tu portal desde el primer día.». Cambiarlo exige ampliar la
  prueba de la 0519 (`components/servicios/hub-fichas-sin-promesa-bodega.test.tsx`),
  que fija que el resto de la ficha no cambia con el interruptor.
- **`public/llms.txt:17`** «Seguimiento de cada envío mediante un código de
  cliente propio (Shipping Mark "DTD-…")»: no se cambió porque describe lo que
  hace el equipo y es cierto en las dos posiciones. Si Sam lo quiere más neutro:
  «Identificación de cada envío con un código de cliente propio (Shipping Mark
  "DTD-…")».
- **`public/llms.txt` contradice el canon de identidad** (`docs/engineering/project-rules.md`,
  «Negocio»: 2015 es el año de fundación y de todo «operando desde»; 2010 es la
  primera oficina propia en China):
  - `:23` «Más de 15 años de trayectoria (operando desde 2008)»;
  - `:39` «¿Desde cuándo operan? Desde 2008.»;
  - `:9` «primera empresa de carga formalizada en China en 2010».
  Además, `:9` publica razón social y RIF en texto, y la regla dice que van sólo
  en el schema. Es un archivo para motores de IA, no una página: decide Sam si
  esa regla aplica aquí.
- **Siguen igual que en la 0521, a la espera de Sam**: FAQ de rastreo
  (`lib/faqs.ts`, atadas a la base de Kommo por la SDD-0063/0064), política de
  privacidad (`app/privacidad/page.tsx`), «Tracking del envío» en
  `components/PuertaAPuerta.tsx:17`, `public/portal/manifest.json` («sigue tus
  envíos»), el motivo «Rastrear mi carga» del formulario de contacto y el panel
  de ejemplo del hero de `/pre-alertas`.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR, en especial el párrafo lateral de
  `/entrar` (alcance ampliado) y los textos del glosario. Esperar el CI; los
  merges están congelados hasta después del corte.
- **Cambios compartidos:** `lib/design-tokens.ts` (tipo `GlossaryTerm` y dos
  términos), `app/entrar/EntrarForm.tsx` (el login: sólo texto) y el comentario
  y el `significa` del interruptor, que vuelve a tocar cualquier tarea sobre él.
  El índice de specs chocará con otras PRs abiertas.
- **Después del merge:** renovar el recibo semántico de
  `docs/marketing/README.md` y actualizar Graphify desde main.
- **Sesiones consumidoras:** ninguna.
- **Ownership:** se libera el claim al terminar la escritura y la publicación.
  No se borran ni el worktree, ni la rama, ni la reserva `codex/sdd-reserve-0528-…`.
