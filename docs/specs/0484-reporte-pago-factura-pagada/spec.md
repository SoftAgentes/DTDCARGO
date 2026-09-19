---
sdd: "0484"
title: "Los comandos de reportes de pago frente a una factura ya pagada"
status: in-progress
author: "Sam + Claude Opus 5 (Worker)"
created: 2026-09-18
updated: 2026-09-19
supersedes: null
superseded_by: null
related: ["0134", "0365", "0366", "0421", "0422", "0423"]
confidencialidad: interno
---

# SDD-0484 — Los comandos de reportes de pago frente a una factura ya pagada

> Confirmar un reporte de pago sobre una factura ya pagada, o por un monto mayor
> que su saldo, sumaba el monto y dejaba la factura con más pagado que su total.
> Con la migración `0464`, esa confirmación se rechaza con un mensaje que dice qué
> hacer. El motivo de una cancelación, que sólo quedaba en la bitácora de
> auditoría, se guarda también en el reporte, donde Studio y el portal ya lo
> muestran. **La 0464 está aplicada en producción desde el 2026-09-19** (ver
> «Aplicación en producción»). Falta que Sam lo verifique en producción.

## Contexto

### Lo que se pidió verificar

Encargo de Sam del 2026-09-18, sobre `0421_payment_report_commands.sql`
(SDD-0365). Ese archivo está **aplicado** en producción (ledger `20260913224126`,
md5 `6944ffddf61f4d20514ff78aad7f983f`) y no se edita.

1. La función que ejecuta los comandos rechaza facturas borradas, en `borrador` o
   `anulada`, pero no revisa si la factura ya está pagada. ¿Se puede confirmar un
   reporte sobre una factura pagada? ¿Algún otro punto del flujo lo impide?
2. El motivo de cancelación de un reporte no se guardaría en ninguna parte.

### Hallazgo 1 — CONFIRMADO

- `payment_private.run_report_command` sólo mira el estado de la factura en
  `0421:263` (borrada, `borrador`, `anulada`). El alta rechaza `pagada`
  (`0421:278`), pero la confirmación no: en `0421:309-317` suma el monto y sólo
  recalcula el estado si la factura está en `emitida`, `parcial` o `vencida`. Una
  factura `pagada` sigue `pagada` con más pagado que su total.
- Nada lo impide antes. `invoices` no tiene CHECK sobre `paid_amount`
  (`0077_invoices.sql`) y los triggers de `invoices` (`0197`, `0290`) no lo
  miran. El validador `payment_reports_validate_invoice` (`0195:172-198`) sólo
  exige factura viva, no borrador, del mismo tenant y Shipping Mark. La acción de
  Studio (`app/studio/(app)/facturacion/payment-report-actions.ts:14-37`) llama al
  comando sin leer la factura. El componente
  (`StudioInvoicePaymentReports.tsx:72,173-182`) ofrece «Confirmar pago» en todo
  reporte pendiente y no conoce la factura. El portal sólo impide **crear**
  reportes sobre facturas pagadas (`reportar/actions.ts:72`) y no limita el
  monto al saldo. La RPC heredada `confirm_payment_report` (`0359:44-129`) hace
  lo mismo.
- El sobrepago estaba fijado a propósito. SDD-0365 lo escribe: «admite sobrepago
  como el comando existente». El contrato de 0421 lo afirma en
  `supabase/tests/0421_payment_report_commands.test.sql:641-644` («preserva
  sobrepago heredado y estado pagada»). No se encontró una decisión de Sam que lo
  respalde. En Cobranzas, en cambio, un cobro no puede superar el saldo
  (`lib/studio/payment-types.ts:416-417`, `lib/studio/collections-actions.ts:404-406`).
- **Reproducción** en PGlite, sobre la fixture sintética del contrato 0421 y con
  la 0421 real aplicada:
  - Factura pagada (1000/1000) con un reporte pendiente de 100: la confirmación
    se acepta y la factura queda en 1100/1000, `pagada`.
  - El mismo pago reportado dos veces (980 + 980 sobre un saldo de 980): las dos
    confirmaciones se aceptan y la factura queda en 1980/1000.
  - Con dos sesiones concurrentes reales en `postgres:17`
    (`scripts/qa/payment-report-confirm-race.mjs --sin-0464`) también queda en
    1980/1000.

