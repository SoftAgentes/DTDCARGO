# Handoff — rebrand-design · evaluación de Ant Design y auditoría del dolor de Sam

- Fecha: 2026-11-19
- Owner: Worker «Rebrand Design» (Claude Code, Sonnet 5.5), sesión iniciada por el Director General
- Worktree: `.claude/worktrees/rebrand-design-aa6ba9`
- Rama: `claude/rebrand-design-aa6ba9` (el encargo la llama `rebrand-design`)
- Base: `origin/main` `9ba6bcf32` al empezar; `2ea18799a` al abrir la PR #715
- SDD: **ninguno** propio (tarea de análisis, sin código de producto). Sus propuestas se volvieron las SDD-0686, 0687 y 0688, con reservas `codex/sdd-reserve-0686`, `-0687` y `-0688`.
- Estado de tarea: **cerrada.** Publicada por orden del Director General en la PR #715 (2026-11-20), aprobada por revisión independiente sobre `d10f228c2` y puesta al día con `origin/main` `2ea18799a`. El análisis lo adoptan las SDD-0686, 0687 y 0688.
- Entregable principal: [`docs/design/rebrand-erp/evaluacion-ant-design.md`](../../docs/design/rebrand-erp/evaluacion-ant-design.md)

## OBJETIVO ORIGINAL

Sam pidió evaluar `ant-design/ant-design`, probarlo y ver si se puede usar más adelante, para un rebrand **solo del ERP (Studio)**. Le molestan botones y «lecturas» (textos, cifras, etiquetas) que quedaron sin actualizar tras SDD-0603. Debía quedar: qué es y qué hace Ant Design (verificado en código), seguridad y cadena de suministro, qué nos sirve, auditoría del dolor en nuestro ERP y tres opciones A/B/C con recomendación y plan por fases.

## COMPLETADO

- Fork de Ant Design y clon **superficial** (`--depth 1`) en una carpeta hermana del repo (`ref-ant-design`), fuera de DTDCARGO. Commit analizado `ee8db7734e6a4d2387a55324e7e35eecb5535e72`. El clon superficial se eligió por el tamaño (~280 MB de historia). Nada de ahí se ejecutó.
- Evaluación en cuatro frentes, con etiquetas C/M/I/NV: qué hace Ant Design, seguridad, qué nos sirve y auditoría de nuestro ERP. Detalle en el documento.
- Seguridad: 0 scripts de instalación y 0 avisos publicados en los 66 paquetes del árbol de `antd@6.7.1` (resolutor propio sobre el registro de npm); sin `fetch`/XHR/beacon/almacenamiento en `antd`; sin dominios externos cargados por la librería (las URLs de Alibaba están en comentarios); única vía externa opt-in `createFromIconfontCN`; sin atestación de procedencia en ningún paquete revisado.
- Auditoría de solo lectura: 1.044 botones, 800 (77 %) con el sistema; 23 botones de Noticias Web en estilo de la web pública; 20 botones con alto fijo menor a 32 px; 11 sin `type`; cifras con dos formatos (47 archivos `en-US` a mano, 50 usos `es-VE`); 23 de 34 pares de colores de respaldo desfasados; 12 `rgba(255,255,255,…)` en línea; login con colores a mano.
- Opciones A/B/C, recomendación (**A ahora, B después si Sam lo pide tras ver maquetas, C no**) y plan por fases. Propuesta de SDD, sin reservar: **4 para A y 3 para B** (uno de ellos opcional).

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Revisión de contenido contra evidencia (citas archivo:línea, cifras) | **PASÓ** (cifras recontadas antes de cerrar; ver nota de método) |
| `pnpm docs:check` | **PASÓ** (equivalente: `node scripts/build-docs-index.mjs --check`, exit 0, índice sincronizado con 664 specs). Se corrió con `node` y no con `pnpm` para no disparar una reinstalación de dependencias en un worktree sin `node_modules` |
| `pnpm sdd:check` | **PASÓ** (equivalente: `node scripts/check-numbering.mjs`, exit 0, sin números repetidos; los 11 choques históricos ya aplicados en producción salen como informativos, no como fallo) |
| `pnpm verify`, `vitest`, `typecheck`, build | **NO APLICA / NO EJECUTADO**: la tarea es solo de documentos; no hay código de producto. Tampoco hay `node_modules` en este worktree y la PC es compartida (una corrida pesada a la vez, con turno del Director) |
| Recorrido visual del Studio en claro/oscuro/compacto | **NO EJECUTADO**: requiere instalar dependencias, entorno de prueba y turno de PC |
| Probar `antd` ejecutándolo | **NO EJECUTADO** a propósito (prohibido instalar/ejecutar código de terceros sin turno y sin carpeta desechable) |
| `/ui-check` | **NO APLICA**: no hay cambio de UI |

