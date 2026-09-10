# 🗂 DTD-Cargo · Registro de Decisiones de Marca (BRAND-DECISIONS)

> ## ⚠️ ESTE ARCHIVO LLEGA HASTA **BD-036**. NO ES EL SET COMPLETO.
>
> Las decisiones **BD-037 → BD-069** viven en
> [`BRAND-DECISIONS-BD037-BD069.md`](BRAND-DECISIONS-BD037-BD069.md) (rev. 2 de Cloud Design,
> 2026-08-02, con los punteros de sección corregidos y su tabla de equivalencia vieja→nueva).
> **Leé las dos o vas a aplicar reglas viejas.**
>
> 🔴 **Trampa viva dentro del set nuevo:** **BD-053** (catálogo de WhatsApp) sigue marcada
> `Vigente` y en su "Vocabulario que fijó la web" dice *"entrega hasta el **casco central**
> (fuera, adicional por zona)"* — el modelo de precio que **BD-067 mató**. BD-067 no la anotó como
> enmendada, así que quien cargue el catálogo siguiendo BD-053 reintroduce el término muerto y una
> promesa de precio falsa en una superficie de cliente. **Manda BD-067.**
>
> Este aviso existe porque pasó: el 1-ago se auditó marca contra este archivo creyéndolo completo
> mientras Cloud Design ya iba por BD-052, y treinta decisiones estaban vigentes sin que nadie de
> este lado las conociera. El archivo no avisaba de su propio corte.
>
> **Ojo con lo que este archivo NO refleja todavía:** BD-050 saca "DDP" de toda superficie visible ·
> BD-055 y BD-068 corrigen **tres** variantes incorrectas del RIF (el único bueno es
> `J-50648869-8`) · BD-052 fija la dirección de Valencia · BD-067 codifica que la entrega final se
> cobra por volumen y no por distancia.

> **Qué es esto:** el log único de toda decisión, excepción y cambio normativo de marca. Antes vivían dispersas — en comentarios `/* BRAND-EXCEPTION */` del código, en `CLAUDE.md`, en `BRAND-MIGRATION` y en changelogs. Acá quedan centralizadas para que en 6 meses nadie tenga que arqueologizar por qué algo es como es.
>
> **Para Claude Code / Claude:** este archivo es complementario a `CLAUDE.md`. `CLAUDE.md` dice *la regla vigente*; este archivo dice *por qué, desde cuándo y quién la autorizó*. Si vas a romper una regla, primero buscá acá si ya hay una decisión; si no la hay, abrís un `BRAND-CHECK` y, si se aprueba, **registrás la decisión nueva acá** con el formato de abajo.

---

## Decisión local posterior · SDD-0441 · 2026-09-05

Sam autoriza la política de **Estados y mensajes** de BRAND.md: vino para marca;
navy/neutro para información y espera; dorado para atención; verde sólo para
confirmación real y rojo localizado para error. Se propaga a tokens y componentes
del Norte y a las cinco superficies. No cambia etiquetas ni contratos del negocio.
Esta enmienda prevalece sobre ejemplos anteriores que confunden espera con error.
Se identifica por SDD para no ocupar un número BD del registro externo sin reservarlo.

## 📌 Cómo se registra una decisión

Cada entrada es un bloque con este formato. No se borran entradas: las decisiones revertidas se marcan `SUPERSEDED` y se enlaza la que las reemplaza.

```
### BD-NNN · <título corto>
- **Fecha:** AAAA-MM-DD
- **Tipo:** Excepción | Cambio normativo | Terminología | Decisión de arquitectura
- **Estado:** Vigente | Superseded por BD-XXX | Revertida
- **Autorizado por:** <usuario>
- **Aplica a:** <archivos / capas / superficies>
- **Decisión:** <qué se decidió>
- **Por qué:** <razón>
- **Regla viva en:** <dónde quedó codificada — CLAUDE.md, tokens.css, etc.>
```

---

## Decisiones vigentes

### BD-001 · Tipografía del sistema → Nunito Sans + Sora
- **Fecha:** 2026-05-31
- **Tipo:** Excepción
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** capa de **sistema/producto** (ERP, portal, apps de operario). **No** afecta el branding.
- **Decisión:** la capa de sistema usa **Nunito Sans** (cuerpo/datos) + **Sora** (títulos). El branding (logo, wordmark "DTD Cargo", correos, firma) sigue intacto en **Archivo / Archivo Black**.
- **Por qué:** mejor legibilidad con mucho dato en pantalla; se separó la capa de producto de la capa de marca en dos sistemas tipográficos, con un solo punto de control.
- **Regla viva en:** `erp/tokens.css` (`--f-sans`, `--f-display`) · `CLAUDE.md` §Tipografía. Para revertir a la marca: igualar `--f-sans`/`--f-display` a `'Archivo'`/`'Archivo Black'`.

### BD-002 · Tagline nuevo → "Con Confianza, de China a tu puerta."
- **Fecha:** 2026-05 (refinado)
- **Tipo:** Cambio normativo
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** todo material de cara al público + producto.
- **Decisión:** el tagline oficial pasa de "De China a tu puerta. Sin intermediarios." a **"Con Confianza, de China a tu puerta."** — antepone el valor (confianza) a la promesa funcional.
- **Por qué:** la voz pasa de transaccional a relacional sin perder claridad de qué hace la empresa.
- **Regla viva en:** `CLAUDE.md` §Tono y voz · Brand Book §02.

### BD-003 · Casing de marca → "Confianza" con C mayúscula
- **Fecha:** 2026-06-05
- **Tipo:** Cambio normativo
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** el tagline (`Con Confianza, …`) en UI, portal, emails, brand book y piezas sociales.
- **Decisión:** "Confianza" va con **C mayúscula** en el tagline — se trata como palabra-valor de marca, no como adjetivo. El sub-claim y los "niveles de confianza" (IA/ferias) siguen en minúscula.
- **Por qué:** elevar "Confianza" a sustantivo de marca refuerza el posicionamiento.
- **Regla viva en:** `CLAUDE.md` §Tono y voz · Brand Book §02.

### BD-004 · Terminología → "Shipping Mark" (término único)
- **Fecha:** 2026-06-10
- **Tipo:** Terminología
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** toda la UI y docs de cara a cliente/proveedor/interno/marketing.
- **Decisión:** se elimina "MARKBOX" del lenguaje visual. El término único en todos los contextos es **Shipping Mark** (唛头). El **valor** del código no cambia (`DTD-XXXX`); solo la etiqueta. En código, la clave interna `markbox:` **no se renombra** — solo las etiquetas visibles.
- **Por qué:** "Shipping Mark" es el lenguaje universal de carga; reduce fricción con el proveedor chino y unifica el habla de marca.
- **Regla viva en:** `CLAUDE.md` §Terminología · Shipping Mark.

