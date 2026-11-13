# Handoff · SDD-0630 — Confirmar un reporte de pago crea su recibo de cobro

- **Owner:** Worker SDD-0630 (claim `sdd-0630-worker`), abierto por el Subdirector de Contabilidad.
- **Ruta:** `.claude/worktrees/sdd-0630-recibo-al-confirmar-0e4534`
- **Rama:** `claude/sdd-0630-recibo-al-confirmar-0e4534`. Salió de `origin/claude/tren-ad`
  (ae1c0df80), como pidió el DG. El tren AD entró a main en e5169e86e, y main se trajo una sola
  vez con merge (52366a87e). En ese main, la 0527, la 0533 y la 0534 ya están selladas como
  aplicadas.
- **PR:** contra main, sin dependencias pendientes.
- **Spec:** [docs/specs/0630-recibo-al-confirmar-reporte/spec.md](../../docs/specs/0630-recibo-al-confirmar-reporte/spec.md)
- **Migración:** `0537_recibo_al_confirmar_reporte`, en espera. Va después de la 0533 y es
  MIGRATE-FIRST respecto de esta app.

## OBJETIVO ORIGINAL

Que confirmar un reporte de pago del portal cree, en una sola transacción y por la vía de
`register_collection_receipt` (0467), el recibo con su correlativo, la cuenta de caja elegida, el
`fund_class`, el `paid_amount` y el estado de la factura, y el vínculo reporte↔recibo. El asiento
de cobro también estaba en la lista; ver la decisión técnica más abajo. Con esto se cierra el
doble conteo con Cobranzas. Hay que conservar la idempotencia, el tope de la 0464, los permisos y
la auditoría.

## COMPLETADO

- Migración 0537: guard del vínculo, `run_report_command` con el delta de `confirm` (copia íntegra
  de la 0533), el wrapper `confirm_payment_report_with_receipt`, y preflight y postflight.
- Contratos SQL:
  - `supabase/tests/0537_recibo_al_confirmar_reporte.test.sql`: Postgres 17 con dblink, control
    rojo sin la 0537, cinco carreras con sesiones reales, casos de una sesión, y 0422 y 0423
    aplicadas encima;
  - casos compartidos en `…casos.sql` y `…despues.sql`.
- PGlite: `lib/portal/__tests__/payment-report-receipt.migration.test.ts`, con los casos, el
  preflight (sin la 0533 y con una reaplicación) y tres mutantes.
- App:
  - transporte con la cuenta y el recibo decodificado;
  - acción que asienta el recibo como Cobranzas (`postCollectionReceiptEntry`, compartida);
  - selector de cuenta en la factura y el recibo visible en los reportes confirmados;
  - aviso en Cobranzas de reportes sin revisar (`PendingReportsNotice`, con su propia acción;
    el drawer sólo lo monta). El cruce con la #531 (SDD-0629, cabeza d55101ee4), medido con
    `git merge-tree`, da 0 conflictos.
- Baseline (espera de la 0537) y declaraciones del gate de símbolos (dos AMARILLO declarados).

### Decisión técnica que el DG debe mirar

El asiento DR caja / CR 1.1.2 **no** va dentro de la transacción SQL. Va como en Cobranzas: la
app lo arma después del COMMIT, best-effort e idempotente por recibo, y lo reintenta en un replay.
Hacerlo atómico obligaba a escribir en SQL una segunda implementación del posteo de cobros, y
eso contradecía «la misma vía». Si se quiere atómico, conviene una SDD aparte para cobros y
confirmaciones a la vez. Está escrito en la spec (§ Asiento).

