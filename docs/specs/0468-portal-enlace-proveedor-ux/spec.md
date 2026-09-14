---
sdd: "0468"
title: "Portal: rediseño del enlace del proveedor (Factura + Packing List)"
status: in-progress
author: "Claude con Sam"
created: 2026-09-14
updated: 2026-09-14
supersedes: null
superseded_by: null
related: ["0057", "0096", "0097", "0173", "0443"]
confidencialidad: interno
---

# DTD-0468 — Enlace del proveedor: rediseño UX/UI

> El cliente copia un enlace para que su proveedor chino llene la Factura + Packing List. La sección estaba saturada y el proveedor recibía un enlace sin contexto en chino. Este SDD la deja con una sola acción, un mensaje en chino y un Excel que se calcula solo.

## Decisiones autorizadas

Encargo de Sam del 2026-09-14, en una sesión Worker separada:

- Una tarea, una rama (`codex/portal-enlace-proveedor-ux`) y un worktree propio. Se entrega por PR contra `main`, sin merge ni despliegue.
- Restricciones literales: sin colores ni elementos llamativos; copiar el enlace sin pasos adicionales; texto comprensible para proveedores chinos con bajo nivel de inglés; no alterar la lógica del formulario Factura + Packing List.
- Los insumos «mockup o captura del diseño actual» y «contenido del Excel actual» quedaron como `[FILL]` en el encargo. El diagnóstico se hizo sobre el código y el template publicados en `main` (`2b1d7d84`).

## 1. Diagnóstico del diseño actual

| # | Dónde | Qué pasa | Por qué confunde |
|---|---|---|---|
| 1.1 | `app/portal/_components/ShareProviderButton.tsx` | Dos botones grandes con el mismo peso («Copiar link del proveedor» en vino y «Enviar por WhatsApp» con borde), y debajo la URL completa en mono, partida en varias líneas. | Tres elementos compiten por la atención y ninguno manda. «Link del proveedor» se puede leer como «el link que me dio el proveedor». |
| 1.2 | Mismo archivo, texto de WhatsApp | Una sola oración en chino con cuatro acciones (llenar装箱单及发票, en línea o Excel, imprimir etiquetas, pegar una por caja) y otra igual en español. La URL queda pegada al final. | El proveedor tiene que desarmar la oración para saber qué hacer y en qué orden. |
| 1.3 | Mismo archivo, `copy()` | «Copiar» copia solo la URL. | El proveedor está en WeChat (en China continental WhatsApp no funciona sin VPN). Recibe un enlace suelto, sin una palabra en chino que diga para qué es. |
| 1.4 | `app/portal/(app)/compras/nueva/PurchaseStepConfirm.tsx` | Paso 3 del asistente: una lista «Tus pasos» (2 pasos y un sub-listado a/b), otra lista «Tu proveedor · sus confirmaciones» (3 pasos), vista previa plegable y dos CTA. | Siete líneas de instrucciones que dicen lo mismo desde dos puntos de vista. Los números en vino compiten con el botón principal. |
| 1.5 | `compras/nueva/NewPurchaseForm.tsx`, `compras/[code]/etiquetas/page.tsx` | Tres contenedores con tres explicaciones distintas, y todas dicen «trae la dirección de la bodega y las etiquetas». | La tarea principal del proveedor, llenar la factura y el packing list, no aparece. |
| 1.6 | `app/p/[token]/page.tsx` | La pestaña de la página del proveedor se titula «Para tu proveedor · DTD Cargo». | Le habla al cliente desde la pantalla que ve el proveedor, y en español. |
| 1.7 | `public/templates/dtd-packing-list-invoice.xlsx` (`scripts/build-packlist-template.mjs`) | Las columnas «computadas» (总数量, 总金额, 总重量, 总体积) tienen fondo de color pero están vacías: hay que multiplicar a mano. Tiene 7 notas largas con el español primero, una tarjeta «Shipping Mark» con `DTD-____` y un eslogan comercial en el encabezado. | El color insinúa «automático» y no lo es. Las notas repiten el propio documento. Los guiones invitan a escribir encima de un 唛头 que ya viene pre-llenado en C6. |

