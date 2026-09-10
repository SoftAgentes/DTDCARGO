# Evidencia · SDD-0442

## Corte y alcance real

2026-09-05, base b8294664. Cinco componentes de presentación; ningún cambio
de persistencia, permisos, documentos del proveedor, reglas de subida o API.
La autorización corresponde a rama y PR. Entrega en borrador por validación
integrada pendiente; no declarar completado el portal global.

## Antes / después

| Hallazgo confirmado en base | Resultado del slice |
|---|---|
| Documentos 0/3 era botón y contador | Contador separado y Ver/Ocultar documentos con chevron, aria-expanded y aria-controls estable |
| Pendientes mostraban DownloadIcon | Pendiente textual, icono documental, cero descarga sin destino |
| Factura/foto no tienen URL en la prop de presencia | Recibido informa presencia; no se inventa enlace |
| Gestión documental era enlace pequeño | Variante btn-primary; mismo destino /compras/[code]/etiquetas |
| Prealerta usaba + como estado | DocIcon decorativo, sin sugerir creación |
| Filtros de envíos sin estado accesible | aria-pressed y subrayado del seleccionado; target de 48 px |
| Ayuda de proveedores precedía lista | Lista y alta antes de ayuda plegable nativa |
| Re-comprar y Cambiar ambiguos | Nueva compra con este proveedor y Cambiar proveedor, mismos destinos/handlers |
| Tarjeta sin URL se atenuaba completa | Enlace no disponible sin reducir opacidad de todo el texto |

[Antes, componente de b8294664](assets/before-desktop-light.png) ·
[Después claro](assets/desktop-light.png) · [Después oscuro](assets/desktop-dark.png) ·
[Móvil claro](assets/mobile-light.png) · [Móvil oscuro](assets/mobile-dark.png).
Son componentes reales con datos ficticios, CSS de producción y adaptadores
locales para next/link, next/image y acciones bloqueadas. No representan una
sesión autenticada ni certifican descargas, enlaces firmados o escrituras.

## Verificaciones

- 18/18 pruebas iniciales: desplegable con Enter/Space, foco, contador separado,
  pendientes, destino de packing, filtros y estado vacío; incluye regresiones
  existentes de NewPurchaseWizard.
