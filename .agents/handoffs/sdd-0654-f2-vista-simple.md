# Handoff — SDD-0654 fase 2: inicio simple, ayudas, glosario, guía y comparación

- **Owner / sesión:** Worker del DG (claim `local_0654`). Asignó: Director General.
- **Ruta:** `.claude/worktrees/0654-f2-vista-simple` · **Rama:** `claude/0654-f2-vista-simple` (desde `origin/main` dbc898b67)
- **Spec:** `docs/specs/0654-version-light-portal/spec.md` §6, §6.1-6.3, §9 fila 2 y §10 AC-8 a AC-18 y AC-26.

## OBJETIVO ORIGINAL

Orden del DG (2026-11-17). Sam aprobó arrancar la fase 2 con «Sí, las dos».

- Construir el inicio simple, las ayudas, el glosario, la guía y la comparación, según la §9 fila 2.
- El interruptor `PORTAL_VISTA_SIMPLE` sigue apagado.
- Si se extrae el motor de la guía, el Studio no cambia.
- Pasar `/ui-check`, medir la barra a 375 px y resolver el menor de la fase 1 (el aviso de error del selector).
- Sin migración. PR sin fusionar.

## COMPLETADO

- **Desvío** (`app/portal/(app)/page.tsx`): con el interruptor encendido y la Vista simple elegida, el inicio es
  `InicioSimple`. Apagado, ni se consulta la vista (AC-1). El cliente no activado sigue viendo la pantalla de
  espera, en las dos vistas, y la guía no arranca (AC-18).
- **Seis bloques** (`lib/portal/simple/bloques.ts`, función pura, y `app/portal/(app)/_simple/InicioSimple.tsx`):
  siempre los mismos y en el mismo orden, cada uno con su estado vacío y su enlace a la Vista Pro (AC-8, AC-9).
  - **1 · ¿Dónde está tu carga?:** el estado se dice en palabras (`contenido/estados.ts`) y siempre es el
    **visible**, con la lectura estricta nueva `getHiddenPortalStatusesStrict` (FC-14).
    - Si esa lectura falla, no hay estado ni ruta: solo la llegada estimada y el enlace a la Pro (AC-11).
    - Si `effectiveVisibleStatus` devuelve el mismo estado oculto (no hay uno visible antes, o está fuera del
      flujo), tampoco se nombra.
    - Una etapa con todos sus estados ocultos no se dibuja.
    - Con el seguimiento en construcción no hay ruta y se muestra el aviso de hoy (AC-12).
  - **2 · Lo que te toca hacer:** órdenes por aceptar, perfil incompleto y saldo por pagar. Si no hay nada, lo dice.
  - **3 · Cuánto debes:** el saldo en navy, en su moneda.
  - **4 · Tus papeles:** los tres últimos, con «Ver y descargar». Cerrado si el perfil está incompleto, igual que
    «Tus documentos»; con el módulo cerrado ni se consulta.
  - **5 · Envíale esto a tu proveedor:** `BloqueProveedor.tsx`.
    - Muestra solo los proveedores de la cuenta, sin campo para escribir un número.
    - Explica el código por partes con los datos del cliente.
    - El mensaje es el mismo que el de «Mis compras»: `buildChinaSupplierClipText`, extraído de
      `ChinaSupplierClip`, recibe el `nextCode` de `summarizeSuppliers` (AC-13, AC-14).
    - Junto a «Copiar» dice que copiar no registra la compra y enlaza a «Nueva compra».
  - **6 · ¿Te quedó una duda?:** el asesor y el chat. Faro es de la fase 3 y no aparece.
- **Ayudas** Consejo, Recuerda y Atención sobre `.portal-aviso`, y **glosario** desplegable
  (`contenido/glosario.ts`, el mismo que leerá Faro).
- **Guía** (§6.2, AC-15): `lib/portal/simple/guia-motor.ts` (puro) y `_simple/GuiaPortal.tsx`.
  - Recorrido: bienvenida, 4 consejos, «¿Quieres continuar?» y 2 consejos opcionales. El tutorial del código tiene 6
    pasos.
  - Arranca sola solo la primera vez y lo marca con `markPortalGuiaVistaAction`. Se repite con «Guía» (evento o
    `?guia=1`).
  - La tarjeta es un diálogo con trampa de foco; Escape la cierra. El bloque se resalta con un contorno de tinta y
    se respeta la preferencia de menos movimiento.
  - **Decisión medida:** el motor de la SDD-0589 no atrapa el foco, a propósito, y su componente está atado al
    i18n, a los roles y a las rutas del Studio. Extraerlo costaba más que este motor chico, así que el Studio no se
    toca y `lib/shared/guia/**` no se creó.
- **Comparación** (§6.1, AC-16): `_simple/ComparacionVistas.tsx`, en un diálogo. En teléfono se apila. Se abre desde
  «Comparar», junto al selector, en las dos vistas.
- **Barra superior** (ampliación de la allowlist por el DG):
  - `PortalTopbar` agrega solo `BotonGuia`, con la Vista simple y en pantalla ancha. Con el interruptor apagado la
    barra queda idéntica, y lo cubre una prueba nueva.
  - `PortalVistaSelector`:
    - el aviso de error se cierra solo a los 6 s o con Escape (menor de la fase 1);
    - en pantalla ancha, el grupo y «Comparar»;
    - **en teléfono, un solo botón** que abre un panel con las dos vistas, «Comparar» y, en la simple, «Guía».