## 2. Nueva disposición visual

### 2.1 Componente del enlace — escritorio

**Antes**

```
Compartir con tu proveedor
Mándale este link a tu proveedor: trae la dirección de la bodega y
estas etiquetas para que las baje él directo, sin que tengas que
descargar ni reenviar nada.

[ Copiar link del proveedor ]   [ ◎ Enviar por WhatsApp ]
https://dtdcargo.com/p/8f3kq2m9x7c4v1b6n5z0a8s2d4f6g8h1
```

**Después**

```
Enlace para tu proveedor
Pégalo en el chat con tu proveedor. Ahí llena la factura y el
packing list, e imprime estas etiquetas.

┌────────────────────────────────────────────┐ ┌─────────────────┐
│ https://dtdcargo.com/p/8f3kq2m9x7c4v1b…    │ │  Copiar enlace  │
└────────────────────────────────────────────┘ └─────────────────┘
  campo de solo lectura: gris, mono, una línea    ÚNICO botón (vino)

Tu proveedor lo abre sin cuenta, en chino y español.
Copiar con mensaje en chino        ◎ Enviar por WhatsApp
└──── texto subrayado, sin relleno ni borde de botón ────┘
```

### 2.2 Componente del enlace — teléfono (< 640 px)

```
┌───────────────────────────────┐
│ https://dtdcargo.com/p/8f3…   │
└───────────────────────────────┘
┌───────────────────────────────┐
│         Copiar enlace         │   ← ancho completo, 48 px de alto
└───────────────────────────────┘
Tu proveedor lo abre sin cuenta,
en chino y español.
Copiar con mensaje en chino
◎ Enviar por WhatsApp
```

### 2.3 Estados

| Estado | Campo | Botón principal | Texto de apoyo |
|---|---|---|---|
| Preparando (SSR, sin `origin`) | «Preparando enlace…» | deshabilitado | acciones secundarias deshabilitadas |
| Listo | URL completa (recortada con «…») | «Copiar enlace» | — |
| Copiado | igual | «Enlace copiado ✓» por 2 s | anuncio `aria-live`: «Enlace copiado» |
| Mensaje copiado | igual | igual | «Mensaje copiado ✓» en la acción secundaria |
| Portapapeles bloqueado (enlace) | la URL queda **seleccionada** | vuelve a «Copiar enlace» | visible: «No se pudo copiar. El enlace quedó seleccionado: cópialo con Ctrl+C o mantén presionado.» |
| Portapapeles bloqueado (mensaje) | la URL queda **seleccionada** | igual | visible: «No se pudo copiar el mensaje. El enlace quedó seleccionado: cópialo con Ctrl+C o mantén presionado; la página ya está en chino.» — no finge que el mensaje se copió |

Detalles de interacción: el campo y el botón miden 48 px de alto; las dos acciones de texto tienen 44 px de área táctil (`min-h-11`) sin agrandar la letra; el campo y las acciones de texto usan el mismo anillo de foco de 3 px que `.btn`.

### 2.4 Paso 3 del asistente de compra

**Antes**

```
[▤] Que tu proveedor lo confirme
Así tu proveedor te envía la mercancía bien identificada, sin retrasos.

TUS PASOS · SEGUIMIENTO CON TU PROVEEDOR
 ❶ Cópiale el link y envíaselo por chat a tu proveedor.
    [ Copiar link del proveedor ] [ ◎ Enviar por WhatsApp ]
    https://…
 ❷ Hazle seguimiento para asegurarte de que cumpla con lo siguiente:
    a. Que llene el formulario del link.
    b. Que le ponga a cada caja la etiqueta con tu código.

TU PROVEEDOR · SUS CONFIRMACIONES
 ① Abre el link y llena los datos.
 ② Sube su factura final, su packing list final y las fotos del producto terminado.
 ③ Nos envía el producto.
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
ASÍ SE VE LO QUE RECIBE TU PROVEEDOR                    Ver ejemplo
[ Ver mis etiquetas → ]
```

