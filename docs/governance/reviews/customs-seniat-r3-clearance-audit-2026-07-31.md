# REV-SGE-037 · Auditoría R3 de liberación en Aduana SENIAT

| Control | Valor |
|---|---|
| Fecha | 2026-07-31 |
| Fuente normativa | LB-SGE-104 / REV-SGE-029 |
| Acción | Marcar trámite liberado |
| Método | Read-only, una acción R3 |
| Mutaciones | Ninguna |

## Selección y recorrido

La liberación aduanera afirma que documentos, pagos y firmas habilitan la salida
de la carga y mueve el embarque a `arrived_destination`. Es una decisión R3 con
efecto operativo, financiero y probatorio.

1. El Drawer habilita “Marcar liberado” cuando su snapshot local no muestra
   documentos obligatorios pendientes y ejecuta la action con un clic
   (`app/studio/(app)/seniat/_components/FilingDetailDrawer.tsx:89-120,639-672`).
2. La action vuelve a leer documentos, consulta el filing, cambia el filing,
   intenta cambiar el shipment e intenta insertar un evento
   (`app/studio/(app)/seniat/actions.ts:239-308`).
3. Las tres escrituras no comparten transacción y las dos últimas no verifican
   el error (`app/studio/(app)/seniat/actions.ts:283-303`).
4. `changeFilingStatusAction` admite `liberado` mediante `UPDATE` genérico sin
   documentos, sync ni evento (`app/studio/(app)/seniat/actions.ts:315-352`).
5. Grants y RLS permiten `UPDATE` autenticado por tenant, sin rol ni máquina de
   estados en DB (`supabase/migrations/0010_customs_seniat.sql:170-202`).

## Matriz de políticas

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 | no conformidad | Éxito visible no prueba que filing, shipment y evento convergieron. |
| MP-01 | no conformidad | Rol sólo en action; DB permite bypass por tenant. |
| BTN-01 | cumplimiento | Pending deshabilita el botón. |
| HTD-01 | no conformidad | Un clic, sin `ConfirmDialog`, consecuencia ni motivo. |
| AUD-01 | no conformidad | Evento best-effort, sin actor/motivo/request ref y no atómico. |
| ERR-01 | no conformidad | Errores DB crudos; fallos de sync/evento se ignoran. |
| UPL-01 | excepción | Sólo se observa flag `uploaded`; el archivo/evidencia no forma parte de esta muestra. |
| NUM-01 | no aplica | Los montos no se editan al liberar. |
| A11Y-01 | no verificable | Sin runtime de browser. |

## Brechas comprobadas

1. Carrera TOCTOU: los documentos se leen sin lock y pueden cambiar antes del
   `UPDATE` de liberación.
2. No hay precondición de estado ni comprobación de fila afectada.
3. Filing liberado, shipment actualizado y evento pueden divergir.
4. La action genérica y PostgREST evaden el control de documentos.
5. No hay idempotencia, actor, motivo ni referencia durable.
6. No se localizaron tests focales del dominio customs/SENIAT.

## Slice mínimo propuesto

- `ConfirmDialog` con DUA, shipment, agente, documentos, consecuencia y motivo.
- RPC transaccional que bloquee filing+shipment, valide rol de
  operations/accounting, tenant, estado, documentos requeridos y request ref.
- Trigger anti-bypass para cualquier transición a `liberado`.
- Filing, shipment y evento/AUD-01 cambian juntos o ninguno cambia.
- Retirar `liberado` de la action genérica.
- Errores públicos estables y replay idempotente.

## Allowlist propuesta

- `docs/specs/<siguiente>-aduana-seniat-liberacion-gobernada/spec.md`
- `app/studio/(app)/seniat/actions.ts`
- `app/studio/(app)/seniat/_components/FilingDetailDrawer.tsx`
- tests focales nuevos;
- una migración nueva y su contrato SQL;
- mapa/índices documentales;
- recibo de implementación.

## Aceptación mínima

- Sin documento obligatorio, rol permitido o tenant correcto no hay mutación.
- Action genérica y `UPDATE` directo no pueden liberar.
- Doble llamada/reintento producen una liberación y una evidencia.
- Filing, shipment y evento quedan atómicos con actor, motivo y request ref.
- Estado previo o shipment incompatible devuelven conflicto, no éxito.
- UI bloquea doble envío, restaura foco y anuncia error/éxito.

## Bloqueos

Ninguno para implementación y validación local. Cloud, Producción, Vercel y
`main` permanecen fuera de alcance; 0316 y 0317 conservan sus gates nominales.
