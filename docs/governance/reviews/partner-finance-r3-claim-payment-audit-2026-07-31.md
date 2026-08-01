# REV-SGE-035 · Auditoría R3 de pago de cruce en Financiero China

| Control | Valor |
|---|---|
| Fecha | 2026-07-31 |
| Fuente normativa | LB-SGE-104 / REV-SGE-029 |
| Módulo | Financiero China |
| Acción seleccionada | `reconocido_proveedor → pagado_en_china` |
| Método | Read-only, una acción R3 |
| Mutaciones | Ninguna |

## Selección

El módulo permite importar y cerrar estados, registrar cargos, conversiones,
notas y cruces, y avanzar máquinas de estado. Se seleccionó “Pagado en China”
porque afirma que un proveedor ya entregó valor financiero en otra jurisdicción;
una verdad falsa puede distorsionar cuentas, reclamos y el descuento posterior al
cliente. Es más irreversible que registrar un borrador o reconciliar una línea.

## Recorrido técnico

1. `ClaimOffsetsTab` calcula el siguiente estado y ejecuta la transición desde un
   `ActionButton` de un clic
   (`app/studio/(app)/financiero-china/_components/ClaimOffsetsTab.tsx:83-106`).
2. `transitionClaimOffsetAction` aplica `moduleEditDenial`, valida id/estado y
   deriva el siguiente estado, pero no recibe motivo, referencia ni fecha
   confirmada (`app/studio/(app)/financiero-china/actions.ts:472-501`).
3. `transitionClaimOffset` construye un `UPDATE` con la fecha local del servidor,
   filtra por id y estado previo y no exige que la actualización devuelva una
   fila (`lib/studio/partner-finance/claim-offsets-queries.ts:76-109`).
4. La tabla admite `UPDATE` a cualquier usuario autenticado del tenant; el rol
   financiero sólo vive en la ruta de aplicación y no en DB
   (`supabase/migrations/0114_financiero_china.sql:444-507`).
5. La fila conserva hitos de fecha y estado, pero no actor, motivo, request ref
   ni historial append-only
   (`supabase/migrations/0114_financiero_china.sql:251-278`).

## Matriz de políticas

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 | no conformidad | La acción R3 no demuestra permanencia, resumen ni reversibilidad explícita. |
| MP-01 | no conformidad | Tenant sí; rol sólo en Server Action y evadible vía PostgREST. |
| BTN-01 | cumplimiento | `ActionButton` bloquea mientras la promesa está pendiente. |
| HTD-01 | no conformidad | No usa `ConfirmDialog` ni segunda confirmación contextual. |
| AUD-01 | no conformidad | Hitos sin actor, motivo, request ref ni evento append-only. |
| ERR-01 | no conformidad | Se propaga texto técnico y una actualización de cero filas puede reportar éxito. |
| NUM-01 | no aplica | La transición no edita el monto. |
| UPL-01 | no aplica | No hay carga de archivo en esta acción. |
| A11Y-01 | no verificable | No se ejecutó interacción en browser. |

## Brechas comprobadas

1. **Fricción insuficiente:** “Pagado en China” ocurre con un clic sin resumen,
   monto, proveedor, consecuencias ni motivo.
2. **Autorización evadible:** RLS limita tenant, pero no restringe la mutación a
   admin/roles financieros.
3. **Verdad de éxito:** el `UPDATE ... eq(status, from)` no selecciona ni cuenta
   filas. Cero filas afectadas se interpreta como éxito.
4. **Doble ejecución:** la segunda llamada puede devolver éxito aunque la primera
   ya avanzó el estado; no existe request ref durable.
5. **Auditoría:** no hay actor ni evento append-only de la transición.
6. **Fecha:** se deriva de la fecha local del servidor y no queda vinculada a una
   decisión explícita del operador.

## Evidencia automatizada existente

Se ejecutó `pnpm test lib/studio/partner-finance/__tests__`: 10 archivos y
169 pruebas verdes. Cubren validadores, máquina pura, queries y posting, pero no
el contrato UI→Action→DB del pago R3, bypass de rol, idempotencia ni auditoría.

## Slice mínimo propuesto

1. `ConfirmDialog` con proveedor, monto, estado origen/destino, fecha efectiva y
   advertencia de que se declarará pagado en China.
2. Motivo y `request_ref` obligatorios; la fecha efectiva se envía explícita.
3. RPC transaccional `SECURITY DEFINER` que resuelva tenant/rol, bloquee la fila,
   valide el estado esperado, haga idempotencia por `request_ref`, selle actor y
   escriba un evento append-only.
4. Revocar `UPDATE` directo autenticado sobre `supplier_claim_offsets` o
   reemplazar la policy de mutación por una que impida el bypass.
5. Errores públicos estables y respuesta que distinga ejecutado, replay y
   conflicto.

## Allowlist propuesta

- `docs/specs/<siguiente>-financiero-china-pago-cruce-gobernado/spec.md`
- `app/studio/(app)/financiero-china/actions.ts`
- `app/studio/(app)/financiero-china/_components/ClaimOffsetsTab.tsx`
- `lib/studio/partner-finance/claim-offsets-queries.ts`
- `lib/studio/partner-finance/types.ts`
- pruebas focales nuevas de UI/action/query;
- una migración nueva y su contrato SQL;
- `docs/architecture/module-sdd-map.md`;
- índices documentales generados;
- un recibo de implementación.

Los correlativos de SDD y migración deben revalidarse justo antes de editar.

## Pruebas de aceptación

- Un rol no financiero del tenant no puede transicionar por UI, Action ni RPC.
- Un id de otro tenant no se puede observar ni mutar.
- Pago exige confirmación, fecha, motivo y request ref válidos.
- Dos llamadas con el mismo request ref producen un solo evento y la misma
  respuesta; una referencia reutilizada para otro payload falla.
- Estado previo distinto devuelve conflicto, nunca éxito falso.
- Actor, tenant, fecha efectiva, motivo, origen, destino y request ref quedan en
  evidencia append-only.
- UI conserva foco, anuncia error/éxito y bloquea doble envío.
- Pruebas focales, SQL, typecheck y validadores de gobernanza quedan verdes.

## Bloqueos

Ninguno para implementar y validar localmente. Cloud, Producción, Vercel y la
integración a `main` permanecen fuera de alcance. La migración 0316 de Nómina no
se publica ni se aplica por este slice.

## Recomendación

Abrir un slice correctivo independiente y limitado a la transición
`reconocido_proveedor → pagado_en_china`.