## VALIDACIÓN

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Contratos SQL en Actions (`sql-tests.yml`, workflow_dispatch en la rama) | PASÓ: 282 de 282, con `0537_recibo_al_confirmar_reporte.test.sql` (control, R1-R4, casos, 0422 y 0423 encima) | run 43499942755. Los rojos anteriores, 43496423728 y 43497275587, eran de la prueba: `'texto' \|\| jsonb`, una invariante que incluía la factura de control y `dblink_exec` con un SELECT. |
| PGlite: fixture 0533 + 0537 + casos + 0422/0423 | PASÓ: 70 aserciones en los casos y 75 con «después»; el preflight aborta sin la 0533 y al reaplicar | una corrida puntual de node con el script de diagnóstico, ~10 s |
| PGlite `payment-report-receipt.migration.test.ts` (vitest, con mutantes) | NO EJECUTADO en local; lo corre el CI de la PR («Calidad») | portón = CI de GitHub (cambio del DG, 2026-11-13) |
| Vitest `payment-report-commands.test.ts`, `payment-report-ui.test.tsx` y `PendingReportsNotice.test.tsx` | NO EJECUTADO en local; lo corre el CI de la PR | ídem |
| Gate de símbolos pendientes | PASÓ: 0 ROJO, 3 AMARILLO declarados | `node scripts/check-pending-migration-symbols.mjs` |
| `sdd:check` (numeración) | PASÓ | `node scripts/check-numbering.mjs` |
| `pnpm verify` | NO EJECUTADO (portón = CI de GitHub + revisión independiente) | instrucción del Subdirector, 2026-11-13 |
| CI de la PR | PENDIENTE: lo lee el Subdirector al pasar la PR a lista | |

## Guion de smoke en el ambiente de prueba — lo ejecuta Sam

Adapta el Bloque 3 de `.agents/handoffs/smokes-app-l14-0454-0472-guion.md` y cubre la 0537, la
0422 y la 0423, en ese orden. **Sólo en prueba** (`https://prueba.dtdcargo.com`, aviso «Entorno de
prueba» arriba). Usa la puerta, la cuenta `contabilidad@prueba.example.test` y el cliente
`DTD-9001`, igual que en el Bloque 7 del guion. Nada sale a Resend, Telegram ni Kommo. Los montos
son de prueba.

**Antes, lo hace el Director (no Sam):** publicar en prueba la imagen de esta rama (tren AD +
SDD-0630) y aplicar en la base de prueba, de a una y en este orden:

1. la 0533, si aún no está;
2. la 0537, entera, en una transacción.

La 0422 y la 0423 se aplican **después** del paso 10. El Director confirma cada una con su
postflight antes de avisarte. Aplicar en prueba no autoriza producción.

**Preparación**

1. [ ] Studio, con accounting: crea una factura de USD 10,00 para `DTD-9001`, emítela y anota su
   código.
2. [ ] En Contabilidad › Plan de cuentas, mira que haya al menos una cuenta de caja o banco
   (código 1.1.1… o tipo banco). Anota su nombre.

**Portal (incógnito, cliente de prueba)**

3. [ ] En esa factura, haz tres reportes de 1,00 con Transferencia, la fecha de hoy y un
   comprobante cualquiera sin datos personales: «prueba 1», «prueba 2» y «prueba 3». Cancela
   «prueba 1» con el motivo «prueba de cancelación».
   - Esperado: un cancelado y dos «Pago reportado». El motivo sigue visible al recargar.

**Cobranzas, antes de confirmar**

4. [ ] Studio › Cobranzas › abre la factura de prueba.
   - Esperado: el aviso «El cliente reportó 2 pagos por USD $2.00 que siguen sin revisar…» y un
     enlace a la factura.
   - **No registres el cobro aquí.**

**Studio, factura de prueba (accounting)**

5. [ ] En «prueba 2», sin elegir cuenta, pulsa «Confirmar pago».
   - Esperado: el aviso «Elige la cuenta…» y no se abre nada. Si hay una sola cuenta, ya viene
     elegida: anótalo y sigue.
6. [ ] Elige la cuenta del paso 2. Pulsa «Confirmar pago», escribe el motivo «Pago verificado
   (prueba)» y confirma.
   - Esperado: el diálogo nombra la cuenta y dice «No lo registres también en Cobranzas».
   - Después sale «Pago confirmado» y la línea «Recibo de cobro R-…». **Anota el código.**
   - La factura pasa a «Parcial» con 1,00 pagado.
7. [ ] Recarga la factura. Esperado: el reporte sigue con su «Recibo de cobro R-…», y en
   «Recibos» aparece ese R- por 1,00 con la nota «Reporte de pago del portal».
8. [ ] Contabilidad › Libro diario: busca «Cobro R-…».
   - Esperado: un asiento DR la cuenta elegida / CR 1.1.2 por 1,00.
   - Si no está, mira «Por contabilizar»: el recibo tiene que aparecer ahí. Anótalo como falla
     del asiento, no del recibo.