### Método y reproducibilidad

- Los conteos salen de scripts de solo lectura (botones, hex, formateadores) y de un resolutor de dependencias que no instala. Quedaron en la carpeta temporal de la sesión, **no** en el repo. Si el Director los quiere versionados, van a `scripts/` con SDD propio.
- Los avisos se consultaron con el endpoint «bulk advisories» de npm; se comprobó que responde con avisos cuando existen. El resolutor es una **aproximación**: un `package-lock` real puede traer otras versiones.

## PENDIENTE DE ESTA TAREA

- Recoger de Sam las tres entradas de la Fase 0: **pantallas que le molestan** (3 a 5), formato de cifras (`$1,234.50` o `1.234,50`) y si mantiene vino y navy. Sin eso la prioridad de A1/A2 es una hipótesis medida, no una elección de Sam.
- Si Sam quiere seguir con la opción C: Fase B0 (prueba aislada con `pnpm install --ignore-scripts` en carpeta desechable, con turno de PC) para medir peso real, hidratación con Next 16 y CSP.
- Verificar `@ant-design/nextjs-registry` con Next 16 y los 55 paquetes del árbol no escaneados.
- Borrar, cuando el Director lo autorice, las dos carpetas hermanas de la PC: el clon `ref-ant-design` y la carpeta `ref-ant-design-npm-6.7.1` (paquetes descargados como archivo). El fork en GitHub se conserva hasta que Sam decida.

## FUERA DE ALCANCE DETECTADO

No se corrigió nada de esto; son candidatos a tarea propia, ya encuadrados en el plan del documento:

1. **Noticias Web con el estilo de la web pública.** 23 botones y 51 usos de `var(--color-*)`/123 líneas de clases de Tailwind en `app/studio/(app)/marketing/noticias-web/`. Probablemente se ve claro sobre fondo oscuro. Candidato a la Fase A1.
2. **Cifras con dos formatos.** `lib/money.ts` es el formateador único (decisión del 2026-08-11) y sigue sin usarse en 47 archivos; 50 usos de `es-VE` numérico. Necesita decisión de Sam y es candidato a la Fase A3, por tandas.
3. **El login del Studio** usa un verde menta y un rosa que no están en la paleta (`app/studio/(auth)/login/LoginForm.tsx:66`, `:175`) y colores a mano. Candidato a la Fase A4. Si Sam los aprueba como tokens, entran como tokens nuevos.
4. **Estilos en línea masivos** (9.316 `style={{…}}`) son la razón de que `style-src 'unsafe-inline'` siga en la CSP (`next.config.ts:37,67`, ya documentado ahí). Endurecer la CSP exige reducirlos, con o sin Ant Design. No se propone ahora.
5. **`globals.css` solo oscurece las variables `--color-*` bajo `[data-portal-theme="dark"]`** (`app/globals.css:140-150`), no bajo el `data-theme="dark"` del Studio. Si otro módulo del Studio usa clases de la web, se verá igual de desfasado. Hoy solo se encontró en Noticias Web.

## IMPACTO DOCUMENTAL

- Nuevo: `docs/design/rebrand-erp/evaluacion-ant-design.md` y este handoff.
- **No se actualizó** `docs/design/README.md` ni el índice de specs. Si el Director adopta la carpeta `docs/design/rebrand-erp/`, conviene una línea en `docs/design/README.md` (estructura actual) y, si se crean SDD, sus propios `spec.md` y entradas del índice generado por `pnpm docs:index`.
- Cualquier decisión de color que salga de la opción B se registra en `docs/design/studio/_norte/BRAND-DECISIONS.md` y en `BRAND.md` (BD nuevo), y se lleva a Cloud Design por NORTE-SYNC; el Norte no cambia por decisión local.

