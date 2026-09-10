---
sdd: "0154"
title: "Recibir por escaneo · la etiqueta pre-declarada materializa la recepción en Yiwu"
status: in-progress
author: "founder"
created: 2026-07-17
updated: 2026-09-10
supersedes: null
superseded_by: null
related: ["0153", "0152", "0027", "0045", "0105", "0067"]
confidencialidad: interno
---

# DTD-0154 — Recibir por escaneo

## 1. Resumen en una línea

El operario en Yiwu **escanea una etiqueta pre-declarada** (SDD-0153) → el sistema dice de
quién es y cuántas cajas se anunciaron → **confirma, rectificando la cantidad** → recibe.
En un escaneo, no en los 4 pasos tipeados de `/m/cn/nueva`.

## 2. El flujo (founder, 17-jul)

> "Cuando en Yiwu reciben la mercancía con la etiqueta: escanean la etiqueta y
> automáticamente reciben el producto. Ponen 'sí, recibir', rectifican si las cantidades
> están bien y avanzan. Automáticamente le llega una alerta al cliente y a nosotros de que
> se recibió mercancía de ese cliente."

Recepción **por compra**, no caja por caja: escanear UNA etiqueta identifica la prealerta
entera y recibe sus N cajas, con la cantidad rectificable (llegaron más / menos de las
anunciadas).

```
escanea DTD-B ─► lookup (solo lectura): "es de <cliente>, compra <code>, N cajas"
                     │
                     ▼  ¿recibir? · rectifica N
              receive_prealerta_as_operario (0245)
                     │  crea WR-YYYY-NNNN · adopta N esperadas → recibidas
                     ▼
              prealerta → 'recibida' si se completó · evento 'received' en el historial
```

## 3. Decisiones de diseño

| Decisión | Por qué |
|---|---|
| La adopción es **explícita en el RPC**, no en el trigger del receipt | El reviewer adversarial de SDD-0153 mostró que una adopción DENTRO de `sync_boxes_for_receipt` nunca correría: `create_receipt_as_operario` (0045) no pasa `prealerta_id` al insert. La ruta de escaneo la esquiva: adoptar es un acto del operario. **`sync_boxes_for_receipt` no se toca → cero drift.** |
| El receipt se inserta con `boxes=0`, se adopta a mano, luego `boxes=N` | Insertar con el conteo final dispararía el trigger a crear cajas nuevas (segundo juego de codes). Con `boxes=0` el trigger es no-op; tras adoptar, subir a N deja `v_have == boxes` → no-op otra vez. |
| Lookup **separado** (solo lectura) del recibir | El founder quiere ver "¿es de tal cliente, recibir?" ANTES de escribir. El lookup no muta; el confirm sí. |
| Recibir **más** de lo anunciado crea las extras | Si llegaron 10 y se anunciaron 8, el trigger crea 2 recibidas nuevas. Rectificar hacia arriba está soportado. |
| Recibir **menos** deja el resto `esperada` | Llegaron 5 de 8 → se adoptan 5, las otras 3 siguen esperando y se reciben en el próximo envío escaneando. Es el "lote partido" del founder, del lado de la recepción. |
| Requiere la etiqueta **DTD-B** (no la del proveedor `?c=`) | La del proveedor identifica al cliente, no a la caja. Escanearla muestra el mismo aviso que en estiba. |
| Toda espera termina aunque una Server Action rechace | El lookup libera `busy` en `finally`. Si el lookup o la recepción rechazan por red, excepción no manejada o respuesta de Next, la pantalla muestra un error bilingüe y vuelve o permanece en el escáner; una pantalla dedicada no puede depender de cerrar y reabrir. |
| `PGRST202` es permanente desde la perspectiva del operario | Significa que PostgREST no encuentra la RPC: repetir la misma recepción no puede reparar el contrato servidor/base. El copy manda a avisar al responsable y explícitamente no a reintentar. |

### 3.1 Taxonomía de errores de recepción · 2026-09-10

- Los nueve códigos reales ya emitidos por las validaciones de operario y la RPC
  conservan mensajes de negocio específicos: `P0001`, `P0002`, `P0003`, `P0130`,
  `P0131`, `P0132`, `P0133`, `P0134` y `P0135`.
- Sólo `PGRST202` se agrega como señal permanente de infraestructura conocida. Se
  reconoce por el campo `code` de PostgREST (con compatibilidad para mensajes que
  incluyan el código) y no se inventa un catálogo `P0136`/`P0137` que la base no emite.
- Los demás fallos quedan como temporales o no determinados y ofrecen un reintento
  desde la UI. Los rechazos de transporte de la acción se capturan en el cliente y
  liberan la espera antes de ofrecer el siguiente intento.
- El mensaje permanente y los mensajes nuevos de recuperación tienen copy explícito
  español/chino mediante `t(lang, …)`; nunca se muestra al operario el error crudo,
  SQL, rutas internas ni detalles de la RPC.

## 4. Scope

### Incluye
- **RPC `receive_prealerta_as_operario(p_operario_id, p_code, p_boxes_confirmed)`**
  (`0245`, SECURITY DEFINER + service_role) — errcodes P0130–P0135.
- **`/m/cn/recibir`** — pantalla del operario: escanear → tarjeta de confirmación con
  cliente + compra + cantidad rectificable → recibir → resumen. Reusa `QrScanner` +
  `ActionButton`. Bilingüe ES/中文. Incluye recuperación de rechazos de ambas Server
  Actions y diferencia entre fallo transitorio y bloqueo permanente de la RPC.
- **Entrada en el home** del operario (`/m/cn`), arriba de "Estibar".

### Fuera de scope (pendiente honesto)
- **La alerta al cliente y al equipo.** El founder la pide; hoy el push de estado al
  cliente **no existe** (gap conocido China→VE). El RPC deja el registro durable
  (`warehouse_receipt_events` = 'received') y marca la prealerta 'recibida'; el aviso
  push/mail se conecta en un slice aparte, no se finge acá.
- **Escanear la etiqueta del proveedor (solo cliente) para recibir.** Si no hay DTD-B, hoy
  se cae a `/m/cn/nueva` (los 4 pasos). Resolver por markbox + elegir compra es otro slice.
- **El caso "apareció sin aviso"** (sin prealerta): sigue por `/m/cn/nueva` → huérfana +
  alerta, como hoy. No lo toca esta spec.

## 5. Verificación

1. `node scripts/verify.mjs` verde (con `migrations-applied` una vez aplicada 0245).
2. Columnas y casts verificados contra el esquema real de prod (no se pudo dry-run con
   escritura: el MCP local es read-only y el de escritura hace commit; los branches
   efímeros mueren en el seed).
3. Aplicar `0245` a prod **con OK del founder nombrándola**, de a una.
4. Prueba con **carga real** (estrategia del founder) — sin datos de prueba en prod.
5. Vitest focal de `RecibirClient`: el rechazo del lookup libera `busy`; el rechazo
   de recibir vuelve al escáner; `PGRST202` se muestra en chino sin invitar a reintentar.
6. Vitest focal de la Server Action: `PGRST202` se clasifica permanente, un fallo no
   catalogado conserva tratamiento transitorio y `P0134` se reconoce por `error.code`.