9. [ ] Opcional, con una segunda pestaña abierta antes del paso 6 y sin recargar: «Confirmar pago»
   sobre «prueba 2».
   - Esperado: el error `PAGO-ESTADO`. Sigue un solo recibo y 1,00 pagado.
10. [ ] En «prueba 3», «Rechazar» con el motivo «Reporte de prueba».
    - Esperado: «Reporte rechazado». No hay recibo nuevo y el pagado sigue en 1,00.
    - En Cobranzas, la factura ya no muestra el aviso de reportes sin revisar.

**Portal, otra vez**

11. [ ] Recarga la factura.
    - Esperado: «prueba 2» dice «Pago confirmado», «prueba 3» «Reporte rechazado» y «prueba 1»
      «Cancelado».

**Después de tu OK de los pasos 1-11, el Director aplica la 0422 en prueba**

12. [ ] Repite los pasos 3, 6 y 10 con tres reportes nuevos de 1,00 («prueba 4», «prueba 5» y
    «prueba 6»: cancelas el 4, confirmas el 5 y rechazas el 6).
    - Esperado: lo mismo que antes, con otro R- para «prueba 5» y 2,00 pagados en total.

**Después, el Director aplica la 0423 en prueba**

13. [ ] Dos reportes nuevos de 1,00: cancelas uno y confirmas el otro (con cuenta).
    - Esperado: un recibo más y 3,00 pagados.
    - La 0423 la verifica el Director en el catálogo: su prueba completa exige renombrar un
      Shipping Mark con reportes sobre facturas archivadas, y eso no se hace sólo para probar.

**Cierre:** la factura queda con 3,00 de 10,00 pagados, «Parcial». Anularla al final baja los
recibos según el Bloque 6 del guion. Si algo falla, anota el paso, lo que viste y el texto exacto,
para ese paso y sigue con el siguiente.

**Qué no cubre:** producción. Para producción vale el mismo guion con OK nominal de Sam por cada
migración (0533 → 0537 → despliegue de la app → 0422 → 0423) y el runbook
`docs/runbooks/aplicar-migraciones-prod.md`.

## COMMITS

- 5f9fade34 docs(specs): SDD-0630 — reservar el número
- c56cda5e6 feat(studio): SDD-0630 — 0537: confirmar un reporte de pago crea su recibo
- 77aaedbef feat(studio): SDD-0630 — confirmar con cuenta de caja y recibo en la app

## PR / BRANCH

`claude/sdd-0630-recibo-al-confirmar-0e4534` publicada. PR: pendiente.

## PENDIENTES DE ESTA TAREA

- Resultados de PGlite, vitest focal, `pnpm verify` y el CI de la PR (tabla de arriba).

## FUERA DE ALCANCE DETECTADO

- **El asiento después del COMMIT es best-effort**, igual que en Cobranzas. Si falla, el recibo
  queda sin asiento hasta que alguien lo vea en «Por contabilizar». Lo aceptó el Subdirector de
  Contabilidad el 2026-11-13: no se resuelve en esta tarea. Hacerlo atómico para cobros y
  confirmaciones necesita una SDD propia.

- **Reportes confirmados antes de la 0537:** tienen el monto en `paid_amount` y no tienen
  recibo. Hace falta conciliarlos (recibo retroactivo o revisión manual) antes del cierre del
  lote. Para medir cuántos hay en producción se necesita una autorización de lectura. Eso es una
  decisión de contabilidad con Sam.
- **Anular el recibo de un reporte confirmado** baja el pagado y deja el reporte «confirmado».
  Falta una regla, por ejemplo devolver el reporte o marcarlo.
- **`payment_receipts` tiene UPDATE para accounting por PostgREST** (0470). El guard de la 0537
  protege sólo el vínculo. Los otros campos siguen el hueco que ya anotó la 0467.

## Impacto documental y conocimiento

- Documento canónico nuevo: la spec 0630. No cambian `project-rules` ni los runbooks.
- Graphify, Archify y Obsidian: NO EJECUTADO. Los publica el Director desde main integrado.

## HANDOFF AL DIRECTOR

Al revisar, mirar la decisión del asiento y el orden 0533 → 0537 → app → 0422 → 0423. El smoke de
arriba es para prueba. Producción pide un OK nominal por cada migración.