## ARCHIVOS DE ESTA TAREA

- `docs/design/rebrand-erp/evaluacion-ant-design.md`
- `.agents/handoffs/rebrand-design-evaluacion-ant-design.md`

Sin cambios en `app/`, `lib/`, `components/`, `supabase/`, `public/` ni la web pública.

---

## AMPLIACIÓN 2026-11-19 · Carbon y versus (pedido de Sam en la misma sesión)

- Sam pidió hacer lo mismo con `carbon-design-system/carbon`, compararlo con Ant Design y decidir mañana qué instalar. Entregables nuevos: [evaluacion-carbon.md](../../docs/design/rebrand-erp/evaluacion-carbon.md) y [versus-ant-design-vs-carbon.md](../../docs/design/rebrand-erp/versus-ant-design-vs-carbon.md) (con el plan del laboratorio de mañana).
- Fork y clon **superficial y parcial** de Carbon (8 GB de repo) en una carpeta hermana (`ref-carbon`) más los paquetes descargados como archivo (`ref-carbon-npm-1.121.0`). Commit analizado `3011e16b77b6b4af5c4156f4014486cddac25573`. Nada se ejecutó.
- **Veredicto del versus:** conviene más **Carbon** para lo que Sam pidió mirar (reglas de botones, títulos, mensajes y guardado) y para nuestras reglas duras (sin CSS-in-JS, AA, CSP); Ant Design gana en tablas y comunidad. La opción A sigue siendo lo primero.
- **Hallazgos de seguridad de Carbon:** 20 de 59 paquetes declaran `postinstall` de telemetría de IBM (bloqueado por `allowBuilds` de pnpm 11 por inferencia; apagable con `IBM_TELEMETRY_DISABLED`); fuentes desde la CDN de IBM por defecto (bloqueadas por nuestra CSP; apagables); atestación de procedencia presente; 0 avisos en 59 paquetes.
- **Comunidad en redes: NO verificable con fuentes directas.** Las búsquedas devolvieron páginas de comparación comerciales, ningún hilo de Reddit ni de Hacker News. Está dicho en el documento.
- Validación: `docs:check` y `sdd:check` **PASARON** (con `node`, como arriba). Resto, **NO EJECUTADO** por la misma razón.

### Pendiente nuevo de esta tarea
- Laboratorio de dos aplicaciones (fuera del repo, datos de mentira, con turno de PC del Director) y su rúbrica: sección 5 del versus. No se hizo hoy.
- Borrar, con autorización, `ref-carbon` y `ref-carbon-npm-1.121.0`; el fork de Carbon queda en GitHub hasta que Sam decida.

### FUERA DE ALCANCE DETECTADO (nuevo)
- Si algún día se instala `@carbon/*` en DTDCARGO, hay que fijar `IBM_TELEMETRY_DISABLED=true` en el `Dockerfile` y en CI, aunque `allowBuilds` ya lo bloquee, y dejar `$css--font-face: false`.

---

## AMPLIACIÓN 2026-11-20 · Mejoras de experiencia adaptables

- Sam pidió sacar de lo leído qué se puede implementar para mejorar la experiencia del Studio, que «no se ve simétrico en todas las secciones». Entregable: [mejoras-ux-adaptables.md](../../docs/design/rebrand-erp/mejoras-ux-adaptables.md): 29 mejoras con origen (Carbon o Ant Design), qué haríamos y tamaño, sin instalar ninguna librería.
- Medición nueva de la asimetría (solo lectura, `app/studio/(app)/`): 91 `<h1>` a mano con 7 tamaños y 20 márgenes; 13 anchos de drawer; 45 archivos con `DrawerShell` sin `DrawerFooter`; 73 `<table>` crudas; 22 tamaños de letra en línea; 1.506 rellenos y 1.762 separaciones con número suelto; `useRowHighlight` en 14 archivos contra `useToast` en 132.
- Validación: `docs:check` y `sdd:check` **PASARON** (con `node`). Recorrido visual: **NO EJECUTADO**.
- Pendiente: que Sam elija por dónde empezar (propuesta: encabezado de página único, anchos y pie de drawer). Cada mejora necesita SDD con allowlist; estimación sin reservar, 8 a 10 SDD que se solapan con los 4 de la opción A.