### Hallazgo 2 — DESCARTADO tal como está escrito

El motivo **sí se guarda**, en `entity_audit_log.reason` del evento
`payment_report_cancelled`, con sensibilidad `restricted`. `0421:276` lo fija
como contexto de la transacción, `0421:326-336` lo pasa a `append_audit_event`,
el wrapper de `0294` lo prioriza y `0267` lo inserta. Además, la auditoría **lo
exige**: un evento que termina en `_cancelled` sin motivo aborta el comando
entero (`0267:554-559`). El contrato de 0421 lo comprueba en las líneas 599-600.

Lo que sí es cierto:

- no queda en el reporte: la cancelación (`0421:306-307`) sólo escribe
  `cancelled_at` y `cancelled_by`;
- el recibo guarda sólo la huella del input (`0421:343-344`);
- **ningún rol de la app puede leerlo**. `0270:588-591` retira el SELECT de
  `authenticated` sobre la bitácora, `audit_list_events` excluye `reason` por
  diseño (`0270:654`, `0398:46`) y `audit_get_event_detail` devuelve
  `redacted: true` con `fields` vacío (`0270`);
- el portal muestra «Motivo:» justo después de cancelar, desde su estado local, y
  al recargar lo lee de `resolution_reason` (`InvoicePaymentReports.tsx:56,77,91`).
  Como la cancelación no escribe esa columna, **el motivo desaparece al
  recargar**. Studio también muestra «Motivo:» desde `resolution_reason`
  (`StudioInvoicePaymentReports.tsx:166-169`).

### Decisiones de Sam (2026-09-18)

Las tres se tomaron por AskUserQuestion. Se transcribe la opción elegida:

| Pregunta | Opción elegida |
|---|---|
| Finanzas confirma un reporte pendiente de una factura que ya está pagada | «Rechazar (Recomendado)»: la confirmación falla con un mensaje claro y el saldo no cambia; finanzas rechaza el reporte con su motivo. |
| El reporte supera el saldo de una factura todavía sin pagar | «Rechazar el excedente (Recomendado)»: no se confirma un reporte mayor que el saldo, igual que en Cobranzas. |
| El motivo de cancelación se guarda sólo en la auditoría y ninguna pantalla lo muestra | «Mostrarlo en el reporte»: se guarda también en el reporte para que Studio y el portal lo muestren. |

## Alcance

La migración `0464` reemplaza **sólo** `payment_private.run_report_command`. Su
cuerpo es el de 0421 copiado textual, con tres diferencias:

1. `create` pasa a `create or replace`;
2. confirmar sobre una factura `pagada` → `PAYMENT_INVOICE_PAID`, y confirmar un
   monto mayor que el saldo (`total_amount − paid_amount`) →
   `PAYMENT_EXCEEDS_BALANCE`. Ambos usan `23514`, no mutan nada y no dejan recibo
   ni evento;
3. cancelar escribe el motivo validado también en `resolution_reason`.

La app traduce los dos códigos nuevos. **Las pantallas no cambian**, porque ya leen
`resolution_reason` como «Motivo».

No se edita la 0421 ni su contrato. No se tocan 0422 ni 0423, los wrappers, las
policies, el guard de columnas, el validador 0195 ni la RPC heredada
`confirm_payment_report`. No hay backfill.

### Allowlist exacta

- `supabase/migrations/0464_reporte_pago_factura_pagada.sql` (nuevo).
- `supabase/tests/0464_reporte_pago_factura_pagada.test.sql` (nuevo).
- `lib/portal/__tests__/payment-report-paid-invoice.migration.test.ts` (nuevo).
- `lib/portal/payment-report-commands.ts`: dos entradas de `REJECTIONS` y su
  comentario.
- `lib/portal/__tests__/payment-report-commands.test.ts`: pares conocidos y
  mensajes nuevos.
