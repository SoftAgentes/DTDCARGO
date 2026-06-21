# 🗂 DTD-Cargo · Registro de Decisiones de Marca (BRAND-DECISIONS)

> **Qué es esto:** el log único de toda decisión, excepción y cambio normativo de marca. Antes vivían dispersas — en comentarios `/* BRAND-EXCEPTION */` del código, en `CLAUDE.md`, en `BRAND-MIGRATION` y en changelogs. Acá quedan centralizadas para que en 6 meses nadie tenga que arqueologizar por qué algo es como es.
>
> **Para Claude Code / Claude:** este archivo es complementario a `CLAUDE.md`. `CLAUDE.md` dice *la regla vigente*; este archivo dice *por qué, desde cuándo y quién la autorizó*. Si vas a romper una regla, primero buscá acá si ya hay una decisión; si no la hay, abrís un `BRAND-CHECK` y, si se aprueba, **registrás la decisión nueva acá** con el formato de abajo.

---

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

---

## Índice rápido

| ID | Decisión | Tipo | Estado |
|---|---|---|---|
| BD-001 | Nunito Sans + Sora (sistema) | Excepción | Vigente |
| BD-002 | Tagline "Con Confianza…" | Normativo | Vigente |
| BD-003 | "Confianza" con mayúscula | Normativo | Vigente |
| BD-004 | "Shipping Mark" único | Terminología | Vigente |
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

---

*Mantené este archivo en orden cronológico de ID. Última actualización: 2026-06-20 · DTD-Cargo v4.5.*
