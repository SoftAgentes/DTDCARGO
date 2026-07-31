# VIS-02 v1.0 — Jerarquía tipográfica por voz, destinatario e idioma

| Control | Valor |
|---|---|
| Código | VIS-02 |
| Versión | 1.0 |
| Dueño | Sam (founder) |
| Estado | aprobada — implementación parcial |
| Creado | 2026-07-21 |
| Depende de | [VIS-01](vis-01.md) y A11Y-01 |
| Fuente visual | [`BRAND.md`](../../../BRAND.md), BD-035, BD-036 y Norte vigente |

## 1. Ley central

La tipografía permite reconocer quién habla y qué tipo de información se está
leyendo. No se usa para decorar ni como única señal de separación.

## 2. Familias por voz

| Voz | Familia canónica | Uso |
|---|---|---|
| Marca DTD Cargo | Archivo / Archivo Black | Identidad, nombre de empresa, encabezados de marca, sello y contenido corporativo. |
| Sistema ERP | Nunito Sans / Sora | Interfaz, navegación, instrucciones, datos operativos y contenido dirigido al cliente. |
| Datos/códigos | JetBrains Mono | Shipping Mark, IDs, códigos, HS, RIF, montos tabulares y fechas técnicas cuando mejore alineación. |
| Chino de interfaz — Hei Ti | Noto Sans SC | Portal, ERP, formularios, botones, tablas y traducción de producto en `zh-CN`. |
| Chino documental — Song Ti | Noto Serif SC | Cartas, correos formales, transcripciones, contratos y documentos para clientes/oficina en China. |

## 3. Roles tipográficos

Display → título de pantalla → título de sección → título de tarjeta → cuerpo →
cuerpo compacto → label → eyebrow → caption → dato → feedback.

Reglas:

- una pantalla tiene un título principal;
- encabezados mantienen orden lógico sin saltos arbitrarios;
- body y labels activos cumplen contraste y tamaño de lectura;
- placeholder nunca sustituye label;
- montos, códigos y fechas mantienen alineación y formato consistente;
- la jerarquía sobrevive móvil, impresión y ampliación de texto;
- una diferencia de fuente se acompaña con label, espacio, posición o peso.

## 4. Doble voz en documentos dirigidos al cliente

En facturas, estados de cuenta, recibos, estimados, correos y PDF:

| Contenido | Voz |
|---|---|
| Logo, nombre y datos corporativos de DTD Cargo | Marca |
| Etiquetas que DTD usa para presentar el documento, como “Fecha” | Marca |
| Valor que corresponde al cliente, como `21/07/2026` | ERP/dato |
| Nombre, saldo, dirección, embarque y transacción del cliente | ERP/dato |
| Código, referencia, monto y fecha tabular | Dato/mono cuando sea apropiado |
| Nota institucional o firma corporativa | Marca |
| Instrucción operativa para el destinatario | ERP |

Ejemplo conceptual:

```text
Fecha                 21/07/2026
voz de marca          voz ERP/dato
```

La distinción no altera el contenido legal ni reduce legibilidad. En clientes
de correo que no cargan webfonts, la estructura label/valor debe seguir siendo
comprensible mediante fallbacks seguros.

## 5. Chino simplificado

- Contenido de producto: `lang="zh-CN"` + `--f-cn-ui` / Noto Sans SC.
- Correspondencia formal: `lang="zh-CN"` + `--f-cn-document` / Noto Serif SC.
- Un documento bilingüe conserva bloques/idiomas identificables y no mezcla una
  fuente china en medio de una palabra latina.
- JetBrains Mono permanece para códigos latinos aunque el documento sea chino.
- PDF debe incrustar glifos usados y permitir selección/copy-paste correcto.
- Email declara fallbacks CJK; nunca depende de una descarga remota para ser legible.

## 6. Tokens objetivo

```css
--f-brand: Archivo, system-ui, sans-serif;
--f-brand-display: "Archivo Black", Archivo, sans-serif;
--f-erp: "Nunito Sans", system-ui, sans-serif;
--f-erp-display: Sora, "Nunito Sans", sans-serif;
--f-data: "JetBrains Mono", ui-monospace, monospace;
--f-cn-ui: "Noto Sans SC", sans-serif;
--f-cn-document: "Noto Serif SC", serif;
```

Los aliases actuales `--f-sans`, `--f-display`, `--f-mono` y `--f-cn` pueden
mantenerse durante migración. En Studio deben resolver a la voz ERP; en una
salida corporativa se selecciona explícitamente la voz de marca.

## 7. Estado comprobado

- `app/layout.tsx` carga Archivo, Archivo Black, Noto Sans SC y Noto Serif SC;
  esta última usa `display: "swap"` y `preload: false`.
- `app/studio/layout.tsx` carga Sora y Nunito Sans para `.studio-sys`.
- `app/globals.css` y `app/studio/tokens.css` separan `--f-cn-ui` y
  `--f-cn-document`; `--f-cn` conserva compatibilidad y resuelve a UI.
- las firmas de Mailing seleccionan voz y fallback por idioma;
- el packing list mantiene Noto Sans SC en pantalla y aplica Noto Serif SC sólo
  a sus bloques `zh-CN` durante impresión;
- otros correos y documentos continúan en adopción gradual por consumidor;
- existe evidencia local de PDF, impresión, extracción y firmas; faltan pruebas
  reales en Gmail, Outlook y Apple Mail.

## 8. Gates cerrados y siguientes

Cerrado por SDD-0175:

- carga no bloqueante de Noto Serif SC, fallbacks y aliases compatibles;
- firma formal de Mailing;
- packing list imprimible, glifos, peso y extracción de texto;
- revisión visual local de firma española, `zh-CN`, UI e impresión.

Siguiente por consumidor:

- inventariar y migrar sólo un correo/PDF/documento que contenga chino real;
- verificar español y `zh-CN` en Gmail, Outlook y Apple Mail con buzones
  controlados;
- validar que label/valor siga distinguiéndose sin webfonts;
- conservar BD-036 y `BRAND.md` sincronizados con la excepción documental.

Esta política documenta la decisión aprobada. No autoriza por sí sola cargar
fuentes ni cambiar documentos en producción; eso requiere SDD y pruebas.