- `scripts/qa/payment-report-confirm-race.mjs` (nuevo).
- `supabase/migrations-baseline.json`: espera de `0464` en `pendingBelowCutoff`.
- Esta spec y `docs/specs/README.md` (índice generado).
- `.agents/handoffs/0484-reporte-pago-factura-pagada.md`.

## Diseño

### La regla del saldo

Van dos comprobaciones, en este orden, sólo para `confirm`, después de las de
0421 (factura viva, reporte pendiente, moneda):

```sql
if p_kind = 'confirm' and v_inv.status = 'pagada' then
  raise exception 'PAYMENT_INVOICE_PAID' using errcode = '23514';
end if;
if p_kind = 'confirm'
   and v_rep.amount > v_inv.total_amount - coalesce(v_inv.paid_amount, 0) then
  raise exception 'PAYMENT_EXCEEDS_BALANCE' using errcode = '23514';
end if;
```

- El estado manda sobre el saldo. Una factura marcada `pagada` rechaza la
  confirmación aunque le quede saldo, por ejemplo si se marcó a mano.
- El saldo exacto se acepta y deja la factura `pagada` sin excedente. Un abono
  menor conserva la fórmula de SDD-0134 (`emitida`/`vencida` → `parcial`).
- **Rechazar** y **cancelar** siguen disponibles sobre una factura pagada. Son la
  salida del reporte pendiente y no mueven el saldo.
- Un **replay** de una confirmación ya hecha devuelve su recibo aunque la factura
  haya quedado pagada. El recibo se busca antes de las reglas de estado, igual
  que en 0421.
- `numeric(14,2)` compara sin redondeo, así que no hay la tolerancia de 0,01 que
  usa Cobranzas para su aritmética en JavaScript.

### Concurrencia

La factura se toma `FOR UPDATE` antes de leer el saldo; ese bloque viene de 0421
y la 0464 lo conserva. Dos confirmaciones simultáneas se serializan, y la segunda
compara contra el pagado que dejó la primera. PGlite no puede probarlo porque
tiene una sola conexión. Se prueba en `postgres:17` con sesiones reales, en tres
corridas:

- con la 0464, la segunda sesión espera el lock de la factura y se rechaza con
  `PAYMENT_INVOICE_PAID`;
- sin la 0464, se acredita dos veces;
- con un mutante sin ese `FOR UPDATE`, las dos se confirman y la factura queda en
  1000: una actualización perdida, con dos reportes confirmados por 1960.

### El motivo de la cancelación

Se guarda en `resolution_reason`, la columna que ya leen las dos pantallas. Esa
columna ya tiene CHECK de 4 a 500 caracteres, que coincide con la validación del
motivo, y el guard de 0421 impide escribirla por API. Un reporte cancelado nunca
se confirma ni se rechaza después, así que la columna se escribe una sola vez. La
0464 actualiza el `comment on column` con la nueva finalidad.

Se descartó una columna `cancellation_reason` nueva por tres costos: DDL con
ACCESS EXCLUSIVE sobre `payment_reports`, reemplazar el guard para protegerla y
cambiar tipos y consultas TS, todo para mostrar lo mismo.

### Hueco que sigue abierto hasta la 0422

`public.confirm_payment_report` (0359) sigue ejecutable por `authenticated` y
`service_role` (`0359:134-135`). Confirma sin mirar el estado de la factura ni su
saldo. Según el inventario de SDD-0365 no la usa ninguna pantalla, pero
cualquier sesión autenticada con rol de finanzas puede llamarla. La 0422 le
retira el EXECUTE (`0422:118-119`), así que la regla de esta spec **queda
completa sólo cuando se aplique la 0422**.

### Orden de release

1. Fusionar y desplegar la app. Los dos códigos nuevos de `REJECTIONS` no se
   usan hasta que exista la 0464.
2. Aplicar la 0464, con OK nominal de Sam y según
   `docs/runbooks/aplicar-migraciones-prod.md`. El Director lee antes en
   producción, sólo catálogo, `md5(prosrc)` y
   `md5(regexp_replace(prosrc, '\s', '', 'g'))` de `run_report_command`. Lo
   esperado es `7814b3911f1e273a52bf870d8db08155` o
   `c5ab13c20d8ec372e4399ca08833964c`.