- **Color** (§6.3, EXC-0654-01): bloque `.vs` en `app/globals.css`.
  - Tintes `--tint-ink`, `--tint-wine`, `--tint-ok` y `--tint-warn`, hechos con `color-mix` de tokens existentes.
  - Vino claro solo en el botón principal, el avatar y la parte «proveedor» del código, con texto `--on-warning`.
  - La selección va en tinta.
- **EXC-0654-01** registrada en `BRAND.md` y `BRAND-DECISIONS.md`, con objetivo, superficie, tokens, contraste,
  duración, fecha de revisión y dueño (AC-26). Tiene fila en el índice rápido.

## Lo que NO se hizo, a propósito (AC-10: sin usos nuevos del cliente de administración)

- **Descarga directa de papeles:** firma URLs con admin. El bloque 4 lleva a «Tus documentos».
- **Equivalente en bolívares:** la tasa referencial se lee con admin. El saldo va en su moneda.
- **Fecha estimada de la SDD-0627:** necesita la foto naviera con admin. Se usa la llegada estimada que el inicio de
  hoy ya calcula (`getNextArrival`).
- **«Documento faltante» por compra:** las facturas y listas de empaque por compra se leen con admin. El bloque 2
  trae órdenes, perfil y saldo.
- **La lista permitida de la SDD-0383 no existe en el árbol:** ni la prueba ni la fachada que nombra la spec. No hubo
  nada que cambiar, porque el inicio simple solo reutiliza `loadPendingAcceptanceForClient`, que el inicio de hoy ya
  usa.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `docs:check`, `check-numbering`, `check-pending-migration-symbols`, `check-feature-constants` | PASÓ |
| Vitest acotado al portal (20 archivos) | PASÓ: 145 de 145, con turno del DG (2026-11-17) |
| `tsc --noEmit` | PENDIENTE de turno del DG |
| ESLint de los archivos tocados | PENDIENTE de turno del DG |
| `/ui-check` | Ver la PR |
| Medida de la barra a 375 px | Ver abajo |
| e2e del selector | NO EJECUTADO: no lo escribí, porque necesita un portal con sesión y datos. Queda pendiente |
| `pnpm verify` | NO EJECUTADO: el portón es el CI |

**Barra a 375 px.** La medí por cálculo con los anchos del código, no con píxeles en pantalla, porque no hay un
portal de prueba con sesión. Con la fase 1, el selector, «Comparar» y «Guía» sumaban unos 430 px contra 343 útiles.
Por eso, en teléfono, el selector se reduce a un solo botón. La barra queda en unos 300 px (botón de menú,
«Simple ▾», calculadora, campana, tema y cuenta). Hay que confirmarlo con una captura cuando Sam nombre un servidor
de prueba.

## PR / BRANCH

`claude/0654-f2-vista-simple` → `main`. PR no draft. No fusionar. Sin migración. El interruptor sigue apagado:
encenderlo y la prueba con clientes (D-12) son decisiones de Sam.

## PENDIENTES DE ESTA TAREA

- Correr las pruebas, tsc y lint con turno del DG, o leerlas en el CI.
- e2e del selector, con un portal de prueba con sesión.
- Captura de la barra a 375 px en el servidor de prueba.
- `app/portal/_components/PortalShell.test.tsx`: cambié el nombre con que busca el botón «Vista Pro», porque ahora
  hay dos botones con «Pro». No está en la fila 2; es efecto directo del cambio del selector.

**Rojo del CI en la #648, causa confirmada.** «se repite con «Guía» desde otra pantalla (?guia=1) y limpia la
URL» (`GuiaPortal.test.tsx`) no terminaba y el proceso de Vitest se quedaba sin memoria. El efecto de `?guia=1`
dependía de `router` y volvía a abrir la guía en cada render mientras la URL conservaba el parámetro. El doble de
la prueba da un router nuevo en cada render, y así el bucle no terminaba nunca. Se corrigió en el componente: la URL
se atiende una sola vez por visita, y la prueba ahora exige que `replace` se llame una sola vez. Aparte, la prueba
del aviso que se cierra solo vacía los efectos dentro de `act` antes de medir.

## FUERA DE ALCANCE DETECTADO

- Etiqueta «Nuevo» (§6.2): no se hizo. Necesita guardar por persona qué bloque abrió, y no hay dónde sin migración.
- La spec cita líneas viejas de `lib/studio/prealertas/types.ts` (`buildPrealertaCode` está en :123-132 y
  `summarizeSuppliers` en :226-253).
- Las dos piezas de «Mis compras» nombran a personas distintas como «quién recibe»: `ChinaSupplierClip` pone el
  contacto de coordinación y `AlibabaAddressGuide`, al encargado de bodega. La Vista simple copia el mensaje de
  `ChinaSupplierClip`, sin cambiarlo.
- El comentario de `app/globals.css:118` sigue diciendo que el tema es «solo para cuentas demo».

## HANDOFF AL DIRECTOR

Fase 2 escrita y con los gates de node en verde. Falta el turno de PC para Vitest, tsc y lint antes de publicar.