---

## AMPLIACIÓN 2026-11-20 (2) · Checklist, extras y opciones para el rojo

- Sam pidió el checklist de qué y cómo se hará (para un SDD), extras de experiencia y revisar el rojo/vino, que la gente lee como negativo o «borrar»; los cambios irían juntos en ERP y Portal. Entregable: [checklist-y-color.md](../../docs/design/rebrand-erp/checklist-y-color.md).
- Hallazgo de color (medido): `--wine` y `--danger` comparten tono (354°) y contrastan 1,61:1 entre sí; en tema oscuro `--wine` es `#A8323E`, el mismo hex que `--danger` en claro; el primario en oscuro mide 2,26:1 contra la tarjeta.
- Cinco opciones con contraste calculado; recomendación **opción 2 «Azul DTD»** (hex propuestos, no aprobados) con vino solo para identidad y rojo solo para peligro. Es decisión de marca: va con BRAND-CHECK, BD nuevo y NORTE-SYNC. **Nada se cambió.**
- Checklist en cinco fases (decidir, preparar, reglas, piezas, adopción por tramos, verificar) y 14 extras de experiencia.
- Validación: `docs:check` y `sdd:check` **PASARON** (con `node`). Visual en pantalla: **NO EJECUTADO**.
- Pendiente: decisión de Sam sobre el color y las tres decisiones asociadas (saldos, web pública, logo); número de SDD del Director.

---

## AMPLIACIÓN 2026-11-20 (3) · Decisiones de Sam y borrador del SDD

- **Decisiones de Sam (literal, en el chat de esta sesión):** «opcion 2  Completamente todo el proyecto web, portal y ERP; todo el sistema completo.» · «todas las vamos a cambiar» (pantallas) · «Si hay que cambiar el branding completo, se puede cambiar. Si hay que eliminar algo que nos pueda dar errores adentro del brand.md, hay que cambiarlo.» · «El formato que se usa va a ser el segundo, el que dice 1.235,50: la coma siempre va a ser los decimales.»
- **Alcance de esas decisiones:** preparar y adoptar por tramos. **No** cubren fusionar, publicar, escribir en la base de datos ni cambiar el logo.
- Entregable: [borrador-sdd-rebrand-sistema.md](../../docs/design/rebrand-erp/borrador-sdd-rebrand-sistema.md): ranking de los 55 módulos, inventario del color por superficie, líneas de `BRAND.md` que chocan, alcance y riesgos del formato `1.234,50` y tramos con allowlist por carpeta. **Sin número de SDD**: lo asigna el Director.
- **Nada se cambió** en código, tokens ni `BRAND.md`.
- Validación: `docs:check` y `sdd:check` **PASARON** (con `node`). Visual: **NO EJECUTADO**.

### Pendiente
- Número(s) de SDD y turno de PC del Director; recomiendo tres SDD (color, cifras, simetría).
- De Sam: tono exacto del azul (viéndolo), símbolo de moneda, regla de tecleo de cifras, y qué hacer con correos, PDF y Chatwoot.

### FUERA DE ALCANCE DETECTADO (nuevo)
- `docs/engineering/project-rules.md` resume las fuentes permitidas como «solo Archivo + JetBrains Mono + Noto Sans SC», desfasado frente a Nunito Sans y Sora (vigentes desde 2026-05-31).
- `BRAND.md:324` enumera 6 variantes de botón que no coinciden con las 5 del Studio.
- El analizador de cifras trata un solo separador como decimal; con el formato nuevo en pantalla puede guardar montos mil veces menores si no se define la regla (riesgo R1 del borrador).

### Decisión añadida (2026-11-20, Sam)
- A «Al teclear «1.234» en un campo de dinero, ¿qué debe entender el sistema?», Sam eligió «Pedir que se aclare». En dinero, el campo rechaza un punto seguido de exactamente tres cifras y pide escribirlo con coma decimal o sin punto. Falta la regla de CBM y peso. Registrado en el borrador del SDD (§1.5 y riesgo R1).
