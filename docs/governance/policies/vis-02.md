# VIS-02 v1.0 — Jerarquía tipográfica por voz, destinatario e idioma

| Control | Valor |
|---|---|
| Código | VIS-02 |
| Versión | 1.0 |
| Dueño | Sam (founder) |
| Estado | aprobada — implementación parcial |
| Creado | 2026-07-21 |
| Depende de | [VIS-01](vis-01.md) y A11Y-01 |
| Fuente visual | [`BRAND.md`](../../../BRAND.md), BD-035 y Norte vigente |

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

- `app/layout.tsx` carga Archivo, Archivo Black y Noto Sans SC.
- `app/studio/layout.tsx` carga Sora y Nunito Sans para `.studio-sys`.
- `app/studio/tokens.css` expone `--f-cn`, pero no separa aún UI/documento.
- Noto Serif SC no está cargada en código.
- Varios correos y reportes HTML fijan Archivo/Arial de manera local; no existe
  un renderer transversal que aplique la doble voz.
- No hay evidencia completa de incrustación CJK en PDF ni pruebas Gmail,
  Outlook, Apple Mail, impresión y copy/paste.

## 8. Gate de implementación futura

- cargar Noto Serif SC sin bloquear render y definir fallbacks;
- crear tokens de voz y aliases compatibles;
- inventariar renderers de correo/PDF/factura/estado de cuenta;
- verificar español y `zh-CN` en Gmail, Outlook y Apple Mail;
- comprobar PDF impreso, glifos, peso, copy/paste y tamaño del archivo;
- validar que label/valor sigue distinguiéndose sin webfonts;
- actualizar `BRAND.md`/decisiones si la fuente de verdad todavía presenta una
  lista global que contradiga la excepción aprobada de Studio;
- ejecutar revisión visual antes de declarar implementación completa.

Esta política documenta la decisión aprobada. No autoriza por sí sola cargar
fuentes ni cambiar documentos en producción; eso requiere SDD y pruebas.