El 2026-09-19 se siguió este orden: la app quedó desplegada a las 00:54Z y la
0464 se aplicó a las 01:00:07Z (ver «Aplicación en producción»).

Si la 0464 se aplica antes del despliegue, la app anterior muestra el rechazo
como «resultado incierto». Es seguro, porque no hay mutación, pero confunde.

Respecto de la 0422 y la 0423, la 0464 puede ir en cualquier punto. Su preflight
mira el cuerpo, owner y ACL de `run_report_command`, `resolution_reason` y el
guard; nada de eso lo cambian la 0422 ni la 0423. A su vez, sus preflights miran
owner, seguridad, ACL y policies (0422) y el validador 0195 (0423), y la 0464 no
los cambia. La prueba PGlite lo comprueba en los tres órdenes.

## Criterios de aceptación

- [x] Confirmar sobre una factura `pagada`, con o sin saldo, responde
      `PAYMENT_INVOICE_PAID` (23514), sin mutación, recibo ni evento.
- [x] Confirmar un monto mayor que el saldo responde `PAYMENT_EXCEEDS_BALANCE`
      en `emitida`, `parcial` y `vencida`. El saldo exacto deja la factura
      `pagada` sin excedente. Un abono menor conserva la fórmula de SDD-0134.
- [x] Rechazar y cancelar siguen disponibles sobre una factura pagada y no
      mueven el saldo.
- [x] Si el mismo pago se reporta dos veces, sólo uno se acredita, también con
      dos sesiones concurrentes.
- [x] El replay de una confirmación ya hecha devuelve su recibo sin repetir
      efectos.
- [x] Cancelar guarda el motivo validado, recortado, en `resolution_reason`. La
      auditoría conserva el mismo motivo, el recibo no guarda texto y la API no
      puede reescribirlo.
- [x] La app traduce los dos códigos con un mensaje que dice qué pasó, qué se
      conservó y qué hacer.
- [x] Con la 0464 aplicada antes, entre o después de la 0422 y la 0423, sus
      contratos completos siguen en verde.
- [x] Hay control rojo sin la 0464 y mutantes de cada regla, y el contrato
      detecta cada uno.
- [ ] 0464 aplicada en producción con OK nominal de Sam (release; lo hace el
      Director). **Aplicada el 2026-09-19** (ver «Aplicación en producción»).
      Falta la verificación de Sam en producción: el bloque 3.2 de la prueba
      de reportes de pago. Al recargar, el motivo de la cancelación tiene que
      seguir visible.

## Aplicación en producción (2026-09-19)

Salvo donde se indica otra cosa, lo leyó el Director (`dtdcargo-18`), sólo del
ledger y del catálogo, sin filas de negocio.

- **OK nominal de Sam:** por AskUserQuestion del Director, el 2026-09-19 a las
  00:29Z, nombrando «0464_reporte_pago_factura_pagada». Sam lo confirmó también
  en la sesión Worker: «Autorizo aplicar la 0464_reporte_pago_factura_pagada».
- **Primero la app:** la PR #150 se fusionó a las 00:51:43Z (`26983062`). En
  GitHub, el estado `Vercel` de ese commit es `success` («Deployment has
  completed») desde las 00:54:23Z. Esto lo comprobó la sesión que registra la
  aplicación.
- **Preflight:** releído justo antes de aplicar, `md5(prosrc)` de
  `payment_private.run_report_command` era `7814b3911f1e273a52bf870d8db08155`,
  el cuerpo de 0421. 0 sesiones activas.
- **Aplicación:** el Director aplicó la 0464 sola, con `name` exacto, a las
  01:00:07Z (21:00 del 18 en Caracas).
- **Ledger:** `20260919010007 · 0464_reporte_pago_factura_pagada`, 1 sentencia.
  `statements` tiene md5 `44fabe4d2643844fbe489e2ba88fa4fb` y 22 209 bytes,
  igual que el blob `0b2d0065` de `main`, que sólo tiene LF. La sesión que
  registra la aplicación comprobó en Git el md5, los bytes y los finales de
  línea de ese blob. La cabecera del `.sql` no se toca: el ledger guarda su
  texto exacto.