**Después**

```
[▤] Envíale el enlace a tu proveedor
Pégalo en el chat con tu proveedor. Así tu mercancía llega
bien identificada, sin retrasos.

┌──────────────────────────────────┐ ┌───────────────┐
│ https://dtdcargo.com/p/8f3kq…    │ │ Copiar enlace │
└──────────────────────────────────┘ └───────────────┘
Tu proveedor lo abre sin cuenta, en chino y español.
Copiar con mensaje en chino      ◎ Enviar por WhatsApp

LO QUE HARÁ TU PROVEEDOR
 ① Llena la factura y el packing list, y sube fotos del producto.
 ② Pega una etiqueta en cada caja.
 ③ Envía la mercancía a nuestro almacén en China.
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
ASÍ SE VE LO QUE RECIBE TU PROVEEDOR                    Ver ejemplo
[ Ver mis etiquetas → ]
```

Los números quedan neutros (gris con borde), ya no en vino: el único acento de la tarjeta es «Copiar enlace».

### 2.5 Excel del proveedor (A4 horizontal, una página)

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ 义乌市林冠进出口有限公司 · DTD Cargo                               装箱单 + 商业发票 │
│ 电话 0579-8543 1781 · +86 186 0689 1419 · candywu@…           Packing List + Factura │
│ 仓库地址 义乌市义乌港二期直通仓… · Dirección del almacén          编号 · N.º  [I3]  │
├───────────────────────────────────────┬────────────────────────────────────────────┤
│ 公司名称 · Empresa     [C5 pre-llenado] │ 邮箱 · Email                               │
│ 唛头 · Shipping Mark   [C6 pre-llenado] │ 电话 · Teléfono                            │
│ 订单 · Compra          [C7 pre-llenado] │ 地址 / 城市 · Dirección / Ciudad            │
│ 微信 · WeChat          [C8 pre-llenado] │ 日期 · Fecha                               │
├───────────────────────────────────────┴────────────────────────────────────────────┤
│ 货物明细 · Detalle de mercancía   只填白色格子，带底色的列自动计算。 Llena las blancas… │
│ 品牌│货号│中文品名│英文品名│材质/HS│箱号│件数│每箱装量│▒总数量▒│单价│▒总金额▒│每箱重│▒总重量▒│每箱体积│▒总体积▒│
│ …16 filas; ▒ = fórmula por fila, fondo vino muy claro, también en el encabezado…    │
│ 总计 · Totales                        Σ cajas     Σ uds       Σ total   Σ kg    Σ CBM │
│ 货币 · Moneda  [USD ▾]                                                                │
│ 入仓注意事项 · Reglas para enviar al almacén                                          │
│ 1. 每个箱子都要写上方的唛头，没有唛头会延误出口。  Escribe el Shipping Mark de arriba… │
│ 2. 品牌货请填写真实品牌；没有品牌填“无”。  Si es de marca, declara la marca real…     │
│ 3. 禁止危险品和违禁品入仓。  No se aceptan mercancías peligrosas ni restringidas.     │
│ 4. 卸货由供应商安排并付费；仓库代卸按体积或重量收费。  La descarga la paga…          │
│ 5. 有疑问请联系：吴小姐 18606891419 · 微信 DTDLogistic  Dudas: Srta. Wu.              │
│ 供应商签字 / 盖章 ______________            日期 ______________                       │
└────────────────────────────────────────────────────────────────────────────────────┘
```

## 3. Textos sugeridos (español y chino simplificado)

El portal lo usa el cliente venezolano, así que en pantalla va **solo en español**: poner el chino al lado duplicaría el ruido que se quiere quitar. La columna 中文 es el equivalente para las superficies que ve el proveedor (mensaje, página `/p/…`, Excel) y la referencia si un día el portal se traduce.

| Elemento | Español (portal del cliente) | 中文 (equivalente) | Implementado en |
|---|---|---|---|
| Título de la sección | Enlace para tu proveedor | 供应商链接 | etiquetas, formulario largo |
| Título en el asistente | Envíale el enlace a tu proveedor | 把链接发给供应商 | paso 3 |
| Botón principal | Copiar enlace | 复制链接 | componente |
| Confirmación | Enlace copiado | 已复制链接 | componente |
| Acción secundaria | Copiar con mensaje en chino | 复制中文消息和链接 | componente |
| Confirmación | Mensaje copiado | 已复制消息 | componente |
| Acción secundaria | Enviar por WhatsApp | 通过 WhatsApp 发送 | componente |
| Ayuda | Tu proveedor lo abre sin cuenta, en chino y español. | 无需注册，页面有中文和西班牙文。 | componente |
| Campo vacío | Preparando enlace… | 正在生成链接… | componente |
| Fallo al copiar el enlace | No se pudo copiar. El enlace quedó seleccionado: cópialo con Ctrl+C o mantén presionado. | 复制失败。链接已选中，请按 Ctrl+C 或长按复制。 | componente |
| Fallo al copiar el mensaje | No se pudo copiar el mensaje. El enlace quedó seleccionado: cópialo con Ctrl+C o mantén presionado; la página ya está en chino. | 消息复制失败。链接已选中，请按 Ctrl+C 或长按复制；页面本身有中文。 | componente |
| Lista del asistente | Lo que hará tu proveedor | 供应商需要做的事 | paso 3 |
| Pestaña de `/p/…` | Información para el proveedor | 供应商资料 | `app/p/[token]/page.tsx` |
| Excel, cómo se llena | Llena las celdas blancas; las de color se calculan solas. | 只填白色格子，带底色的列自动计算。 | Excel, fila 10 |

**Glosario fijo.** Se usa siempre la misma palabra, la que ya usa un exportador de Yiwu, y nunca un sinónimo:

| Concepto | 中文 | Español en la interfaz |
|---|---|---|
| Enlace | 链接 | enlace (no «link») |
| Packing list | 装箱单 | packing list |
| Factura | 发票 | factura |
| Etiqueta de caja | 标签 | etiqueta |
| Shipping Mark | 唛头 | Shipping Mark |
| Almacén | 仓库 | almacén |
| Llenar en línea | 在线填写 | llenar en línea |
| Copiar | 复制 | copiar |

## 4. Mensaje que recibe el proveedor

Lo arma `lib/portal/provider-link-message.ts`. Es el mismo texto para «Copiar con mensaje en chino» y para WhatsApp:

```
您好！请打开 DTD Cargo 链接，完成 3 步：
1. 在线填写装箱单和发票（也可以用 Excel）
2. 打印标签，每个箱子贴一张
3. 按页面上的地址，把货送到仓库
链接：https://dtdcargo.com/p/…