### BD-005 · Terminología → Compra / Orden / Prealerta por audiencia
- **Fecha:** 2026-06
- **Tipo:** Terminología
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** Portal/app (cliente), ERP (interno), concepto puerta-a-puerta.
- **Decisión:** son **el mismo registro** con etiqueta según audiencia — **Compra** (cliente, CTA "Nueva compra", anclado a "prealerta"), **Orden** (`DTD-XXXX-x-x`, interno/ERP), **Prealerta** (concepto US/VE). El valor del registro no cambia. No renombrar el CTA del portal a "Compra / Prealerta".
- **Por qué:** cada audiencia reconoce un término distinto; forzar uno solo confunde al cliente ex-casillero.
- **Regla viva en:** `CLAUDE.md` §Terminología · Compra/Orden/Prealerta.

### BD-006 · Logo → sistema v1.0 de 4 variantes
- **Fecha:** 2026-05-26
- **Tipo:** Decisión de arquitectura
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** todo uso del logo (ERP, portal, operario, brand book, colateral).
- **Decisión:** el isólogo migra a **4 variantes oficiales** (primary · reverse · mono-light · mono-dark) + wordmark separado en dos palabras "DTD Cargo". Se elimina el raster viejo `dtdcargo-icon-navy.png` y el wordmark concatenado "DTDCARGO". Componente único `<Lockup>`.
- **Por qué:** resuelve el problema de contraste por fondo (ratios WCAG) y unifica el lockup en un solo componente reusable.
- **Regla viva en:** `BRAND-MIGRATION-2026-05.md` · `CLAUDE.md` §Logo · `Logo Oficial.html`.

### BD-007 · Asset eliminado → `dtdcargo-icon-navy.png`
- **Fecha:** 2026-06-05
- **Tipo:** Decisión de arquitectura
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** todo el proyecto.
- **Decisión:** se borra el raster viejo del proyecto tras migrar todas las referencias al sistema v1.0.
- **Por qué:** cerrar la migración del logo; evitar que reaparezca el isólogo viejo.
- **Regla viva en:** `BRAND-MIGRATION-2026-05.md` §Archivos a eliminar.

### BD-008 · Versión única visible → v4.4
- **Fecha:** 2026-06
- **Tipo:** Cambio normativo
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** sidebar ERP, Portal, apps de operario, tokens, Brand Book, Brand Hub.
- **Decisión:** marca y producto comparten un único número visible: **v4.4**. Cualquier etiqueta vieja (v2.x/v3.x) se actualiza. Los CHANGELOG históricos no se reescriben.
- **Por qué:** una sola versión visible evita la confusión de "¿cuál es la vigente?".
- **Regla viva en:** `CLAUDE.md` §Sincronización con Norte (regla 6).
- **Nota:** corregido en `Brand Hub` el 2026-06-20 (decía v3.7 en el footer — contradecía esta decisión).

### BD-009 · Arquitectura → modelo branded house, 4 niveles
- **Fecha:** 2026-06-20
- **Tipo:** Decisión de arquitectura
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** todo lo que produce la marca (productos, plataformas, herramientas, documentos).
- **Decisión:** se formaliza el modelo **branded house** con 4 niveles (marca madre → 2 capas de expresión → plataformas → herramientas) y la **convención de naming** ("DTD ___" endoso solo para plataformas N2; descriptivo para herramientas N3; nombre estándar para documentos). Ninguna entidad inventa logo ni color propio.
- **Por qué:** el sistema creció por acumulación sin un mapa que declare cómo se relacionan las entidades ni cómo se nombran las nuevas.
- **Regla viva en:** `Arquitectura de Marca · DTD-Cargo.html` · catalogada en el Brand Hub.

### BD-010 · Capa verbal → 3 audiencias + messaging house
- **Fecha:** 2026-06-20
- **Tipo:** Decisión de arquitectura
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** todo el copy de marca y producto; alimenta el Asistente de Contenido.
- **Decisión:** se documentan las **3 audiencias** (comerciante PyME · emprendedor primerizo/ex-casillero · proveedor en Yiwu) y la **casa de mensajes** (techo = tagline · 4 pilares · base = filosofía), más la matriz de tono (cercano/operativo/formal).
- **Por qué:** era el vacío más grande del sistema — voz definida pero sin saber para quién ni con qué jerarquía de mensajes.
- **Regla viva en:** `Mensajes y Audiencias · DTD-Cargo.html` · Brand Book §11 (voz).

### BD-011 · Visualización de datos → paleta desde tokens, rampas por alpha
- **Fecha:** 2026-06-20
- **Tipo:** Cambio normativo
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** ERP, KPIs, reportes, propuestas — cualquier gráfico.
- **Decisión:** paleta de charts **categórica** (orden fijo de 6 tokens, wine protagonista), **semántica** (success/warning/danger/info/neutral solo para significado) y **secuencial** (un token con opacidad escalonada — **cero hex nuevos**). Máximo 6 series; verde/rojo nunca como categoría.
- **Por qué:** `CLAUDE.md` prohibía colores random en charts pero no definía la secuencia oficial; el primer dashboard real la iba a improvisar.
- **Regla viva en:** `Sistema de Datos · DTD-Cargo.html` · tokens en Brand Book §06.

### BD-012 · Accesibilidad → matriz de contraste de texto (WCAG)
- **Fecha:** 2026-06-20
- **Tipo:** Cambio normativo
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** todo texto del sistema, light y dark.
- **Decisión:** se documentan los ratios WCAG de cada token de texto sobre cada superficie. Reglas duras: `ink-mute` nunca como texto de lectura (reprueba en light); en **dark, `--wine` es fill/acento, nunca texto** (usar `wine-soft`); `wine-soft` en light solo a tamaño grande; semánticos como texto fino con cuidado.
- **Por qué:** el contraste estaba resuelto solo para el logo; el del texto se improvisaba pantalla a pantalla.
- **Regla viva en:** `Accesibilidad de Color · DTD-Cargo.html` · complementa Brand Book §04.

### BD-013 · Posicionamiento competitivo formalizado
- **Fecha:** 2026-06-20
- **Tipo:** Decisión de arquitectura
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** mensaje comercial, ventas, propuestas, redes.
- **Decisión:** se explicita la **declaración de posicionamiento**, el marco competitivo (vs courier/casillero, mayorista local, viajar y comprar solo, freight forwarder), la **cuña** (presencia propia Yiwu+Valencia · cadena completa con un responsable · 18 años) y el **alcance honesto** (para quién sí / no).
- **Por qué:** el argumento estaba implícito en el propósito; faltaba hacerlo explícito y defendible.
- **Regla viva en:** `Posicionamiento · DTD-Cargo.html` · deriva de Brand Book §02–§03.