- **Postflight:** el postflight interno de la migración pasó. El nuevo
  `md5(prosrc)` es `c3aab7fcb10e3bf5de0fa40cc562a45d`, el esperado. La función
  es DEFINER, con owner `postgres` y `search_path=""`, y sólo `authenticated`
  tiene EXECUTE (ni `anon` ni `service_role`). El comentario de la columna
  `resolution_reason` quedó actualizado.
- **Advisors de seguridad:** la misma huella antes y después (md5 normalizado
  `c80be09588e4dd2dd588379f246765f5`).
- La sesión que registra la aplicación no tenía conector de Supabase y no
  repitió la lectura de producción.
- La espera salió de `supabase/migrations-baseline.json › pendingBelowCutoff`.
  Siguen en espera la 0422 y la 0423.

### Verificación en producción, pendiente de Sam

- **Bloque 3.2** de la prueba de reportes de pago
  (`.agents/handoffs/smokes-app-l14-0454-0472-guion.md`, bloque 3, paso 2):
  cancelar un reporte con motivo en el Portal y recargar. Antes de la 0464 el
  «Motivo: …» desaparecía al recargar; ahora tiene que seguir visible. Sirve un
  reporte cancelado **después** de la 0464: los anteriores conservan el motivo
  sólo en la auditoría, porque no hubo backfill.
- **El rechazo sobre una factura pagada no se prueba en producción.** La
  factura de prueba se anula al final de la prueba (bloque 4), y una factura
  pagada ya no se puede anular. Esa regla la cubren los contratos:
  `supabase/tests/0464_reporte_pago_factura_pagada.test.sql` (45 aserciones,
  con control rojo y cinco mutantes), en `psql` real y en PGlite
  (`lib/portal/__tests__/payment-report-paid-invoice.migration.test.ts`), y la
  carrera de `scripts/qa/payment-report-confirm-race.mjs` en `postgres:17`. La
  regla del excedente (`PAYMENT_EXCEEDS_BALANCE`) tampoco está en la prueba de
  Sam y la cubren los mismos contratos.
- Cuando Sam confirme el bloque 3.2, se marca el último criterio y la spec
  puede pasar a `done`. El hueco de la RPC heredada sigue abierto hasta la 0422
  (ver «Hueco que sigue abierto hasta la 0422»).

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.04 / AUD-01 | **cumplimiento** | Confirmar, rechazar y cancelar siguen auditados en la misma transacción (`append_audit_event`, evento, recibo y reporte juntos). Un intento rechazado no muta y no se audita, igual que `PAYMENT_STATE` en 0421 (ERR-01: no todo error de validación contamina el audit log). |
| SGE-00.05 / SGE-00.06 | **cumplimiento** en el servidor; **no conformidad preexistente** en la UI | La regla vive en SQL y se evalúa antes de cualquier mutación. Studio sigue ofreciendo «Confirmar pago» sin conocer la factura, como ya pasaba con facturas `anulada` o `borrador`. Queda como FUERA DE ALCANCE. |
| SGE-00.11 / ERR-01 | **cumplimiento** | Los códigos se traducen sin SQL. Cada mensaje dice qué pasó, que el saldo y el reporte quedan igual y qué hacer (`payment-report-commands.ts`). Reintentar no duplica nada (replay). |
| MP-01 | **cumplimiento** | La cancelación sigue siendo P3: conserva el original, la nota y el comprobante, y ahora también el motivo. No se borra nada. |
| AUD-02 | **no aplica** | No cambia la consulta ni la conservación de la bitácora. El motivo pasa a leerse desde el reporte, no desde la auditoría. |
| BTN-01 / CMP-01 | **no aplica** | No hay botones ni componentes nuevos. |

## Privacidad

Revisión con `.claude/skills/revisar-datos-ve`, limitada a este cambio. No es
asesoría legal.

