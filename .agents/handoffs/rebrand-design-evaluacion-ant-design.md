# Handoff — rebrand-design · evaluación de Ant Design y auditoría del dolor de Sam

- Fecha: 2026-11-19
- Owner: Worker «Rebrand Design» (Claude Code, Sonnet 5.5), sesión iniciada por el Director General
- Worktree: `.claude/worktrees/rebrand-design-aa6ba9`
- Rama: `claude/rebrand-design-aa6ba9` (el encargo la llama `rebrand-design`)
- Base: `origin/main` `9ba6bcf32`
- SDD: **ninguno**. Tarea de análisis: no cambia comportamiento del Studio ni código de producto. Propone SDD futuros sin reservar números.
- Estado de tarea: **lista para revisión**. Sin push, sin PR, sin merge: no hay orden del Director ni de Sam para publicar.
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