### BD-014 · Voz de IA y asistentes unificada a tuteo
- **Fecha:** 2026-06-20
- **Tipo:** Cambio normativo
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** prompts de IA y copy de cara al cliente/equipo (Copilot del ERP, detección de ferias/feriados, plantillas de correo, portal, apps de operario, generadores de marca).
- **Decisión:** se elimina el voseo de todas las superficies vivas y se instruye a los asistentes de IA a responder en **tuteo venezolano** (tú/eres). Se barrieron ~30 strings en ~20 archivos; se corrigieron las directivas de handoff que pedían “voseo” para evitar regresión. Quedan en voseo solo registros históricos (CHANGELOG) y snapshots de export (`design_handoff_mobile_app/`, `para-enviar/`, `paquete-drive/`).
- **Por qué:** el voseo viola la regla de voz #1 del `CLAUDE.md` (tuteo venezolano, nunca voseo). Estaba disperso en producto y, peor, los prompts de IA ordenaban responder en voseo.
- **Regla viva en:** `CLAUDE.md` §Tono y voz · `pantallas/copilot.jsx` · `erp/modules/fairs-detection.jsx` · `erp/data.jsx`.

### BD-015 · Versión única visible → v4.5
- **Fecha:** 2026-06-20
- **Tipo:** Cambio normativo
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** Brand Book (archivo renombrado a `Brand Book DTD v4.5.html` + punteros), sidebar ERP, títulos de Portal/Registro/Mobile ERP, apps de operario, tokens, microsites de marca, Brand Hub, Launcher y notas de generadores.
- **Decisión:** marca y producto suben juntos de **v4.4 → v4.5**. v4.5 enmarca el rediseño del Portal del Cliente y el nuevo Sistema de Movimiento. El changelog interno del Brand Book conserva la fila v4.4 como historia; se agrega la fila v4.5. Reemplaza la vigencia de BD-008 (que fijaba v4.4) sin borrar su registro.
- **Por qué:** los cambios de este ciclo (Portal + motion) son una revisión visible que amerita número propio; mantener un solo número evita el "¿cuál es la vigente?".
- **Regla viva en:** `CLAUDE.md` §SYNC-Norte (regla 6) · `CHANGELOG.md` (entrada 2026-06-20) · `Brand Book DTD v4.5.html`.

### BD-016 · Accesibilidad → capa de contraste & legibilidad (WCAG 2.2 AA) + 6.ª regla
- **Fecha:** 2026-07-06
- **Tipo:** Cambio normativo
- **Estado:** Vigente
- **Autorizado por:** el usuario (auditoría NORTE-SYNC 2026-07-06)
- **Aplica a:** todo texto, ícono informativo, borde de control, foco y estado del sistema — light y dark.
- **Decisión:** se formaliza la capa **♿ Contraste & legibilidad** con umbrales WCAG 2.2 AA (normal ≥ 4.5:1; grande ≥ 3:1 = **≥ 24px o ≥ 18.66px negrita**; no-texto ≥ 3:1), la regla de relleno+texto (sobre warning = `--ink`, en dark sobre relleno semántico = `--ink-inv`, nunca blanco), el rol de `--wine` en dark (relleno, no texto), la paridad light/dark verificada y "no solo color" (1.4.1). El **resumen ejecutivo pasa de 5 a 6 reglas** — la 6.ª: *"Todo texto se lee."*
- **Por qué:** el contraste estaba resuelto para el logo (BD-006) y esbozado para texto (BD-012); faltaba una capa medida, con umbrales y matriz verificada, que cerrara los agujeros (badge warning, focus dark, ink-mute como texto, blanco sobre relleno semántico en dark).
- **Regla viva en:** `CLAUDE.md` §♿ + Resumen ejecutivo (6 reglas) · `Brand Book DTD v4.6.html` §♿ + matriz · `Accesibilidad de Color · DTD-Cargo.html` (matriz de 24 ratios). Complementa y extiende BD-012.