Hola. Abre el enlace de DTD Cargo y completa 3 pasos:
1. Llena el packing list y la factura (en línea o en Excel)
2. Imprime las etiquetas y pega una en cada caja
3. Envía la mercancía al almacén que indica la página
```

- **Chino primero.** Es el idioma de quien actúa. El español queda debajo para que el cliente sepa qué mandó.
- **Una acción por línea, numerada.** Antes eran cuatro acciones en una sola oración.
- **El enlace va en su propia línea, después del bloque en chino.** WeChat y WhatsApp lo vuelven tocable y no hay que buscarlo al final.
- **Cero inglés en el bloque chino,** salvo la marca y «Excel», que WPS y Office muestran igual en China. Hay una prueba que lo verifica.
- **Sin identidad del cliente.** La función solo recibe la URL (SDD-0443).

## 5. Excel reformulado

| Cambio | Antes | Después | Por qué |
|---|---|---|---|
| Columnas automáticas | Fondo de color, celdas vacías | Fórmula por fila con la regla de `computeTotals`: 总数量 = 件数×每箱装量 · 总金额 = 总数量×单价 · 总重量 = 件数×每箱重 · 总体积 = 件数×每箱体积. Vacía mientras falte un dato. | El color ya significa lo que parece. Se elimina la multiplicación manual, que era la causa principal de errores. |
| Encabezado de esas columnas | Gris, como las demás | Mismo fondo vino claro que su columna | Se entiende que la columna entera no se escribe. |
| Cómo se llena | No se decía | Fila 10: «只填白色格子，带底色的列自动计算。» | Una sola instrucción, en chino, justo encima de la tabla. |
| Recalculado | — | `fullCalcOnLoad` activo | Excel y WPS calculan al abrir. |
| Notas | 7, largas, español primero | 5, cortas, chino primero | Se quitan las que repetían el propio documento («llena este documento», «formulario o Excel»). |
| Tarjeta Shipping Mark | `MARK DTD-____`, `ITEM NO ____`… | Eliminada | Duplicaba C6 y los guiones invitaban a escribir encima. |
| Encabezado | «Importación puerta a puerta 中国 → 委内瑞拉» | «仓库地址 … · Dirección del almacén» | El eslogan comercial no le sirve al proveedor. |
| Rótulos | «N.º / 编号 · Folio», «Email proveedor», «Tel. proveedor» | «编号 · N.º», «Email», «Teléfono» | Chino primero y sin palabras de más. |

**No cambia:** las celdas de pre-llenado `C5`, `C6`, `C7`, `C8` e `I3` (`lib/studio/prealertas/packlist.ts · fillPacklist`), las 16 filas de mercancía, las fórmulas de totales, la validación de moneda, las firmas y la impresión en una página. El Excel subido no se parsea por posición: se guarda como documento. Por eso la reformulación no toca ninguna lógica de recepción.

## 6. Justificación: claridad y usabilidad

1. **Una acción principal por pantalla.** El componente pasa de 2 botones `.btn` a 1. Con menos opciones del mismo peso, la decisión es inmediata. El campo + botón «Copiar» es el patrón que el cliente ya conoce de cualquier diálogo para compartir.
2. **El enlace sigue a un clic.** «Copiar enlace» copia exactamente la URL, como antes (hay una prueba que lo verifica). Las alternativas se ofrecen, pero no se interponen.
3. **Se resuelve el hueco real del proveedor.** Con «Copiar con mensaje en chino», lo que llega a WeChat se explica solo, en su idioma y en tres pasos.
4. **Menos texto que leer.** El paso 3 baja de 7 líneas de instrucciones en dos listas a 3 en una. Las explicaciones de los tres contenedores quedan en una o dos frases y nombran la tarea principal (factura + packing list).
5. **Mismo vocabulario en todas partes.** «Enlace» en vez de «link»; 装箱单 / 发票 / 标签 / 唛头 / 仓库 son los términos de comercio exterior del proveedor.
6. **Sin acentos nuevos.** Solo tokens `var(--*)`. Las acciones secundarias son texto `ink` subrayado y los números de la lista pasan a neutro. No hay colores nuevos, iconos decorativos ni animaciones.
7. **Accesible y robusto.** El campo tiene `label` (sr-only), las confirmaciones se anuncian con `aria-live`, el foco es visible (el mismo anillo de 3 px de `.btn`), el botón mide 48 px y las acciones de texto tienen 44 px de área táctil. Si el navegador bloquea el portapapeles, el enlace queda seleccionado y se dice qué hacer; antes el fallo era silencioso.
8. **El Excel hace el trabajo.** Las fórmulas eliminan la aritmética manual, y el color deja de mentir.

## 7. Alcance y cumplimiento

**Allowlist exacta del cambio:**

- `app/portal/_components/ShareProviderButton.tsx` · `ShareProviderButton.test.tsx`
- `lib/portal/provider-link-message.ts` · `lib/portal/__tests__/provider-link-message.test.ts`
- `app/portal/(app)/compras/nueva/PurchaseStepConfirm.tsx` · `NewPurchaseForm.tsx` (solo textos)
- `app/portal/(app)/compras/[code]/etiquetas/page.tsx` (solo textos)
- `app/p/[token]/page.tsx` (solo `metadata.title`)
- `scripts/build-packlist-template.mjs` · `public/templates/dtd-packing-list-invoice.xlsx` · `lib/studio/prealertas/__tests__/packlist.test.ts`
- `docs/specs/0468-portal-enlace-proveedor-ux/spec.md` · índice generado · handoff

| Regla | Clasificación | Evidencia |
|---|---|---|
| Sin colores ni elementos llamativos | cumplimiento | Solo tokens existentes; 1 acento (botón principal); números neutros. |
| Copiar el enlace sin pasos adicionales | cumplimiento | Prueba «copia solo la URL, en un clic» (`ShareProviderButton.test.tsx`). |
| Comprensible con bajo inglés | cumplimiento | Prueba «el bloque en chino no pide leer inglés» (`provider-link-message.test.ts`). |
| No alterar la lógica del formulario | cumplimiento | Sin cambios en `app/p/[token]/PackingListFormSection.tsx`, `packlist/route.ts`, `packlist-form.ts` ni en el payload; pruebas de `app/p/[token]` en verde. |
| Privacidad SDD-0443 (sin identidad del cliente) | cumplimiento | El mensaje solo recibe la URL; prueba dedicada. |
| `revisar-datos-ve` | no aplica | No se capturan, mueven ni borran datos personales. |
| Gobernanza Studio (`AGENT-BRIEF`) | no aplica | Portal y página pública del proveedor, no Studio. |
| DB / migraciones / producción | no aplica | Sin SQL. |

**Fuera de alcance (fase siguiente, si Sam lo pide):**

- La página `/p/[token]`: encabezado, orden de secciones y las reglas de almacén dentro del formulario. Es la otra mitad de «que el proveedor entienda», pero toca el flujo del formulario.
- Marca blanca (aliados) en el mensaje: hoy dice «DTD Cargo» fijo, igual que el texto anterior.
- Traducir el portal del cliente al chino.

## 8. Criterios de aceptación

- [x] El componente muestra una sola acción principal; las alternativas son texto.
- [x] «Copiar enlace» copia solo la URL, en un clic.
- [x] El mensaje al proveedor va en chino primero, en 3 pasos numerados, con el enlace en su propia línea y sin identidad del cliente.
- [x] Los tres contenedores usan la misma explicación corta y nombran la factura y el packing list.
- [x] El paso 3 del asistente queda con una acción y una lista de 3 pasos.
- [x] El Excel calcula solo las columnas de color, tiene 5 notas en chino primero y conserva las 5 celdas de pre-llenado.
- [x] Se incluyen textos en español y chino simplificado (§3, §4, §5).
- [x] La lógica del formulario del proveedor no cambia.
- [ ] Revisión visual en el portal con sesión real (tema oscuro y claro, 375 px y escritorio) y apertura del Excel en Excel o WPS. Queda para Sam: el worktree no tiene credenciales de Supabase y no se copian secretos.

## 9. Verificación

Registro de pruebas en el handoff `.agents/handoffs/portal-enlace-proveedor-ux.md`: pruebas unitarias y de componente, control rojo contra el componente original, inspección del XML del `.xlsx` y `pnpm verify`.
