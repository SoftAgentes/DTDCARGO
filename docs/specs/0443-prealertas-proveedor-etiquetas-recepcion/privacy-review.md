# Revisión técnica de privacidad · SDD-0443

Alcance: diff de proveedor, etiquetas, recepción CN y presentación administrativa.
Se aplica la guía local `revisar-datos-ve` como revisión advisory. No se leyeron filas
personales de producción y no se afirma cumplimiento normativo.

| Dato | Finalidad en el código | Retención | Acceso |
|---|---|---|---|
| Shipping Mark / códigos de compra y caja | Asociar documento, etiqueta y recepción | Ciclo operativo existente, sin borrado nuevo | Proveedor con enlace de compra; cliente propio; operario de su tenant |
| Nombre/email/WeChat/dirección de proveedor | Formato de factura y contacto operativo existente | Versiones del documento y borrador local | Proveedor, equipo autorizado; la retención legal no se evaluó en este diff |
| Nombre/teléfono/email del cliente en borrador antiguo | Sin finalidad necesaria para etiquetas | Se eliminan del borrador y snapshots al abrir esta compra | Ya no se restauran ni se ofrecen campos de captura |
| `shipping_label_versions.created_by`, `created_at` | Autoría y trazabilidad del cambio administrativo | Historial append-only; plazo no definido aquí | Usuarios ERP del mismo tenant mediante RLS; nunca se envía esta fila al proveedor |
| `warehouse_receipts_cn.created_by_operario_id` | Autoría de recepción existente | Retención operativa existente | Equipo autorizado; el QR público no lo devuelve |

La base jurídica de tratamiento y los plazos documentales quedan **NO VERIFICABLES**
en esta revisión de implementación: no se reinterpretan ni amplían políticas legales.

## Doce puntos de la guía

1. **CORRECTO (alcance del diff):** inventario anterior identifica los datos tratados;
   `queries.ts:303` excluye texto libre del cliente y `queries.ts:306` no entrega su nombre.
2. **CORRECTO:** minimización en etiqueta, Excel y formulario; el saneador
   `lib/studio/prealertas/packlist-draft.ts:16` elimina campos personales antiguos.
3. **NO VERIFICABLE:** no se auditaron evidencias de consentimiento existentes.
   Este cambio no introduce un checkbox ni afirma que imprimir sea aceptar un contrato.
4. **NO VERIFICABLE:** no se auditaron vías de ejercicio de derechos fuera del diff.
5. **ENCONTRADO:** el nuevo historial administrativo es append-only sin plazo de
   eliminación establecido. No se promete borrar historial al cerrar una compra.
6. **CORRECTO (trazabilidad administrativa):** la migración `0449` registra autor,
   fecha y versión, y rechaza sobrescritura de una versión obsoleta. La trazabilidad
   de solicitudes de derechos no fue evaluada.
7. **NO VERIFICABLE:** no se modifica ni se certifica la política pública de tratamiento.
8. **CORRECTO (diff):** no se añade un tercero ni un bucket. La generación del XLSX
   reutiliza la plantilla de la aplicación; las pruebas usan datos ficticios.
9. **NO VERIFICABLE:** no se evalúan contratos de transferencia. Se conserva el uso
   operativo China–Venezuela con menos información del cliente en el proveedor.
10. **CORRECTO (diff):** no se automatiza una decisión sobre personas. La recepción
    exige confirmar códigos concretos y conserva quién la realizó.
11. **CORRECTO (copy):** los botones dicen guardar, enviar e imprimir; no se presentan
    como firma autógrafa, consentimiento nuevo o aceptación contractual.
12. **ENCONTRADO (preexistente):** el contacto del proveedor puede no tener cuenta.
    Se conserva su captura operativa; no se afirma haber verificado su información
    previa sobre tratamiento o su base jurídica.

La protección del enlace continúa basada en su token privado y revocación. El QR
de caja no es una credencial de escritura: para recibir exige sesión CN y validación
de tenant en servidor y en SQL. No se incluye el token del proveedor en el QR.