### BD-017 · Foco visible theme-aware (dark = wine-soft · sidebar = cream)
- **Fecha:** 2026-07-06
- **Tipo:** Cambio normativo
- **Estado:** Vigente
- **Autorizado por:** el usuario (auditoría NORTE-SYNC 2026-07-06)
- **Aplica a:** `:focus-visible` de todo el sistema (ERP, portal, operario), light y dark.
- **Decisión:** el ring de foco es por tema. Light = `--wine` (10.13 ✅). **Dark = `--wine-soft`** porque `--wine` dark (#A8323E) da 2.79 sobre bg-base → falla 1.4.11. Sobre superficies navy (sidebar) `--wine` es invisible (1.56) → foco en cream/`--ink-side` (hook `[data-surface="navy"]` / `.dtd-on-navy`).
- **Por qué:** el foco anterior era único (`outline: 2px solid var(--wine)`) sin distinción de tema; en dark y sobre navy no alcanzaba el 3:1 de no-texto.
- **Regla viva en:** `erp/tokens.css` (`[data-theme="dark"] :focus-visible`, `[data-surface="navy"] :focus-visible`) · `CLAUDE.md` §♿ (foco visible).

### BD-018 · Badge warning → texto `--ink` + dot dorado
- **Fecha:** 2026-07-06 (completado a todos los tonos que fallan AA el 2026-07-12)
- **Tipo:** Cambio normativo
- **Estado:** Vigente
- **Autorizado por:** el usuario (auditoría NORTE-SYNC 2026-07-06 · completado 2026-07-12)
- **Aplica a:** `Badge` en `erp/components.jsx` (heredado por ERP y Portal).
- **Decisión:** el badge deja de usar texto de color semántico sobre su `-bg` cuando falla AA en algún tema. Tonos migrados a **texto `--ink`** (o `--wine-text` en wine) **+ dot** semántico: `success` (light 3.83), `warning` (light 2.79), `info` (light 4.20), `wine` (dark 2.79). `danger` (5.61) y `neutral` (4.68) pasan AA como texto directo y quedan igual.
- **Por qué:** el par de color sobre su fondo tenue era ilegible en badges (texto de 10–12px) en más tonos de los detectados originalmente; el `--ink`/`--wine-text` + dot preserva la señal de color sin sacrificar legibilidad.
- **Regla viva en:** `erp/components.jsx` (objeto `tones` de `Badge`) · `CLAUDE.md` §♿ (badges) · Brand Book §♿.

### BD-019 · `--ink-mute` nunca texto legible (rol = disabled/decorativo)
- **Fecha:** 2026-07-06
- **Tipo:** Cambio normativo
- **Estado:** Vigente
- **Autorizado por:** el usuario (auditoría NORTE-SYNC 2026-07-06)
- **Aplica a:** capa de sistema — `erp/` (components + 55 módulos), `portal/`, apps de operario (`operario/`, `empleado/`, `mobile/`).
- **Decisión:** `--ink-mute` (light #9B9B9B 2.78:1 · dark #6E7896 2.97:1) queda **solo para disabled y decoración**. Todo uso como texto (hint, prefix/suffix, caption, sub de KPI, count de Tabs, breadcrumb, timestamps) migra a **`--ink-soft`** (5.33:1 ✅). Placeholder informativo tampoco es uso válido (1.4.3).
- **Por qué:** a 2.78/2.97:1 ningún texto se lee; era el hallazgo de contraste más extendido del sistema.
- **Regla viva en:** `erp/tokens.css` (comentario de rol en `--ink-mute` light + dark) · `erp/components.jsx` + módulos + portal + operario · `CLAUDE.md` §♿.

### BD-020 · Split de `--danger` por superficie (web #C2353F · ERP #A8323E)
- **Fecha:** 2026-07-06
- **Tipo:** Cambio normativo
- **Estado:** Vigente
- **Autorizado por:** el usuario (auditoría NORTE-SYNC 2026-07-06)
- **Aplica a:** color de error/danger según superficie.
- **Decisión:** el `--danger` del ERP/Portal **no cambia** (#A8323E). Se agregan `--danger-web: #C2353F` y `--danger-web-bg: rgba(194,53,63,0.10)` para **marketing / web pública**, que en producción usa ese rojo (`app/globals.css`).
- **Por qué:** el danger del sitio público de producción es #C2353F; unificar al del ERP hacía que una pieza de marketing generada desde el sistema usara el rojo equivocado.
- **Regla viva en:** `erp/tokens.css` (`--danger-web`, `--danger-web-bg`) · `app/globals.css` · `CLAUDE.md` §color · Brand Book §06.

### BD-021 · Terminología → MARKBOX (web pública) / Shipping Mark (Studio·Portal·Móvil) · enmienda BD-004
- **Fecha:** 2026-07-06
- **Tipo:** Terminología (excepción a BD-004)
- **Estado:** Vigente
- **Autorizado por:** el usuario (BRAND-CHECK explícito · auditoría NORTE-SYNC · SDD-0065)
- **Aplica a:** etiquetas visibles del identificador de cliente en todas las superficies.
- **Decisión:** el término se **divide por superficie**: **web pública = "MARKBOX"** · **Studio / Portal / apps de operario = "Shipping Mark"** (唛头). El **valor** del registro (`DTD-XXXX`) y la **clave de datos `markbox`** NO cambian en ningún caso. Esto **enmienda BD-004**.
- **Por qué:** BD-004 (2026-06-10) retiró "MARKBOX" de todo el lenguaje; la auditoría de producción (SDD-0065) verificó que la web pública sigue usando "MARKBOX" como término que el mercado reconoce.
- **Regla viva en:** `CLAUDE.md` §Terminología · Shipping Mark / MARKBOX (split por superficie). Verificado en este repo (Norte): ya aplicado — cero drift en `app/{page,faq,glosario,servicios,cotizar,track,calculadora,noticias,estimacion,contacto,registro}` (público=MARKBOX) vs `app/studio` / `app/portal` / `app/m` (Shipping Mark).

### BD-022 · Gradiente de hero → horizontal (azul fuerte a la izquierda) + hex explícito
- **Fecha:** 2026-07-06
- **Tipo:** Cambio normativo
- **Estado:** Vigente
- **Autorizado por:** el usuario (feedback de revisión sobre el hero de `Accesibilidad de Color`)
- **Aplica a:** el gradiente de fondo de los **heros con texto** (microsites de marca, portal, login). No afecta cards/botones chicos.
- **Decisión:** el gradiente de hero pasa de diagonal `linear-gradient(135deg, var(--ink), #1F3055)` a **horizontal con el azul más fuerte a la izquierda**: `linear-gradient(90deg, #0B1428 0%, #0F1E3D 44%, #1F3055 100%)`. **Hex explícito, nunca `var(--ink)` dentro del gradiente** — si el token no resuelve, el fondo cae a blanco con texto claro encima (invisible). En cards/botones chicos el `135deg` del mismo par es aceptable.
- **Por qué:** el hero mostraba (o podía mostrar) fondo blanco con texto blanco; el degradado diagonal no orientaba el texto left-aligned sobre la zona de mayor contraste.
- **Regla viva en:** `CLAUDE.md` §AI Slop / gradiente · `BRAND.md` §Colores prohibidos.

### BD-023 · Hardening `var(--ink)`→`#0F1E3D` en TODOS los gradientes (completa BD-022)
- **Fecha:** 2026-07-10 (aplicado en este repo/Norte: 2026-07-12)
- **Tipo:** Cambio normativo (implementación de BD-022)
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** todo `linear-gradient(...)` que usaba `var(--ink)` / `var(--ink2)` como parada de color.
- **Decisión:** ningún gradiente usa `var(--ink)`/`var(--ink2)`; se sustituyen por hex explícito manteniendo el ángulo original. Corrige además un bug de **dark theme**: `var(--ink)` se invierte a cream, volteando tarjetas navy a fondo claro con texto blanco encima.
- **Archivos barridos en este repo (Norte, 2026-07-12):** `app/m/cn/login/page.tsx`, `app/m/ve/login/page.tsx`, `app/m/ve/modos/_components/ModosClient.tsx`, `app/studio/(app)/usuarios/_components/InviteUserDrawer.tsx`, `app/admin/cbm-estudio/content.html` (2 gradientes) — 6 hits, cero restantes (`rg "linear-gradient([^)]*var\(--ink"`).
- **Regla viva en:** capa de código barrida arriba · principio en `CLAUDE.md` §AI Slop / gradiente (BD-022).

### BD-024 · Bump de versión v4.5 → v4.6 (marca + producto)
- **Fecha:** 2026-07-10
- **Tipo:** Versionado
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** toda etiqueta de versión visible del proyecto (marca y producto comparten número).
- **Decisión:** marca y producto suben juntos de **v4.5 → v4.6**. v4.6 enmarca el ciclo de accesibilidad (BD-016…019), el hardening de gradientes (BD-022/023) y el split de terminología MARKBOX/Shipping Mark (BD-021), más `--danger-web` (BD-020). El Brand Book se renombra `Brand Book DTD v4.5.html` → **`Brand Book DTD v4.6.html`**.
- **✅ Estado en este repo (Norte, 2026-07-12):** tokens/componentes/gradientes sincronizados en el primer pase; el archivo físico llegó después como standalone (todo embebido, 14 MB — mismo formato que ya usaba `private/marca/brand-book-v4.5.html`, el fetch por MCP de la versión editable liviana excedía el cap de 256 KiB y no era viable). Publicado en `docs/design/studio/_norte/Brand Book DTD v4.6.html` y `private/marca/brand-book-v4.6.html`; v4.5 borrado de ambos. Punteros de código actualizados: `app/interno/(app)/marca/d/[bundle]/route.ts`, `app/interno/(app)/marca/page.tsx`, `app/marca/asset/[name]/route.ts`, `app/marca/brand-book/page.tsx`, `components/BrandMark.tsx`, `lib/design-tokens.ts`.
- **Por qué:** los cambios del ciclo (accesibilidad + gradientes + terminología) son una revisión visible que amerita número propio.
- **Regla viva en:** `CLAUDE.md` §SYNC-Norte (regla 6) · `CHANGELOG.md` (entrada 2026-07-12) · `HANDOFF.md`.

### BD-025 · Links de portal (P1/P2) en el sidebar navy → dorado `--warning`, no wine
- **Fecha:** 2026-07-10
- **Tipo:** Cambio normativo (legibilidad · aplica BD-016/017)
- **Estado:** Vigente
- **Autorizado por:** el usuario (revisión: "el tono no se ve bien de lejos")
- **Aplica a:** los links de portal en el sidebar del `Brand Book DTD v4.6.html` (documento de marca; no aplica a código de este repo).
- **Decisión:** wine sobre sidebar navy (1.56:1, invisible) → **`var(--warning)`** (dorado, ~4.9:1) + `font-weight:700`.
- **Por qué:** wine como texto sobre navy no cumple contraste; el dorado es el acento cálido de la paleta que sí lee sobre navy.
- **Regla viva en:** `Brand Book DTD v4.6.html`. Refuerza el principio de BD-016 (wine no es texto sobre navy) — aplicable a cualquier link de acento sobre navy en este repo también.

### BD-026 · Token `--wine-text` — wine como TEXTO, voltea por tema
- **Fecha:** 2026-07-10
- **Tipo:** Cambio normativo (adición pura de token · aplica BD-016)
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** todo uso de wine como color de texto en el ERP/Portal.
- **Decisión:** `--wine-text` voltea por tema reusando hexes existentes: `:root → #7F0F1A` (= `--wine` light) · `[data-theme="dark"] → #D89AA4` (= `--wine-soft` dark). AA body ✅ en las 6 combinaciones.
- **Por qué:** `--wine` como texto falla AA en dark (2.79/2.26/1.98); `--wine-soft` pasa en dark pero en light solo como texto grande.
- **Regla viva en:** `erp/tokens.css` (`--wine-text`) · `app/studio/tokens.css` (ya presente en este repo desde una sesión previa) · `CLAUDE.md` §♿.

### BD-027 · Token `--on-warning` — texto/ícono sobre relleno `--warning` sólido
- **Fecha:** 2026-07-10
- **Tipo:** Cambio normativo (adición pura de token · aplica BD-016/018)
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** texto/ícono encima de un relleno `--warning` sólido (ej. badge con fill dorado).
- **Decisión:** token navy fijo en ambos temas: `--on-warning: #0F1E3D` (`:root` y dark). Sobre `--warning` light = 5.24 ✅ · dark = 7.92 ✅.
- **Por qué:** `--ink` es navy solo en light (cream en dark, ~1.7 sobre gold ❌); `--on-warning` fija el navy en ambos temas.
- **Regla viva en:** `erp/tokens.css` (`--on-warning`) · `app/studio/tokens.css` (ya presente en este repo desde una sesión previa) · `CLAUDE.md` §♿.

### BD-028 · Patch v4.6 — Badge success/info/wine + KPI delta + wine-text portal + tuteo (sin bump de versión)
- **Fecha:** 2026-07-12
- **Tipo:** Cambio normativo (patch, completa BD-018/019/026 · aplica BD-014)
- **Estado:** Vigente (verificado en este repo — ver nota de aplicación abajo)
- **Autorizado por:** el usuario (pase de auditoría/UI-check del Portal en la fuente de marca)
- **Aplica a:** `Badge`/`KPI` del ERP, capa portal de la fuente de marca, tuteo del portal + manifests.
- **Decisión:** completar BD-018 en `Badge` (`success`/`info`/`wine` → texto `--ink`/`--wine-text` + dot semántico; `danger`/`neutral` sin cambios); `KPI` delta → texto `--ink-soft` + dot 6px en el tono (antes pintaba el texto en el tono, fallaba AA en light); `.eyebrow-wine` → `--wine-text`; barrido de `var(--wine)` texto/ícono → `var(--wine-text)` en la capa portal de la fuente; barrido de voseo residual en portal + manifests. **Sin bump de versión — sigue v4.6.**
- **Nota de aplicación en este repo (Norte, 2026-07-12):** `Badge.tsx` (`app/studio/_components/ui/Badge.tsx`) **ya cumplía** el patrón completo (se había migrado en el sync anterior del mismo día). El resto de los ítems del patch **no tienen equivalente vivo en este repo** — verificado, no ignorado:
  - `KPI` de Studio (`KpiCard.tsx`) no tiene el prop `delta` que describe el bug; no hay nada que migrar.
  - `.eyebrow-wine` solo existe como regla CSS en `app/studio/tokens.css` (ya `--wine-text`); en `app/portal` la clase se usa pero **no resuelve a ninguna regla** (Portal no importa `tokens.css` de Studio) — className inerte preexistente, no introducida por este sync, fuera de alcance de un patch de tokens.
  - El barrido `var(--wine)`→`var(--wine-text)` **no aplica**: `app/portal` usa un sistema de tokens Tailwind v4 independiente (`--color-wine` en `@theme`, `app/globals.css`), con su **propio valor dark ya ajustado** (`#c24450`, comentado "más brillante para leer sobre navy") — no el split relleno/texto de Studio. Cero ocurrencias de `var(--wine)` crudo en `app/portal` (128 usos de la utilidad `text-wine`, sistema aparte, no tocado).
  - El straggler "Paso obligatorio" (`--ink-mute` en el modal de aceptación) no existe como copy en este repo — específico del prototipo de la fuente de marca.
  - Voseo: barrido en `app/portal` + `public/*/manifest.json` → **0 hits**, ya limpio de una sesión anterior (BD-014).
- **Por qué:** la fuente de marca es un prototipo de un solo archivo; este repo de producción ya diverge en varias superficies (Portal con su propio sistema de tokens Tailwind). Documentar la divergencia evita reabrir el mismo ítem en cada sync.
- **Regla viva en:** `app/studio/_components/ui/Badge.tsx` (ya conforme) · esta entrada (mapa de divergencia Portal↔ERP).

### BD-029 · Terminología → "Shipping Mark" único en TODAS las superficies (revierte BD-021)
- **Fecha:** 2026-07-12
- **Tipo:** Terminología (cambio de estrategia · revierte BD-021, reafirma BD-004)
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** etiquetas visibles del identificador de cliente en TODAS las superficies (web pública, marketing, Studio/ERP, Portal, apps de operario, trato con proveedor chino).
- **Decisión:** se **elimina "MARKBOX"** del lenguaje visual y se unifica el término en **"Shipping Mark"** (唛头) en todas las superficies, incluida la web pública. **Revierte BD-021** (que había repuesto "MARKBOX" solo en web pública) y **reafirma BD-004** (término único). El **valor** del registro (`DTD-XXXX`) y la **clave de datos `markbox`** (props, `c.markbox`, clases CSS `.markbox*`, param `?mb=`) NO cambian — solo la etiqueta visible.
- **Por qué:** cambio de estrategia de marca del usuario: "MARKBOX" ya no se muestra al público; todo pasa a "Shipping Mark". Un solo término reduce ambigüedad y alinea el habla de marca de punta a punta. En la web se acompaña del gesto pedagógico "casillero → Shipping Mark" (tachado) para el cliente ex-courier.
- **Nota de aplicación en este repo (Norte, 2026-07-19):** el Studio/Portal ya muestran "Shipping Mark" (BD-021 nunca introdujo "MARKBOX" en producción — el término interno/clave sigue siendo `markbox`, sin cambios). El **barrido de "MARKBOX" → "Shipping Mark" en la web pública** (`app/markbox`, home, fichas) queda **pendiente** y entra con la reconstrucción de la web pública (ver `NORTE-SYNC-2026-07-19` §0), no en este sync.
- **Regla viva en:** `CLAUDE.md` §Terminología · Shipping Mark (término único). Reemplaza la vigencia de BD-021.

### BD-030 · Glow radial navy→ink permitido en fondos (extiende BD-022/023)
- **Fecha:** 2026-07-12
- **Tipo:** Cambio normativo (extensión de BD-022/023)
- **Estado:** Vigente
- **Autorizado por:** el usuario
- **Aplica a:** fondos de cualquier diseño del sistema (microsites, calculadora, portal, piezas), light y dark.
- **Decisión:** se permite —y se recomienda para evitar fondos planos— un **glow radial navy→ink** como fondo: `radial-gradient(135% 100% at 50% -12%, #1F3055 0%, #0F1E3D 42%, #0B1428 100%)` en dark; en light, el equivalente sutil en tonos papel `#F2F0EC → #FBFAF7`. Mantiene BD-022/023: **hex explícito** (nunca `var(--ink)` dentro del gradiente) y **nunca hacia blanco** en la familia navy. No sustituye el gradiente de hero (BD-022, horizontal 90°); es para superficies de fondo. **Sigue siendo tonal — los gradientes coloridos siguen prohibidos.**
- **Por qué:** los fondos planos se ven pobres; un glow radial da profundidad moderna sin salir del sistema ni caer en "AI slop" (gradientes coloridos o hacia blanco).
- **Nota de aplicación en este repo (Norte, 2026-07-19):** token **`--bg-glow`** agregado a `app/globals.css` (light `#FBFAF7→#F2F0EC` · dark `#1F3055→#0F1E3D→#0B1428`, hex explícito); documentado en `BRAND.md` §Colores/gradiente. Aplicado como fondo del embed de la calculadora.
- **Regla viva en:** `CLAUDE.md` §AI Slop / gradiente · `app/globals.css` (`--bg-glow`) · `BRAND.md`. Extiende BD-022/BD-023.

### BD-031 · Sistema "Glass" (glassmorphism) permitido para superficies elevadas
- **Fecha:** 2026-07-17
- **Tipo:** Cambio normativo (levanta una prohibición de AI-slop · autorizado por el Founder)
- **Estado:** Vigente
- **Autorizado por:** el Founder (el usuario)
- **Aplica a:** superficies **elevadas/flotantes** del sistema — calculadora flotante, botón "Calcular", modales/overlays y popovers que floten sobre fondo navy o sobre imagen. Light y dark. **No** para superficies de dato denso, tablas, body ni fondos de página.
- **Decisión:** se **permite** el esquema Glass (vidrio esmerilado: `backdrop-filter: blur(12–22px) saturate(~150%)` + superficie translúcida + borde `rgba(255,255,255,·)` + highlight `inset 0 1px 0`). Voltea por tema: **dark** = vidrio navy translúcido (`rgba(31,48,85,·)`→`rgba(15,30,61,·)`) con texto **cream** `#F2F0EC`; **light** = vidrio blanco translúcido (`rgba(255,255,255,.45–.72)`) con texto **navy** `--ink`. Acentos/operadores/"=" en wine (`--wine`/`--wine-soft`/`--wine-text` según tema). Revierte parcialmente la prohibición de "glassmorphism" que estaba en `CLAUDE.md` §AI Slop y en la 3.ª regla del resumen.
- **Reglas de uso (para no volver a caer en slop):** (1) solo en superficies elevadas, nunca "en todos lados"; (2) **el texto sobre el vidrio debe cumplir AA** contra el peor caso del fondo — cream sobre glass navy, navy sobre glass blanco (nunca gris tenue); (3) el vidrio no reemplaza `--bg-surface` en cards de contenido; (4) sin blur difuso estilo macOS en botones pequeños de contenido; (5) siempre con `-webkit-backdrop-filter` de respaldo y un color de relleno translúcido (fallback si el navegador no soporta blur).
- **Por qué:** el Founder validó el preview y considera que, acotado a superficies flotantes, se ve premium y **no rompe la marca** (se mantiene navy/wine/cream, sin gradiente colorido). Da una capa de profundidad moderna a overlays.
- **Nota de aplicación en este repo (Norte, 2026-07-19):** tokens **`--glass-*`** (`bg`/`border`/`hi`/`blur`/`ink`/`shadow`/`key`/`inset`) agregados a `app/globals.css` (web/portal, light+dark) **y** a `app/studio/tokens.css` (ERP, light+dark), espejo 1:1 del Norte. Aplicado a la **calculadora flotante del portal** (`app/portal/_components/PortalCalcFab.tsx`) — el panel es vidrio; la barra de título sigue navy sólida (contraste AA del texto blanco). `BRAND.md` §AI Slop: excepción Glass documentada. No expandido a más superficies (regla: nueva superficie → nueva BD).
- **Regla viva en:** `CLAUDE.md` §AI Slop (excepción Glass) + Resumen ejecutivo (3.ª regla) · `app/globals.css` + `app/studio/tokens.css` (`--glass-*`) · `app/portal/_components/PortalCalcFab.tsx` · `BRAND.md`.

### BD-032 · Mockups del portal (Tanda 2) en tipografía de marca
- **Fecha:** 2026-07-19 · **Autoriza:** founder (Gate 2 · P2 servicios)
- **Tipo:** Excepción (alcance limitado a mockups de diseño)
- **Estado:** Vigente
- **Decisión:** las pantallas del flujo del portal en `Tanda 2 · Arte Final · DTD-Cargo.html` (pieza 12, A–E) van en **Archivo / Archivo Black** + JetBrains Mono (códigos) + Noto Sans SC (chino) — no en Nunito Sans + Sora.
- **Por qué:** «el producto real corre en Archivo; estos mockups guían su build». Las 4 fichas de la tanda ya estaban en capa de marca; esto unifica el documento.
- **Alcance:** solo los mockups de diseño de servicios (T2/web). **No** revierte BD-001 (sistema ERP/Portal en producción sigue según `erp/tokens.css`).
- **Nota de aplicación en este repo (Norte, 2026-07-19):** N/A en producción — es una decisión sobre mockups de diseño de la fuente de marca. El Studio ya corre en Archivo (BRAND-EXCEPTION `studio-sys`) y la web pública en Archivo por default; nada que migrar en el repo.
- **Regla viva en:** mockups de servicios de la fuente de marca (`Tanda 2 · Arte Final`, PDFs A4 de la llegada).

### BD-033 · Glass en superficies flotantes del ERP Studio (extiende BD-031)
- **Fecha:** 2026-07-19
- **Tipo:** Cambio normativo (extensión de BD-031 a superficies concretas del ERP)
- **Estado:** Vigente (aplicado + revisado en vivo por el founder el 2026-07-19)
- **Autorizado por:** el Founder (el usuario) — tras análisis de superficies + revisión visual en `:3005`
- **Origen:** este repo (Claude Code), no la fuente de marca — es una aplicación de producción de BD-031.
- **Aplica a (SOLO estas superficies elevadas/flotantes del Studio):**
  1. **Scrim frosteado** — `backdrop-filter: var(--scrim-blur)` (blur suave 4px) en el overlay de TODOS los modales/drawers: `DrawerShell` (scaffold de ~15 drawers), `ConfirmDialog`, `GlobalSearchModal`. El fondo se esmerila al abrir; el panel sigue opaco → cero riesgo de legibilidad.
  2. **Panel de vidrio del buscador ⌘K** — `GlobalSearchModal` usa los tokens `--glass-*` (bg translúcido + `--glass-blur` 18px + border + shadow), con texto `--glass-ink` (AA en ambos temas). Es la superficie glass icónica (Spotlight/Raycast).
- **NO aplica (excluido a propósito):** toasts (`ToastProvider` — llevan color semántico + auto-dismiss, decisión previa "cero glassmorphism"), el PANEL de los drawers (formularios densos), tablas, KPIs, cards de contenido y fondos de página (ahí sigue siendo AI slop · BD-031).
- **Token nuevo:** `--scrim-blur: blur(4px)` en `app/studio/tokens.css` (frost del scrim, distinto del `--glass-blur` de paneles).
- **Por qué:** en un ERP denso, Glass es polish, no necesidad; acotado a scrim + ⌘K da el aire premium sin tocar ninguna superficie de trabajo ni la legibilidad. Regla de expansión de BD-031 respetada (superficie nueva → BD nueva).
- **Regla viva en:** `app/studio/_components/ui/drawer/DrawerShell.tsx` · `app/studio/_components/ui/ConfirmDialog.tsx` · `app/studio/_components/wiring/GlobalSearchModal.tsx` · `app/studio/tokens.css` (`--scrim-blur`) · `BRAND.md` §Excepción Glass.

### BD-034 · Fondos de superficie del ERP: degradados tonales + marca de agua "D" (extiende BD-030)
- **Fecha:** 2026-07-19
- **Tipo:** Cambio normativo (sistema de fondos · extiende BD-030 con marca de agua)
- **Estado:** Vigente (aplicado + revisado en vivo por el founder el 2026-07-19)
- **Autorizado por:** el Founder (el usuario) — fuente de diseño: `ERP Degradados.html` + `Fondos ERP.html` (Cloud Design)
- **Aplica a:** superficies vino y navy del ERP Studio (sidebar, hero del dashboard, KPI destacado, fondo de página, cards).
- **Decisión:** las superficies vino/navy dejan de verse planas — llevan un **degradado tonal *dentro de la misma familia* de color** (`--grad-*`) + una **marca de agua del isotipo "D"** (`public/brand/dtdcargo-isologo-mono-light.png`, estilo wallpaper, opacidad baja) + halos radiales de profundidad. **Cero rainbow, cero textura** (sigue BD-030/AI slop). Hex explícito dentro del gradiente (BD-023).
  - **Tokens (`app/studio/tokens.css`, light+dark, espejo de la fuente):** `--grad-wine` (relleno/botones/KPI destacado) · `--grad-wine-soft` (hover de fila) · `--grad-wine-panel` (hero) · `--grad-navy` (sidebar) · `--grad-page` (fondo de app, glow dual sutil) · `--grad-card` (cards, degradado sutil).
  - **Marca de agua "D":** capa decorativa (`z-index:-1` en sidebar; child absoluto en hero/KPI), `pointer-events:none`, recortada por `overflow:hidden`. Opacidades (founder 2026-07-19, subidas para hacerla más notable): sidebar **.05**, hero **.08**, KPI destacado **.10**.
  - **Intensidad +30% (founder 2026-07-19):** tops más brillantes + ends más profundos + mid pulled-in vs la fuente, para que el degradado se note más sin salir de la familia tonal.
- **Aplicado en este repo (Norte, 2026-07-19):** `app/studio/(app)/layout.tsx` (fondo `--grad-page`) · `StudioSidebar.tsx` (grad-navy + glow wine + "D" .05) · dashboard `page.tsx` (hero banda `--grad-wine-panel` + "D" .08, texto `--ink-inv`) · `KpiCard.tsx` (prop `feature` → grad-wine + "D" .10; no-feature → `--grad-card`) · `DashboardWidgets.tsx` (`WCard` → `--grad-card`). **No** se jaló la tokenización `--grad-*` a más superficies del ERP sin decisión (propagación completa = futura).
- **Por qué:** dar profundidad y presencia de marca a las superficies del ERP sin AI slop; la "D" refuerza identidad como watermark discreto.
- **Regla viva en:** `app/studio/tokens.css` (`--grad-*`) · `StudioSidebar.tsx` · dashboard `page.tsx`/`KpiCard.tsx`/`DashboardWidgets.tsx` · `BRAND.md` §Excepción Glass/gradiente.

### BD-035 · Tipografía del ERP → Nunito Sans + Sora (realiza la migración de 2026-06-11)
- **Fecha:** 2026-07-19
- **Tipo:** Cambio normativo (tipografía · fix + realización de la migración de 2026-06-11)
- **Estado:** Vigente (verificado en vivo — fuente computada = Nunito/Sora)
- **Autorizado por:** el Founder (el usuario)
- **Aplica a:** toda la superficie del ERP Studio (cuerpo/nav = Nunito Sans; títulos/display = Sora). Wordmark `<BrandMark>` inmune (usa `--font-brand-display`). Mono (JetBrains) y CJK (Noto SC) sin cambio.
- **Decisión:** el ERP usa **Nunito Sans** (cuerpo) + **Sora** (títulos) — la fuente del sistema de diseño (Norte, BD-001), igual que Portal/Calculadora. Alinea el ERP con sus mockups de Cloud Design (que se ven "limpios/suaves").
- **Contexto — el bug que se arregló:** la decisión del **2026-06-11** de migrar el ERP a Nunito/Sora **nunca surtió efecto**: los tokens `--f-sans`/`--f-display` (`app/studio/tokens.css`) envolvían `var(--font-archivo)`/`var(--font-archivo-black)` declarados en `:root`, así que el `var()` se resolvía EN `:root` (= Archivo) y quedaba **congelado** al heredar — el `.studio-sys` de `globals.css` (que sí redefine `--font-archivo` → Nunito) llegaba tarde. El ERP renderizó **Archivo** desde 2026-06-11 hasta hoy (verificado con `getComputedStyle`). **Fix:** re-declarar `--f-sans`/`--f-display` scopeados a `.studio-sys` en `app/studio/tokens.css` (que se sirve tal cual, sin el lightningcss de Tailwind que descartaba la regla en `globals.css`), donde el `var()` resuelve en scope → todo el ERP migra de verdad.
- **Nota:** Sora no tiene peso 900 en Google Fonts (máx 800); los títulos display (`--f-display` a 900) usan 800 — igual que el mockup.
- **Regla viva en:** `app/studio/tokens.css` (`.studio-sys { --f-sans; --f-display }`) · `app/globals.css` (`.studio-sys` redefine `--font-archivo/-black`) · `app/studio/layout.tsx` (carga Sora + Nunito).

### BD-036 · Noto Serif SC para documento formal en chino
- **Fecha:** 2026-07-29
- **Tipo:** Excepción tipográfica documental
- **Estado:** Vigente; carga técnica V1 integrada por SDD-0175
- **Autorizado por:** Sam (founder)
- **Aplica a:** bloques `lang="zh-CN"` en cartas, contratos, transcripciones,
  correos formales y PDF dirigidos a clientes u oficina en China.
- **Decisión:** Noto Serif SC es la única serif autorizada y solo representa la
  voz documental Song Ti. La interfaz, navegación, formularios y tablas en
  chino continúan en Noto Sans SC. No aplica a marketing, contenido latino,
  títulos de marca ni previews editoriales generales.
- **Fallback:** Noto Sans SC. La estructura label/valor y el idioma deben
  conservar significado sin depender de que la webfont cargue.
- **Límites:** V1 carga la fuente y separa tokens, pero no modifica documentos
  vivos ni autoriza otras serif. Email, PDF y verificación visual permanecen
  como gates V2–V4 de SDD-0175.
- **Regla viva en:** `BRAND.md` §Tipografía · `docs/governance/policies/vis-02.md`
  · SDD-0175.

---

## Índice rápido

| ID | Decisión | Tipo | Estado |
|---|---|---|---|
| BD-001 | Nunito Sans + Sora (sistema) | Excepción | Vigente |
| BD-002 | Tagline "Con Confianza…" | Normativo | Vigente |
| BD-003 | "Confianza" con mayúscula | Normativo | Vigente |
| BD-004 | "Shipping Mark" único | Terminología | Reafirmada por BD-029 |
| BD-005 | Compra/Orden/Prealerta por audiencia | Terminología | Vigente |
| BD-006 | Logo v1.0 · 4 variantes | Arquitectura | Vigente |
| BD-007 | Eliminado `dtdcargo-icon-navy.png` | Arquitectura | Vigente |
| BD-008 | Versión única visible v4.4 | Normativo | Vigente |
| BD-009 | Branded house · 4 niveles | Arquitectura | Vigente |
| BD-010 | 3 audiencias + messaging house | Arquitectura | Vigente |
| BD-011 | Paleta de datos desde tokens | Normativo | Vigente |
| BD-012 | Matriz de contraste de texto (WCAG) | Normativo | Vigente |
| BD-013 | Posicionamiento competitivo | Arquitectura | Vigente |
| BD-014 | Voz de IA/asistentes a tuteo | Normativo | Vigente |
| BD-015 | Versión única visible v4.5 | Normativo | Vigente |
| BD-016 | Capa ♿ contraste/legibilidad + 6.ª regla | Normativo | Vigente |
| BD-017 | Foco visible theme-aware (dark/sidebar) | Normativo | Vigente |
| BD-018 | Badge = texto --ink/--wine-text + dot | Normativo | Vigente |
| BD-019 | --ink-mute nunca texto (solo disabled/deco) | Normativo | Vigente |
| BD-020 | Split de --danger por superficie | Normativo | Vigente |
| BD-021 | MARKBOX (web) / Shipping Mark (Studio·Portal·Móvil) | Terminología | Superseded por BD-029 |
| BD-022 | Hero gradient horizontal + hex explícito | Normativo | Vigente |
| BD-023 | Hardening var(--ink)→#0F1E3D en gradientes | Normativo | Vigente (completa BD-022) |
| BD-024 | Bump v4.5→v4.6 (tokens + book físico) | Versionado | Vigente |
| BD-025 | Links de portal P1/P2 → dorado, no wine | Normativo | Vigente (solo Brand Book) |
| BD-026 | Token `--wine-text` | Normativo (adición) | Vigente |
| BD-027 | Token `--on-warning` | Normativo (adición) | Vigente |
| BD-028 | Patch Badge/KPI/wine-text portal/tuteo | Normativo (patch) | Vigente — Badge✅, resto N/A en este repo |
| BD-029 | "Shipping Mark" único en todas las superficies (revierte BD-021) | Terminología | Vigente — sweep web pública pendiente (§0) |
| BD-030 | Glow radial navy→ink permitido en fondos (tonal, no colorido) | Normativo | Vigente — `--bg-glow` |
| BD-031 | Sistema "Glass" permitido (superficies elevadas) | Normativo | Vigente — `--glass-*` + PortalCalcFab |
| BD-032 | Mockups del portal (T2) en Archivo, no Nunito/Sora | Excepción | Vigente — N/A en este repo |
| BD-033 | Glass en superficies flotantes del ERP (scrim frosteado + panel ⌘K) | Normativo (extiende BD-031) | Vigente — `--scrim-blur` + ⌘K glass |
| BD-034 | Fondos ERP: degradados tonales `--grad-*` + marca de agua "D" | Normativo (extiende BD-030) | Vigente — sidebar/hero/KPI/página |
| BD-035 | Tipografía ERP → Nunito Sans + Sora (realiza la migración de 2026-06-11) | Normativo | Vigente — fix congelamiento `--f-sans`/`--f-display` |
| BD-036 | Noto Serif SC solo para documento formal `zh-CN` | Excepción tipográfica | Vigente — V1 integrado; V2–V4 pendientes |

---

*Mantén este archivo en orden cronológico de ID. Última actualización: 2026-07-30 · DTD-Cargo v4.6 (reconciliación documental · **BD-036 V1 integrado; V2–V4 pendientes**; Brand Book físico no regenerado).*
