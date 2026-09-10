# Bloque documento-entidad (0435–0444) aplicado a producción — 2026-09-10

Tarea: aplicar las diez migraciones de RBAC documental por entidad. Autorización nominal de
Sam («aplica las diez del bloque documento-entidad»), conforme a
`docs/runbooks/aplicar-migraciones-prod.md`.

## Resultado

**LAS DIEZ APLICADAS.** Ledger de prod: 415 → **425**. Las diez con su basename exacto.
**De a una, nunca en bundle**, como manda el runbook: cada una con su preflight, su
verificación y la siguiente sólo después.

| # | migración | SDD |
|---|---|---|
| 1 | `0435_invoice_document_entity_rbac` | 0403 |
| 2 | `0436_treasury_document_entity_rbac` | 0404 |
| 3 | `0437_accounting_document_entity_rbac` | 0405 |
| 4 | `0438_expense_document_entity_rbac` | 0406 |
| 5 | `0439_shipment_document_entity_rbac` | 0407 |
| 6 | `0440_client_document_entity_rbac` | 0408 |
| 7 | `0441_supplier_document_entity_rbac` | 0409 |
| 8 | `0442_naviera_document_entity_rbac` | 0410 |
| 9 | `0443_bitacora_document_entity_rbac` | 0411 |
| 10 | `0444_unlinked_document_entity_rbac` | 0412 |

## Medición previa: el momento era el correcto

| | antes de aplicar |
|---|---|
| **filas en `documents`** | **0** |
| filas en `shipment_documents` | 0 |
| roles del equipo | `admin=4 · accounting=2 · marketing=1 · warehouse=1` |
| usuarios con rol `commercial` | **ninguno** |

El Hub de Documentos **no está en uso todavía**. Apretar el acceso no le quitó nada a nadie:
se cerró antes de que la tabla se llenara, que es exactamente cuando conviene hacerlo. El rol
`commercial`, que según la spec de 0403 perdería la lectura de facturas, **no existe en el
equipo**.

## Lo que quedó instalado

- **Un único punto de decisión**, `document_entity_authorized(text,uuid,text)`, consumido por
  filas, Storage, reservas de subida, solicitudes de restauración y guards de RPC
  `SECURITY DEFINER`.
- **Un mapa interno**, `document_entity_module_contract(text)`, **sin `EXECUTE` para ningún rol
  de API** — comprobado tras aplicar: `authenticated`, `service_role` y `anon` no lo pueden
  ejecutar. La única interfaz es el autorizador.
- Separación **lectura / inserción / actualización** en `documents` y en `shipment_documents`
  (la policy `ALL` original ya no existe), sin crear DELETE: el candado físico de 0394 sigue
  vigente y 0438 lo verifica en su postflight.
- Los doce tipos documentales mapeados, y con 0444 el fallback pasa de `else true` a
  **`else false`**: cualquier tipo desconocido **falla cerrado**.

## Integridad de la transcripción

1.895 líneas por el conector, transcritas a mano. Se calcularon md5 de cada cuerpo de función
**desde el archivo antes de aplicar** y se compararon después. Todos coincidieron:

- 0435: **4 de 4** · 0436, 0437: helper · 0438: **5 de 5** · 0439: autorizador
- 0440-0443: verificados por sus propios postflight · 0444: contrato y autorizador finales

## Verificación posterior

| comprobación | resultado |
|---|---|
| las diez en el ledger | **10 de 10**, basename exacto |
| ledger | 415 → **425** |
| mapa interno expuesto a rol de API | **no** |
| policies separadas en `documents` | 3 (read/insert/update), la `ALL` eliminada |
| policies separadas en `shipment_documents` | 4, y **la lectura Portal de 0416 sobrevivió** |
| filas de negocio | 0 documentos · 571 clientes · 19 envíos — **sin cambio** |

La 0439 dependía de la policy endurecida por **0416**, aplicada minutos antes; su postflight
comprueba explícitamente que esa lectura Portal no se pierda, y no se perdió.

## Este cambio

Saca las diez de `pendingBelowCutoff`. Pendientes declarados: **11 → 1**.
**El `cutoff` no se toca**, sigue en 238.

## PENDIENTES DE ESTA TAREA

Ninguno de aplicación.

## FUERA DE ALCANCE DETECTADO

- Queda **una sola** migración declarada pendiente: `0017_no_olvidar`, bloqueada desde julio
  por un review criptográfico externo. **No es nuestra.**