| Dato | Qué es | Finalidad | Retención | Quién lo ve |
|---|---|---|---|---|
| `payment_reports.resolution_reason` en un reporte cancelado | Texto libre de 4 a 500 caracteres que escribe el cliente al cancelar su reporte | Explicarle a finanzas y al propio cliente por qué se canceló; documentada en el `comment on column` de la 0464 | La del reporte: P3, sin purga definida (SDD-0365 no fija plazos) | El cliente (`payment_reports portal self read`, 0420); finanzas `accounting`/`admin` (0422; antes de la 0422, todo miembro del tenant por `payment_reports by tenant`); lecturas de servidor con `service_role` |
| `entity_audit_log.reason` (ya existía) | El mismo texto | Auditoría | Append-only | Ningún rol de la API (0270) |

- **Punto 2 · minimización: CORRECTO.** El campo tiene una finalidad decidida
  por Sam y queda documentada en la columna.
- **Punto 2 · texto libre: NO VERIFICABLE.** Un motivo libre puede traer datos
  de más, por ejemplo de salud o de terceros. No se leyeron filas reales.
- **Punto 5 · borrado: ENCONTRADO (preexistente, ampliado).** El motivo vive en
  dos lugares, el reporte y la auditoría, y ninguno tiene camino de supresión.
  El reporte es P3 sin purga y la auditoría es append-only. Esta spec agrega la
  copia del reporte. Mapa de destinos: `payment_reports.resolution_reason` y
  `entity_audit_log.reason`. No está en recibos, logs de la app ni terceros. La
  purga gobernada de reportes queda para su propia tarea.
- **Punto 12 · titulares que no son usuarios: NO VERIFICABLE.** El texto puede
  nombrar a otra persona.
- **Puntos 8 y 9:** no hay terceros ni transferencias nuevas.

## Evidencia

Todo corrió en el worktree `codex/reporte-pago-factura-pagada`, sin leer filas de
negocio de producción. El detalle, con los SHA, está en el handoff.

- `lib/portal/__tests__/payment-report-paid-invoice.migration.test.ts` corre en
  PGlite los `.sql` reales de 0421 a 0464 y reúne:
  - el contrato 0464 en verde (45 aserciones);
  - el **control rojo** sin la 0464;
  - cinco mutantes (sin la regla de pagada, sin la del saldo, `>=` en el saldo,
    sin guardar el motivo y el motivo sin recortar), cada uno detectado por su
    propia aserción;
  - los contratos completos de 0422 y 0423 con la 0464 antes, entre o después;
  - el preflight: segunda aplicación, drift de ACL y guard ausente abortan, y el
    mismo cuerpo con CRLF se acepta;
  - los locks.
- `lib/portal/__tests__/payment-report-commands.test.ts` cubre los pares
  conocidos y los mensajes nuevos. Su control rojo es quitar las dos entradas:
  fallan exactamente las cuatro pruebas nuevas.
- `scripts/qa/payment-report-confirm-race.mjs` corre la carrera con dos sesiones
  en `postgres:17`, con la 0464, sin ella y con el mutante sin `FOR UPDATE`.
- Locks de la 0464, medidos: ACCESS EXCLUSIVE sobre el objeto
  `run_report_command`, que sólo choca con otra DDL sobre la función porque
  llamarla no toma ese lock; SHARE UPDATE EXCLUSIVE sobre `payment_reports` por
  el COMMENT de columna, que no bloquea lecturas ni escrituras. Ninguno sobre
  `invoices` ni sobre los recibos.

## Riesgos

- Aplicar la 0464 antes de desplegar la app hace que Studio muestre el rechazo
  como «resultado incierto». No ocurrió: la app se desplegó antes.
- Los reportes cancelados antes de la 0464 conservan el motivo sólo en la
  auditoría. Rellenarlo exige leer y escribir filas de negocio de producción.
- Hasta aplicar la 0422, la RPC heredada confirma sin estas reglas.
- Un cliente que pagó de más debe reportar el monto correcto. El excedente real
  queda fuera del sistema, porque no existe el saldo a favor.

## Fuera de alcance

- Que Studio oculte o deshabilite «Confirmar pago» cuando la factura está pagada
  o el reporte supera el saldo.
- Limitar al saldo el monto del alta en el portal.
- Registrar un sobrepago como saldo a favor del cliente.
- Rellenar el motivo de cancelaciones anteriores a la 0464.
- La RPC heredada `confirm_payment_report`, que retira la 0422.