- 384/384 pruebas, 39 archivos de app/portal y lib/portal.
- ESLint: salida 0 sobre los ocho archivos de código y pruebas. El intento
  que incluía docs/qa se detuvo por falta de progreso; docs/** está excluido
  por la configuración existente. No se modificó esa configuración.
- Tras el último énfasis de Nueva compra: 4/4 pruebas de los dos consumidores
  y repetición de las 12 combinaciones de navegador, sin desbordamiento.
- pnpm typecheck: salida 0.
- pnpm build: salida 0; 158 páginas estáticas generadas. Avisos por ausencia de
  NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en este worktree.
  Compilar no valida contenido remoto. No se copiaron credenciales.
- governance:check, components:check, docs:check, sdd:check: salida 0.
- check-rsc-boundary: 1586 módulos, cero cruces server→client de valores.
- git diff --check: sin errores.
- Gate proporcional: no se ejecutó pnpm verify completo, SQL, migraciones,
  Edge Functions ni E2E autenticados; no hay cambios en esos contratos.

## Navegador y contraste

Playwright + Edge local en 1440×1000 y 390×844, claro/oscuro. Mis envíos,
Documentos y Proveedores sin desbordamiento horizontal en las 12 combinaciones.
Ver/Ocultar documentos abre y cierra con teclado; foco solid y target 48 px.
Ayuda de proveedores abre con Enter. Sin errores JavaScript en el hub.
agent-browser no pudo conectar al daemon (Windows, os error 10060); se usó
Playwright como alternativa, sin alterar los controles del repositorio.

| Par medido de tokens reales | Claro | Oscuro |
|---|---:|---:|
| Texto sobre botón de gestión | 10.58:1 | 4.96:1 |
| Texto principal sobre card | 16.49:1 | 13.08:1 |
| Texto secundario sobre paper | 12.10:1 | 9.03:1 |

Archivo cargó en ambos tamaños. JetBrains Mono se verificó en escritorio;
la comprobación móvil fue inconsistente (false), por lo que las capturas
móviles no certifican la fuente mono final. No se fijaron anchos de columnas.

## UI-CHECK · revisión liviana antes del commit

- cumplimiento: botones/enlaces nativos; contador y pendientes informativos;
  tokens y variantes existentes, sin nuevos colores, fuentes ni componentes.
- cumplimiento: foco y expansión, selección visible sin depender solo del color,
  jerarquía del panel, recuperación del filtro vacío, destinos conservados.
- no aplica: loading de documentos locales (props síncronas); persistencia,
  auditoría de mutaciones, esquema y privacidad (no se capturan ni mueven datos).
- excepción: ninguna nueva excepción de marca.
- no conformidad de verificación: falta navegador autenticado de prueba,
  lector de pantalla y zoom 200%; fuente mono móvil por revalidar.

Veredicto: implementación revisable; PR en borrador hasta completar lo pendiente.
La rúbrica ui-check contiene referencias históricas de fuentes/Shipping Mark:
se aplicaron BRAND.md y AGENTS vigentes, sin propagar esas instrucciones antiguas.

## Dependencias y pendientes para coordinación

1. Probar con cuenta y documentos ficticios en backend de prueba: enlaces,
   descarga real, errores/cargas, registro y cambio de proveedor.
2. Repetir contraste tras integrar colores (SDD-0441). No se mezcló su trabajo.
3. Revalidar zoom, lector y fuentes móviles. Los componentes auxiliares de
   dirección/Copiar y captura de WeChat conservaron su funcionamiento y etiquetas;
   no se rediseñó el flujo de proveedores ni sus documentos.
4. Nueva compra admite énfasis primario y 48 px en Mis envíos y Proveedores;
   los otros consumidores conservan su default de 40 px. Registrar compra
   conserva su etiqueta y acción. Target touch global fuera de esas pantallas
   queda como revisión posterior del componente compartido.
5. El índice SDD compartido queda a la coordinación según el runbook multiventana.

## Reproducir sin producción

### Revisión conjunta adicional · 2026-09-05

- Cabecera agrupada junto al título; Nueva compra precede a Seguimiento total
  y Mis proveedores. Secundarios con fondo y borde de tokens existentes,
  hover diferenciado y reducción de elevación al pulsar.
- Navegador integrado, vista aislada compilada desde componentes reales:
  revisión visual en claro/oscuro, cabecera móvil a 390 px sin recortes;
  Enter/Espacio alternan documentos y Tab lleva a la gestión.
- Foco visible comprobado en Seguimiento total. Compilación de fixture,
  ESLint, 3/3 tests del hub, governance:check, components:check y docs:check
  pasan tras el ajuste. No se repitió el build completo de Next.js.
- A 532 px de viewport, scrollWidth 517 px: sin desbordamiento horizontal.
  Es comprobación de redistribución, NO certifica zoom nativo al 200%.
  El navegador sigue en escala 1; el atajo enviado no lo cambió. Prueba
  nativa pendiente de ajuste manual del zoom. No se da por aprobada.
- La cuenta de prueba quedó abierta en producción tras entrar; esa sesión
  no valida el PR. Autenticación, documentos remotos y lector siguen pendientes.
- El servidor Vite local dejó de responder; para la revisión conjunta se
  compiló la fixture con Vite a una carpeta temporal y se sirvió estáticamente
  en 127.0.0.1:4312. No hubo cambios de configuración ni datos en producción.

Desde este worktree, ejecutar `node docs/specs/0442-portal-claridad-botones-mensajes/qa/serve.mjs`.
En otra terminal ejecutar `node docs/specs/0442-portal-claridad-botones-mensajes/qa/check.mjs`.
Requiere Edge instalado y fuentes Google accesibles. Nunca ejecutar los formularios
para simular éxito: las acciones de la fixture fallan expresamente.
Para el antes, arrancar serve.mjs con QA_BASELINE=1 y QA_PORT=4313; lee el
componente desde git show b8294664, sin escribir el checkout.

## Gate posterior a adopción Director/Worker · 2026-09-05

SHA medido: `5029124c99417c37f2222c2bc369df78f6ec0401`, con base `74bb52ab`.
`pnpm verify` terminó exit 1: 14 pasos PASÓ, E2E FALLÓ y migrations-applied
NO EJECUTADO por falta de credenciales; 15/16 pasos ejecutados. Build PASÓ,
incluidos TypeScript, 158 páginas y postbuild. Unitarias: 6.196/6.196;
SQL: 139 contratos; reconstrucción: 380 migraciones de esquema + 18 ledger-only.

E2E segundo intento automático: 132 aprobados, 17 fallidos, 1 flaky y 18 SKIPs.
Quince fallos muestran configuración Supabase ausente; dos son hidratación de
calculadora en Chrome móvil, causa independiente no resuelta. Se interrumpió
un trabajador WebKit estancado en cierre con autorización del Director; el
padre entregó exit 1 y el gate continuó a build. No es una corrida verde.
Primer JSON íntegro preservado; segundo JSON no se alcanzó a guardar antes del
borrado del runner, pero hay resumen textual y artifacts. Matriz, evidencias,
recuperación y checklist en el [handoff de adopción](../../../.agents/handoffs/pr30-adopcion-validacion-20260905.md).

Siguen pendientes zoom nativo 200%, lector real, sesión del PR y flujos con datos
de prueba; contraste definitivo depende de #31. PR permanece draft. Esta fase
dejó evidencia y commits locales, sin push, integración a main ni producción.

### Focal de hidratación · 2026-09-06

Sobre `2e64f187` (sólo dos documentos distintos de `5029124c`), se repitieron
exclusivamente los casos originales de `calculadora-hidratacion.spec.ts:42/61`,
mobile-chrome, workers=1, manteniendo configuración y aserciones. Ambos PASÓ
al primer intento: 15.320 ms y 6.298 ms; 0 fallos, 0 flaky, 0 SKIPs. JSON final
completo y preflight de dos tuplas preservados en respaldo durable, detallado
en el handoff anterior. Trace on-first-retry no produjo archivos al no haber retry.

No se reprodujeron los dos fallos con esta selección y caché existente. No
demuestra que 11 workers fueran la causa ni reemplaza el gate fallido anterior.
Autenticación, zoom 200%, lector y QA combinada siguen pendientes.

## Reparación restaurativa · decisión founder del 2026-07-28

### Corte de código y decisión

Capturas y prueba focal regeneradas el 2026-09-10 contra el código de
`f42e6a4605c0850053832331cf15d71e53e28ca8` (base asignada
`8ee41f19fb25cfe8b9cd4f01e8110ca507745ed2`). Ese commit restaura la decisión
del founder del 2026-07-28: `AlibabaAddressGuide` y `ChinaSupplierClip` vuelven
a estar visibles al cargar y permanecen juntos, fuera del `<details>` que PR #30
cerró sobre ellos sin declarar la reversión.

La ayuda secundaria sigue plegada por decisión explícita de este slice:
«Por qué registrar a tu proveedor importa», su mensaje asociado y
`GuiaAlibabaCard` conservan el `<details>/<summary>` nativo después de la lista,
el alta y el par operativo. Así se preserva el reordenamiento autorizado por
SDD-0442 sin esconder el contenido necesario mientras el cliente compra en China.

### Cinco capturas regeneradas

Las cuatro capturas “después” se produjeron con el harness versionado
`qa/serve.mjs` + `qa/check.mjs`, Microsoft Edge/Chromium y datos ficticios. El
harness cargó el checkout en `f42e6a4605c0850053832331cf15d71e53e28ca8`:
por eso muestran el orden final del header que el set anterior no reflejaba.
La captura “antes” se ejecutó desde el mismo checkout/SHA con
`QA_BASELINE=1`; por diseño del harness, solo `PortalAlertasHub.tsx` se obtiene
de `b8294664` para conservar una comparación histórica auténtica.

| Archivo | Dimensiones | Bytes | SHA-256 |
|---|---:|---:|---|
| `before-desktop-light.png` | 1440×1000 | 64.605 | `90640637ccfe1f3b8f351cfad2d74832b6d7df889b71ba62d79af022203896bb` |
| `desktop-light.png` | 1440×1000 | 96.612 | `76e561e9fce0ed7fc168c351dcb4acb12e1d840b75abc78bef68f2f23755ee5c` |
| `desktop-dark.png` | 1440×1000 | 92.015 | `0bf349cdf92c379f684dc8656600ebfd7d6fe01246c9912a1aa9bd8f638e1574` |
| `mobile-light.png` | 390×1069 (full page; viewport 390×844) | 90.018 | `29c51ef2f5e3da8c3ec21654cd5b0a838589a65eb4d8db601a32476d19c5b98b` |
| `mobile-dark.png` | 390×1069 (full page; viewport 390×844) | 86.414 | `815636f3fbefe22def7e85380e77f6a5f6c4a21d45ea15965cbf4d5253ca4c5e` |

Resultado del harness: PASÓ, exit 0. Doce vistas (Mis envíos, Proveedores y
Documentos en desktop/móvil y claro/oscuro) quedaron sin overflow horizontal;
el control documental midió 48 px, mostró foco sólido y alternó con teclado;
no hubo errores JavaScript. JetBrains Mono estuvo disponible en desktop y no
confirmada en móvil, límite histórico que estas capturas no pretenden cerrar.

### Regresión y límites

- PASÓ: `SuppliersClient.test.tsx`, 1/1. Afirma que el par founder está visible
  y fuera del `<details>`; conserva ayuda secundaria plegada, orden después de
  proveedor/alta y URL de recompra con el proveedor.
- Cumplimiento A11Y-01/VIS-01: primitiva nativa, foco/teclado conservados,
  jerarquía restaurada sin tokens, fuentes ni tratamientos nuevos.
- No aplica BTN-01/CMP-01/LNK-01: no cambia acciones, componentes ni enlaces.
- Estas son fixtures locales con datos ficticios. No cubren autenticación,
  Supabase, operaciones reales, lector de pantalla ni zoom nativo 200 %; la
  revisión visual `/ui-check` corresponde al Director antes de integrar.

### Gate de cierre Worker · 2026-09-10

SHA al iniciar el gate: `188f26c010e3575ef4edae717e1f93c0fd369402`;
el código de producto medido sigue siendo
`f42e6a4605c0850053832331cf15d71e53e28ca8`.

- **PASÓ** — `pnpm install --frozen-lockfile`, ejecutado mediante Corepack
  porque `pnpm` no estaba expuesto en el `PATH`: 932 entradas de política de
  supply chain y 813 paquetes instalados, sin cambiar el lockfile.
- **PASÓ** — prueba focal `SuppliersClient.test.tsx`: 1 archivo, 1 prueba.
- **PASÓ** — `pnpm docs:check` y `pnpm sdd:check`. El índice generado no cambió;
  numbering conservó 11 advertencias históricas y cerró sin duplicados nuevos.
- **FALLÓ (TIMEOUT)** — `pnpm verify` no produjo cierre canónico. Antes del
  atasco pasaron harness 12/12, RSC boundary (1.596 módulos), TypeScript,
  4 Edge Functions, 6.496/6.496 unitarias en 513 archivos, docs, numbering,
  feature constants, component registry, governance, 145 contratos SQL y la
  reconstrucción de 385 migraciones de esquema + 18 ledger-only (219 tablas,
  2 tenants). ESLint terminó con 0 errores y 8 warnings preexistentes.
- **NO EJECUTADO** — `migrations-applied`, por ausencia de
  `NEXT_PUBLIC_SUPABASE_URL` y service role. No se copiaron secretos ni se
  consultó producción.
- **FALLÓ (TIMEOUT)** — E2E inició 186 pruebas con 8 workers. Los flujos
  protegidos reportaron repetidamente la ausencia de URL/key de Supabase; los
  casos Tier 3 sin fixture sembrada se omitieron. El último evento emitido fue
  el número 167 y luego Playwright quedó más de 5 minutos sin salida, pese al
  timeout configurado de 60 segundos por prueba. A los 14,5 minutos del paso se
  interrumpió de forma controlada; no hubo JSON/resumen final ni quedó un
  proceso del worktree. No apareció un fallo asociado a Proveedores antes del
  atasco. Esta evidencia parcial no se presenta como verde ni como cobertura
  autenticada.
- **NO EJECUTADO dentro de `pnpm verify` / PASÓ por separado** — el timeout de
  E2E impidió que el gate alcanzara `build`. `node scripts/check-build.mjs`
  terminó luego con exit 0: compilación, TypeScript, 160 páginas estáticas,
  postbuild Norte y restauración de `tsconfig.json`.

Por tanto, la implementación y su regresión focal están verificadas, pero el
gate canónico queda **FALLÓ (TIMEOUT)**. No certifica E2E autenticado, Supabase,
UAT, producción, lector de pantalla ni zoom nativo 200 %.
