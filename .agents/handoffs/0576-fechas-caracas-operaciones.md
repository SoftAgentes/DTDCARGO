# Handoff · SDD-0576 · Fechas Caracas operaciones C1

Estado vigente: C1 implementado y validado localmente sobre264e0531. Verify3 terminó16/17, CIERRE INCOMPLETO por ledger de release no medido; límites y omisiones en el cierre al final. PR312 DRAFT. SDD0576 in-progress: C2/móvil pendientes, sin integración ni producción.
Owner: worker-0576c1-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0576-fechas-caracas-operaciones.
Rama: codex/sdd-0576-fechas-caracas-operaciones.
Base: 8729f7f4a3349b9b553c045c15a6adb37c943b98, PR311 en borrador.
Stub 58beb2ce adoptado por cherry-pick exclusivamente de su spec en eecfbbb18d4da58f4306503622c12821738eca91.
Guard y claim PASÓ; árbol inicial limpio, sin procesos consumidores observados y node_modules ausente.
Turno pesado inicial concedido a C1; instalación, pruebas, SQL, UI, verify y conocimiento se ejecutaron serialmente. Devuelto al Director tras knowledge/plugin, antes del cierre documental; claim conservado solo durante esa escritura final.
Contrato leído completo y SHA256 cotejado: f4c55bb8c97ac57d9b0c8ce0206d2aabe524e3009320be6c7c974674cfde76ff.
No se edita 0572-b, main, reserva ni otro worktree. Sin secretos, DB real, merge, deploy, BCV ni C2.

## Contrato íntegro aceptado antes de producto

# Caracas C1 · asignación ejecutable del Director

$worker

**Asignación autorizada de producto local, 20 de octubre de 2026.** Sam autorizó continuar la 2.1 localmente, respaldar las ramas y abrir PR en borrador durante el bloqueo de Actions. El Director coordina; este Worker es el único escritor de producto de C1. No requiere otra confirmación para pasos reversibles dentro de este contrato.

- **Task ID:** 0576-fechas-caracas-operaciones / C1.
- **Owner:** worker-0576c1-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
- **Repositorio principal de referencia:** C:/Users/AKX generator/Desktop/Developer/DTDCARGO. Solo lectura, sin desarrollo en main.
- **Worktree asignado y comprobado limpio:** C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0576-fechas-caracas-operaciones.
- **Rama:** codex/sdd-0576-fechas-caracas-operaciones.
- **Base inmutable:** 8729f7f4a3349b9b553c045c15a6adb37c943b98, cierre de 0572-b / PR #311.
- **Base de la futura PR apilada:** codex/sdd-0572-conversor-usd-sql. Conservar PR en borrador; no integrar.
- **SDD reutilizada:** docs/specs/0576-fechas-caracas/spec.md. Adoptar únicamente el stub reservado por commit 58beb2ce3bfb37cdddf070876e54468e0b5a6d2f, después de verificar guard y reclamar claim. No mover la rama de reserva ni copiar otros cambios.
- **Migración asignada por el Director:** 0533_fechas_caracas_operaciones. No aplicada; no autoriza producción.
- **Handoff propio obligatorio antes de producto:** .agents/handoffs/0576-fechas-caracas-operaciones.md. Conservar aquí el contrato completo y su aceptación.
- **Turno pesado:** concedido exclusivamente a C1. 0572-b devolvió su turno a las 02:07:40Z; la consulta de conocimiento del Director terminó a las 02:13:33Z. Una instalación/prueba/build/SQL/Docker/knowledge pesado a la vez. Los revisores solo leen. Informar antes y después de cada fase, limpiar solo procesos propios y devolver turno expresamente.

Antes de editar: leer las instrucciones aplicables, verificar raíz/rama/HEAD, guard, claim y ausencia de consumidor escritor; adoptar el stub y guardar este contrato. No hay .env ni dependencias copiadas: instalar con lockfile congelado dentro del turno, sin copiar secretos de otros árboles. Si se necesita ampliar la allowlist, detener solo esa ampliación y presentar la causa al Director.

## Resultado y dependencias

Primera entrega de la hora Caracas de 2.1: operaciones nuevas y sus lectores inmediatos usan el día America/Caracas de forma coherente para emisión, tasa, asiento, cobro y pago. Fechas explícitas e instantes de auditoría se conservan. Incluye Portal-reporte de pago completo y guarda de historia de gastos. Segunda entrega C2, posterior y separada, cambiará los anclajes anuales de b sin igualar las ventanas Portal/Studio.

La base final b es 8729f7f4a3349b9b553c045c15a6adb37c943b98. Producto, SQL y pruebas son idénticos al candidato 3b1de9861de7bf15e614d89eb13cd2de6cb54fb0; el último delta es solo spec y handoff, cotejado independientemente. Su verify terminó con salida 0 real y **CIERRE INCOMPLETO, 16/17**: build, 12.538 unitarias y contratos SQL locales aprobados; una unitaria y 20 navegaciones omitidas, una navegación recuperada y un aviso de cierre forzado; ledger productivo sin medir y CI sin aprobación por startup_failure. Se admite continuar localmente, sin aprobar release. 0571 ba43747a conserva el caller autoInvoiceForReceipt en cn/actions.ts:573; se mantienen sus dos rutas permitidas sin cambiar ni reactivar el disparador. La integración futura exige revalidar la base final, especialmente después de 0573.

Inventario remoto/local final completado por next-number: **486 refs más worktrees; siguiente SDD 0577, migración 0533**. Log C:/tmp/director-traspaso-20261020/numeracion-caracas-c1-asignacion-final.txt. Confirma la reserva existente 0576 y permite asignar 0533 a esta única tarea. Conserva advertencias históricas; no se renumeran migraciones.

**SDD0576 reservada y publicada** por el procedimiento create-only del repositorio: refs/heads/codex/sdd-reserve-0576-fechas-caracas, commit58beb2ce3bfb37cdddf070876e54468e0b5a6d2f; remoto canónico refs/heads/codex/sdd-reserve-0576. Stub docs/specs/0576-fechas-caracas/spec.md. Reserva de metadata, sin implementación ni integración. Log C:/tmp/director-traspaso-20261020/reserva-caracas-0576.txt. El futuro Worker adopta el stub en su árbol después de claim, sin mover ramas ajenas.

Migración C1 asignada: **0533_fechas_caracas_operaciones**. C2 tomará un número posterior tras inventario nuevo; no está reservado aquí. El handoff de C1 no se comparte con otro escritor.

## Decisiones y aceptación

1. Día de negocio YYYY-MM-DD de America/Caracas. 2026-10-21T02:30Z corresponde al20; a04:00Z comienza21. Primitive pura lib/shared/fechas-caracas.ts sin DB/Studio/dependencia nueva, con reloj inyectable, fecha de instante válido y límites día/mes inicio incluido/fin excluido. Zona IANA, sin extender un offset fijo a la historia. No aceptar una fecha sin hora como instante ni normalizar calendario inválido. todayCaracasISO/hoyCaracas actuales mantienen su interfaz compatible.
2. Fechas elegidas por la persona conservan valor exacto; omisión programática admitida permite fallback, vaciar un campo no equivale a hoy. Capturar ancla confiable una vez por operación antes de esperas y reutilizar día para FX/documento/posting. Instantes created_at/occurred_at/posted_at/updated_at/auditoría conservan UTC/timestamptz. No convertirlos a date en almacenamiento ni cambiar timezone global.
3. Factura crear/actualizar tasa/emitir/duplicar: mismo día para VES y emisión, tasa del día exacto y mecanismos CAS/override/aviso persistido de0569 conservados. No recalcular con catálogo al contabilizar. Mantener importes, IVA, redondeo, moneda, correlativo y vencimiento explícito. 0128 retorna issued_at aditivo y el caller lo valida estrictamente para el asiento. Con outcome=invoiced e invoice_id válido, solo si el campo aditivo está ausente en una DB anterior, leer id/tenant_id/issued_at de ESA factura, filtros id+tenant confiable y deleted_at IS NULL. Error/ausencia/ambigüedad/fecha inválida: no llamar poster, otra RPC ni reloj; informar factura ya emitida y asiento pendiente por el canal existente. No tratar un campo presente pero inválido como ausencia ni ampliar el resultado already_invoiced. MIGRATE-FIRST sigue obligatorio; el readback conserva la fecha realmente persistida, sin inventar una fecha para convivencia.
4. Nueve fallbacks de ocho posters solo sustituyen hoy UTC cuando input.entryDate está omitida según contrato; explícita conserva bytes. Identificación conserva la fecha real del recibo. Depreciación por mes explícito y posted_at no cambian. Cobros/CxP/pagos/formularios/lecturas de vencido toman Caracas, conservando filtros/estados/sumas y fechas explícitas. Resolver issueDate antes de buscar FX, sin un segundo hoy después.
5. Gastos nuevos capturan instante servidor antes del guard, derivan su día Caracas y persisten ese mismo instante. Consultas por día/mes usan ambos límites, CSV/fila presentan la fecha Caracas; importes USD de b permanecen intactos. Edición contable lee origen, cierre y asiento(s) vivos con autorización/tenant antes de cualquier update/void/post/correlativo/evidencia. Si el día nuevo derivado difiere del entry_date vivo, bloquear con explicación persistente y vía gobernada, sin re-fechar historia. Error/lectura parcial/múltiples asientos no son ausencia; sin limit1. Cero asientos solo se reconoce tras lectura válida completa y no permite saltar cierre. La lectura de cierre es estricta dentro de actions.ts: no usar como prueba de ausencia getAccountingSettings, que hoy tolera PGRST116/PGRST205/42P01 como abierto. Éxito sin fila se distingue de error/tabla ausente/ambigüedad/campo inválido; estos últimos bloquean antes de mutar. Edición descriptiva que no repostea no inventa nueva fecha; conserva su política de cierre. SQL void comprueba cierre por origen y por asiento vivo en sus fechas respectivas, con locks/tenant/actor/motivo/auditoría intactos. No se atribuye atomicidad completa ni solución0575 a esta guarda.
6. Portal nuevo rechaza fecha futura Caracas en UI, action, transporte y SQL, antes de nueva evidencia cuando el rechazo es conocido. Recovery idéntico de reporte antes aceptado puede recuperar su resultado con fecha que ahora parezca futura; solo después de autorización vigente, principal activo, relación tenant/factura y coincidencia de actor/tenant/request/report/verb/input_hash. No crear reporte futuro usando una bandera, no devolver resultado por mera existencia de request/report, no reconstruir evidencia faltante ni aceptar solo nombre/Duplicate. Conservar identidad, payload y prueba del intento incierto. Recuperación verifica los bytes originales, sin recrear objeto. SQL distingue replay autorizado de creación nueva bajo lock y vuelve a imponer frescura a toda creación. Principal revocado, payload distinto, actor/tenant ajeno, prueba distinta/ausente o respuesta incierta no autorizan escritura ni éxito. No crear payment_receipts ni adelantar2.7.
7. SQL nuevo cambia defaults journal_entries.entry_date, payment_receipts.received_at, supplier_bills.issue_date y supplier_payments.paid_at; fallbacks nulos de0467/0468, cierre de void_expense_governed0340, reloj/frescura-replay del motor privado0464 y emisión/fecha retornada0128 si el caller sigue activo. Copiar las definiciones vigentes completas y hacer cambios temporales mínimos, con preflight/postflight/transacción, identidades/ACL/owner/retornos/locks/auditoría preservados. No editar migraciones históricas, ni RLS, ni motor monetario.
8. **Corrección normativa del diseño anterior:** register_collection_receipt0467 y register_supplier_payment_order0468 son SECURITY INVOKER y EXECUTE authenticated, denegado service_role. Se preserva esa frontera exacta. La frase service-only de la propuesta original es incorrecta para ellas; corresponde a sales_order_claim_and_invoice0128. No elevar ni trasladar al cliente administrativo para acomodar pruebas.
9. No nuevo RPC público de reloj ni cambio global de isPeriodClosed. Las funciones ya existentes conservan firma/retorno y privilegios; fechas nuevas de payload son aditivas cuando corresponda. Si aparece un símbolo API nuevo, justificar ampliación y declaración de degradación antes de implementarlo. La baseline solo registra la espera de la nueva migración; jamás falsea0495/0496/0497/0498.

10. Contexto JS obligatorio para creación en el transporte/validador: variante `{kind:'new', businessDay}` con ancla servidor o `{kind:'recovery-candidate'}`. La action elige la variante solo tras autorización y lookup del reporte propio; jamás acepta ese permiso desde FormData, _prev o una bandera pública. No se agrega al payload RPC ni al input_hash. Confirm/reject conservan su contrato. Ser candidato no prueba replay: el motor SQL conserva la autoridad final. Frescura nueva se valida antes de upload nuevo; recovery solo descarga/verifica bytes del objeto anterior. **El replay SQL0464 retorna antes de comprobar Storage:** su evidencia es recibo/identidad/hash/path históricos; la garantía sobre bytes actuales pertenece a action/helper. No mover ni inventar verificación de bytes en SQL por este cambio temporal.

11. Lecturas mínimas de la guarda de gastos, concretadas por revisión: `accounting_settings` por tenant_id, columnas tenant_id/closing_date, cardinalidad0/1; null es apertura admitida y fecha no nula debe ser calendario válido. Asientos `journal_entries` por tenant_id + expense_id + status='asentado' + deleted_at IS NULL, columnas id/tenant_id/expense_id/source/entry_date/status/deleted_at, cardinalidad0/1 y relación/fecha válidas. Origen expenses por id+tenant/no eliminado, datos necesarios para conservar changed y occurred_at. Rechazar error/tabla ausente/múltiple/incoherencia, aunque el índice0132 normalmente asegure unicidad; si se limita a2 para detectar ambigüedad,2 siempre bloquea. RLS actual permite lectura tenant: no ampliarla. La defensa SQL de cierre también permanece en trigger0133/0493 sobre fechas OLD/NEW del asiento vivo.

## Allowlist C1 autorizada, 60 rutas

Esta es la lista exacta de escritura autorizada. No obliga a modificar toda ruta. Toda ampliación debe tener causa y aprobación del Director antes de editar. docs/specs/README.md solo mediante generador. No debilitar verificadores, límites de pruebas ni políticas para obtener verde.

```text
lib/shared/fechas-caracas.ts
lib/studio/bitacora/dates.ts
lib/studio/rate-types.ts
app/studio/(app)/facturacion/actions.ts
app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx
lib/studio/invoice-types.ts
lib/studio/payment-types.ts
lib/studio/treasury/types.ts
lib/studio/treasury/treasury-actions.ts
lib/studio/treasury/bill-queries.ts
app/studio/(app)/cobranzas/_components/CobranzaDrawer.tsx
app/studio/(app)/cobranzas/_components/UnidentifiedPaymentDrawer.tsx
app/studio/(app)/tesoreria/_components/BillDrawer.tsx
app/studio/(app)/contabilidad/_components/EntryDrawer.tsx
app/studio/(app)/contabilidad/page.tsx
lib/studio/accounting/invoice-posting.ts
lib/studio/accounting/receipt-posting.ts
lib/studio/accounting/bill-posting.ts
lib/studio/accounting/supplier-payment-posting.ts
lib/studio/accounting/expense-posting.ts
lib/studio/accounting/claim-posting.ts
lib/studio/accounting/referral-credit-posting.ts
lib/studio/accounting/settlement-posting.ts
app/studio/(app)/gastos/actions.ts
lib/studio/expense-queries.ts
app/studio/(app)/gastos/_components/GastosClient.tsx
lib/studio/sales-orders/actions.ts
app/portal/(app)/facturas/[code]/reportar/page.tsx
app/portal/(app)/facturas/[code]/reportar/actions.ts
app/portal/(app)/facturas/[code]/reportar/PaymentReportForm.tsx
lib/portal/payment-report-types.ts
lib/portal/payment-report-commands.ts
lib/portal/payment-proof.ts
lib/shared/__tests__/fechas-caracas.test.ts
app/studio/(app)/facturacion/__tests__/factura-congela-la-tasa.test.ts
lib/studio/__tests__/invoice-types.test.ts
lib/studio/__tests__/payment.test.ts
lib/studio/treasury/__tests__/treasury.test.ts
lib/studio/treasury/__tests__/treasury-payments.test.ts
lib/studio/treasury/__tests__/cxp-congela-la-tasa.test.ts
lib/studio/accounting/__tests__/fechas-caracas-posting.test.ts
app/studio/(app)/gastos/__tests__/fechas-caracas.test.ts
lib/studio/__tests__/expense-queries-caracas.test.ts
app/studio/(app)/__tests__/fechas-caracas-formularios.test.tsx
lib/studio/sales-orders/__tests__/invoicing.test.ts
lib/portal/__tests__/payment-report-actions.test.ts
lib/portal/__tests__/payment-report-commands.test.ts
lib/portal/__tests__/payment-report-ui.test.tsx
lib/portal/__tests__/payment-reports.test.ts
lib/portal/__tests__/payment-proof-retry.test.ts
lib/studio/__tests__/fechas-caracas.migration.test.ts
lib/portal/__tests__/payment-report-caracas.migration.test.ts
scripts/tests/fechas-caracas-postgrest.mjs
supabase/migrations-baseline.json
supabase/pending-migration-symbol-declarations.json
docs/specs/README.md
supabase/migrations/0533_fechas_caracas_operaciones.sql
supabase/tests/0533_fechas_caracas_operaciones.test.sql
docs/specs/0576-fechas-caracas/spec.md
.agents/handoffs/0576-fechas-caracas-operaciones.md
```

## Validación exigida y límites

ROJO→VERDE sobre base elegida para errores de UTC, cambio entre awaits, cota superior ausente de gastos, re-fecha implícita, replay bloqueado por frescura y nueva creación futura aceptada. Casos02:30Z/03:59:59.999Z/04:00Z, mes/año/leap day, TZ navegador/Node/sesión, fecha explícita/vacía/inválida, historia IANA pertinente, decimales/estado monetario b conservados. Componentes y handlers reales; no limitarse a greps o pruebas espejo.

Contrato SQL carga migración nueva real e intacta primero y registra hash/definiciones, defaults, firmas/owner/ACL/tenant/auth/locks/contador/auditoría. Para instantes deterministas puede instrumentar **exclusivamente el reloj** en copias de definiciones/defaults en fixture sintética: ancla exacta y número esperado, aborto ante deriva, sin tocar permisos/hash/locks/proof. Separar comprobación real de fase con reloj instrumentado. SET timezone solo cambia sesión, no simula otro instante. Probar reloj secuenciado/captura única en las rutas pertinentes, sin simular resultados financieros. No añadir helper SQL productivo ni RPC de reloj para facilitar tests.

Probar replay idéntico y negativos por cada campo/actor/tenant/revocación/prueba, futura nueva por todas las capas y cero nuevas mutaciones de reporte/auditoría/evidencia/saldo. SQL/HTTP local desechable con JWT sintéticos, sin Auth alojado ni credenciales reales. No exponer motor privado. Mutantes proporcionales exigen el fallo funcional exacto, no cualquier error; preservar fuente y recibos iniciales.

Tipos/lint/docs/guardas y pnpm verify canónico sobre SHA guardado, uno por vez con turno exclusivo. Registros PASÓ/FALLÓ/NO EJECUTADO/NO DISPONIBLE, con SKIPs y límites. UI sustancial pasa /ui-check: componentes reales, fechas/datos/error persistente, teclado,200%zoom,390px,claro/oscuro según política aplicable. No certificar teléfono real ni todo A11Y por fixture.

SGE-00: matriz de los doce principios, DAT/FRM/A11Y/ERR/NUM aplicables, cumplimiento/no aplica/excepción/no conformidad con evidencia. Sin nuevo componente global/calendario ni rediseño. Lee AGENTS, Worker/runbook, project-rules, AGENT-BRIEF, políticas, BRAND/diseño y Norte backend antes de implementar.

Este encargo autoriza commits selectivos, push de la rama propia y PR **en borrador apilada sobre b**, siempre con rama/claim verificados y handoff actualizado. Adjuntar toda PR creada a este chat con la herramienta correspondiente. No autoriza merge, auto-merge, despliegue, escrituras VPS, cron instalado, pagos, datos reales, migraciones reales ni secretos/env copiados. No tocar main, reservas ajenas, 0541/0571/0573/0574/0575, 2.3, correlativos/impuestos/KPIs ni recibos 2.7. La 0495 aplicada no se repite. Toda futura migración requiere el OK nominal de Sam y release según runbook. MIGRATE-FIRST y convivencia se describen y prueban; callers antiguos que envían fecha UTC explícita no se corrigen a escondidas. La coherencia general no se declara antes de retirar la versión antigua y verificar recorridos.

## Preflight del Director y secuencia de ejecución

- Dictamen C1 de diseño **recibido y aceptado**, sin bloqueante estructural identificado: C:/tmp/director-traspaso-20261020/caracas-c1-revision-diseno-codex.md, actualizado SHA2565643ac1f8831464f92d6361a7e228398149ff8f92ffe92c0255468c45e686b6d. Su addendum coteja el borrador60rutas hash a312fe261d067fee39d1628f5663a74d7d0bae504c55a7edc87302bdba6b956a contra3b1de986:47rutas existentes/13nuevas previstas; contratos Portal/gastos/posting/SQL sin cambio respecto de a30; las dos metadata conservan0498 y esperas anteriores. Campos/ACL/replay/0128/reloj precisados arriba. No aprueba implementación futura ni disponibilidad global de0499.
- Base final, dictamen documental y devolución del turno de b comprobados. Informe financiero/UI final SHA256 6cdc54ad1632baeddce8c81342c204875162506e86ff52976b588ce70c756484. El Director acepta el cierre local con límites, no integración/producción.
- Árbol/rama/base creados mediante harness y comprobados limpios en 8729f7f4; owner designado arriba. Claim y adopción del stub corresponden al Worker antes de editar producto.
- Allowlist de 60 rutas cotejada en preparación; el delta 3b→8729 es únicamente documental. Inventario nuevo confirma 0533, asignada aquí. Worker verifica su árbol y registra cualquier deriva sin inventar otra numeración.
- Firma JS de recuperación, fallback de 0128, lectura estricta de cierre y ACL precisadas arriba son aceptación obligatoria; no quedan decisiones aplazadas sobre esos contratos.
- Ejecutar en este orden: adopción y contrato → pruebas funcionales ROJO → implementación acotada → VERDE y mutantes → SQL/HTTP sintético → checkpoint de SHA y revisión independiente → reparaciones necesarias → verify canónico serial → documentación/knowledge/limpieza/push/PR/handoff. No ejecutar verify con hallazgos materiales conocidos todavía abiertos.
- Informar al Director el primer checkpoint de adopción (raíz/rama/claim/stub/contrato/allowlist), el ROJO funcional y el candidato de revisión. Durante ejecución completar la tarea con autonomía dentro de esta aceptación. No absorbas hallazgos ajenos ni adelantes C2 o BCV.

Fuentes: caracas-alcance-actual-codex.md SHA25697e4fd33afb41efde0d27e232d858bcd8179fa7a7672d239f508e3fbf252a30b, con corrección ACL anterior; DAT-01 v1.0 consultada completa. Documentación primaria consultada: https://www.postgresql.org/docs/17/functions-datetime.html y https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat. No es prueba de implementación ni nueva regla del repositorio.

Ajuste del Director posterior a la revisión de diseño de59rutas: se permite como ruta60 `supabase/pending-migration-symbol-declarations.json` exclusivamente para cotejar y actualizar los callSites y anclas de líneas reales desplazados por esta tarea. El checker exige sitio exacto y `evidence.contains` en su línea. Mantener el cierre/degradación real de cada símbolo pendiente; sin exenciones ampliadas, declaraciones ficticias, modificación del gate ni cambio del estado aplicado de migraciones. Si la base final ya incluye un sello, no resucitar la declaración retirada. Recomendación independiente SQL recibida y aceptada. La ruta es permitida cuando el delta la requiere, no una obligación de producir cambios artificiales.

## Addendum íntegro adoptado antes de las cuatro rutas nuevas · SHA256 1d82124240dd1ad7f3666591d572219d23ded116ecabd871ddd88a364e4d86a6
# C1 · ampliación autorizada por el Director a 64 rutas

Contrato vigente: `0576-caracas-c1-asignacion-worker.md`, SHA256 `f4c55bb8c97ac57d9b0c8ce0206d2aabe524e3009320be6c7c974674cfde76ff`. Se conserva íntegro y este addendum se agrega a la spec y al handoff del mismo Worker antes de editar las cuatro rutas nuevas. Mismo owner, rama, worktree, base y turno; no crea una segunda tarea ni cambia la migración 0499.

## Decisión autorizada

El Director revisó las fuentes por objetos de la base `8729f7f4`: `registerCollectionFor` lee la factura antes de validar el input y los wrappers de Cobranzas/Tesorería esperan sesión y permiso antes de delegar. Una fecha omitida puede resolverse después de cruzar medianoche. Es una omisión concreta del alcance original, porque su aceptación ya exige capturar el día antes de las esperas.

Se autorizan exactamente estas cuatro rutas adicionales; la allowlist pasa de 60 a **64 rutas**:

```text
lib/studio/collections-actions.ts
app/studio/(app)/cobranzas/actions.ts
app/studio/(app)/tesoreria/actions.ts
lib/studio/__tests__/fechas-caracas-actions.test.ts
```

Alcance limitado a `registerCollectionFor`, los wrappers `registerCollection` y `registerUnidentifiedPayment` de Cobranzas, y `createBill`/`registerPayment` de Tesorería. El cambio resuelve `receivedAt`, `issueDate` o `paidAt` **solo cuando está omitida** al entrar y antes del primer await, y propaga esa misma fecha al delegado. No se toca otra acción de esos archivos. Las correcciones de los delegados ya incluidos en las 60 rutas conservan su alcance original.

## Criterios y límites

- Fecha explícita, vacía o inválida conserva su valor hasta la validación existente; no convertir vacío/null en hoy ni normalizar calendario.
- Captura pura del reloj antes de esperar, sin adelantar lecturas de negocio, mutaciones, correlativos, evidencias ni permisos. Conservar sesión/RBAC/RLS/tenant y su resultado de denegación antes de los efectos existentes.
- Propagar la fecha elegida sin recapturar un fallback más abajo. Conservar importes, monedas, FX, firmas de negocio, estados, IDs, auditoría, best-effort y mensajes de resultado, salvo la fecha de negocio objeto de la tarea.
- No mutar el objeto de entrada del llamador ni añadir un fallo nuevo por acceder prematuramente a un payload malformado. La captura de una omisión no sustituye la validación posterior ni autoriza éxito.
- ROJO→VERDE sobre handlers y delegados reales con I/O sintética: cruce dentro de sesión/guard/read, fecha explícita/omitida/vacía/inválida y denegación sin efectos. Registrar fuente/base/recibos y probar las aserciones funcionales; ningún doble de éxito incondicional.
- Revalidar tipos/lint y el conjunto focal; incluir estas rutas en el checkpoint inmutable y su revisión. Mantener un solo turno pesado.

Autorización de Sam para continuar localmente y subir PR en borrador vigente, reiterada al retirarse a dormir. El Director resuelve esta ampliación técnica dentro de la tarea, sin solicitar otro permiso rutinario. No autoriza merge, deploy, escrituras VPS, datos reales, migraciones reales ni ampliaciones posteriores. 0495 no se repite. C2 y BCV siguen fuera de C1.



# C1 · ampliación del inventario exacto de lecturas, ruta 65

El Director autoriza una única ruta adicional a las 64 ya permitidas:

```text
scripts/__tests__/invoice-read-boundary.test.mjs
```

Se conserva el contrato original `f4c55bb8c97ac57d9b0c8ce0206d2aabe524e3009320be6c7c974674cfde76ff` y el addendum de acciones `1d82124240dd1ad7f3666591d572219d23ded116ecabd871ddd88a364e4d86a6`. La allowlist vigente queda en **65 rutas**, misma tarea/owner/rama/turno/0533. Guardar este addendum antes de editar la ruta nueva.

## Causa y cambio permitido

El ROJO original del inventario informa exactamente una lectura nueva: `lib/studio/sales-orders/actions.ts: 1`. El Director leyó ese readback en el árbol C1 y el inventario/analyzer completo. Es la convivencia ya autorizada en la decisión 3 para obtener `issued_at` realmente persistida cuando una DB anterior omite el campo aditivo de 0128; no una lectura financiera nueva sin revisión.

Actualizar únicamente el mapa exacto añadiendo esa ruta con valor 1, el número de archivos **19→20** y total de llamadas **43→44**, con comentario de SDD-0576 que explique el guard, tenant y propósito. Ajustar en este mismo test la frase histórica «único caller ADMIN» que dejaría de ser cierta, conservando su explicación y los candados de referido existentes. Ningún cambio del analyzer, raíces, prefiltro, exclusiones, timeouts, widgets o pruebas de RBAC.

La lectura nueva usa el cliente ADMIN recibido por el motor Warehouse ya existente, tras el gate vigente y el resultado de RPC `outcome='invoiced'` con `invoice_id` UUID válido. Solo la ausencia estricta de la propiedad `issued_at` habilita consultar; propiedad presente inválida bloquea el asiento. Selección mínima `id, tenant_id, issued_at`, filtros por el id devuelto y tenant confiable del caller, `deleted_at IS NULL`, límite 2 para detectar ambigüedad y cardinalidad exactamente 1, identidad y calendario estrictos. Error/ausencia/multiplicidad/fecha inválida dejan factura emitida y asiento pendiente; sin otra emisión, reloj sustituto ni expansión a `already_invoiced`. Se preserva el control financiero de la RPC y su frontera de servicio.

El ajuste del inventario no es una autorización genérica de ADMIN ni un cambio de la RLS. Conservar sus cuatro pruebas, todas las negativas funcionales del readback y los mutantes proporcionales. ROJO→VERDE del gate exacto, después tipos/lint/focal y revisión por SHA. Si aparece cualquier otra diferencia de mapa/conteo, no incorporarla por conveniencia: reportarla al Director.

Autorizaciones de publicación local/draft vigentes; sin merge, despliegue, VPS, DB real o migración real. El Director no edita producto. C2 y BCV continúan fuera de C1.

## Checkpoint APP · 2026-10-21, previo a SQL

Implementación APP en el árbol sobre eecfbbb1 (base8729): helper puro IANA y calendario/instante estrictos; captura de día antes de awaits; fallbacks de nueve posters; readback estricto de issued_at; guarda histórica de gastos; contexto obligatorio Portal nuevo/recovery, bytes anteriores sin recrear evidencia y formularios existentes. No se ha implementado todavía0533 ni medido SQL/HTTP/browser/verify.

Evidencia externa: C:/tmp/director-traspaso-20261020/0576-codex-validation/. Cada corrida tiene .log, .json de Vitest cuando corresponde y -receipt.json con PID, inicio/fin y salida. Estas corridas pertenecen al árbol previo al primer commit de APP, no a la base sin cambios; el ROJO conserva su producto anterior en los recibos.

| Comprobación | Resultado real | Alcance y límite |
|---|---|---|
| adopción/claim/lockfile | PASÓ | guard, stub eecfbbb1; instalación0; lockfile SHA25651550316928cf4ee17696eaa4c87f4e9e944146d2c2c9ca229f82caed4051608 intacto, sin secretos copiados |
| red-1 / red-2 | FALLÓ funcional esperado | 20/210 y6/44 fallos: UTC, omisión/vacío, ventanas, cambio entre awaits |
| red-portal-context / red-expense-history | FALLÓ funcional esperado | 9/263 y8/9: contexto/recovery, historia y lecturas estrictas |
| green-core-1 | PASÓ | 12archivos543/543,0SKIP; no SQL ni navegador |
| red-posting-order → green-posting-order-1 | FALLÓ esperado → PASÓ | 22/56 funcionales; luego56/56, nueve posters y emisión/readback0128 |
| red-forms-1 | FALLÓ mixto | 8fallos funcionales y1selector incorrecto de fixture; no contar selector como defecto producto |
| red-forms-2 → green-forms-1 | FALLÓ esperado → PASÓ | 9/31 funcionales; luego31/31, componentes reales con IO sintética; recuperación con fecha aparentemente futura pulsa Reportar pago; no prueba browser aún |
| red-anchor-history-supplement → green-anchor-history-supplement | FALLÓ esperado → PASÓ | 5/25; luego25/25: paidAt antes de leer y monto histórico malformado bloqueado |
| red-actions-addendum → green-actions-addendum | FALLÓ esperado → PASÓ | 13/47; luego47/47: handlers/delegados reales, sesión/guard/read, raw congelado, inválidos y denegación sin efectos |
| tipos-app-1 / tipos-app-2 | FALLÓ de fixture corregido | stage inválido en fixture y anotación de índice del nuevo test; se conservaron las aserciones |
| typecheck-app-3 | PASÓ | salida0,02:51:44.388–02:52:01.102Z |
| lint-app-1 → lint-app-2 | FALLÓ corregido → PASÓ | prefer-const de fixture; luego salida0 sin warnings,54rutas TS/TSX,02:52:08.633–18.793Z |
| red-inventory-1 | FALLÓ contractual esperado | 1/4, solo nuevo readback sales-orders:1; ampliación65 autorizada, comparación exacta19→20 y43→44; no cambio del analyzer |
| green-app-focal-1 | PASÓ | 19archivos697/697,0SKIP,02:53:30.261–02:54:05.782Z, incluye inventario corregido y todos los tests APP modificados |

No se suman casos repetidos entre fases para inflar cobertura. Sigue pendiente el mensaje de caller CN señalado por Director (factura emitida/asiento pendiente no debe prefijarse como no facturada), su ampliación exacta y regresión antes del checkpoint aceptable. No se ha cambiado el disparador de negocio.

Conocimiento: fuentes de tarea guardadas; integración, estructura/semántica Graphify, Archify, preview y publicación Obsidian NO EJECUTADAS en C1. Se evaluarán al cierre conforme al turno; ninguna cobertura de b se atribuye a C1.

# C1 · estado visible de factura emitida con asiento pendiente

El Director autoriza tres rutas adicionales a las 65 vigentes:

```text
lib/studio/sales-orders/invoicing.ts
app/studio/(app)/cn/actions.ts
app/studio/(app)/cn/__tests__/auto-invoice-caracas-event.test.ts
```

La allowlist pasa a **68 rutas**, misma tarea/owner/rama/turno/migración0533. Conservar contrato original y addenda previos; guardar este documento en spec/handoff antes de las tres nuevas ediciones.

## Hallazgo demostrado por lectura

El nuevo readback autorizado de0128 devuelve actualmente `ok:false` y una razón «Factura … emitida; asiento pendiente» cuando no puede comprobar su fecha. El caller vigente en CN conserva el evento `No se facturó automáticamente: ${inv.reason}` para todo fallo no-notApplicable. El resultado compuesto sería contradictorio aunque la RPC ya confirmó emisión. Esto incumple el estado verdadero exigido por la decisión3 y ERR/SGE del contrato. No es una nueva automatización ni un cambio de la decisión de facturar.

## Ajuste mínimo autorizado

1. En `sales-orders/invoicing.ts`, ampliar de forma aditiva y explícita el tipo del resultado para distinguir **emisión confirmada, asiento pendiente** de **no emitida**. Usar un discriminante/propiedad tipada (por ejemplo `invoiceEmitted:true` en el resultado pendiente); no analizar texto ni sobrecargar `notApplicable`.
2. En el `sales-orders/actions.ts` ya autorizado, marcar únicamente el resultado de la rama `outcome='invoiced'` que no puede confirmar la fecha, conservando `ok:false`/pendiente y los bloqueos del poster/readback. Un error de red/RPC sin emisión confirmada no recibe ese marcador. No transformar un asiento pendiente en un éxito contable ni ampliar `already_invoiced`.
3. En `cn/actions.ts`, cambiar exclusivamente la presentación del evento que consume ese resultado: si la emisión está confirmada y el asiento pendiente, guardar una descripción verdadera que lo diga, con la recuperación/revisión ya prevista; los fallos de emisión conservan su prefijo y los éxitos su evento actual. Mantener ubicación y condiciones de invocación, sesión/RBAC/tenant, consolidación, notificaciones, timeline, IDs, motivo y best-effort. No activar otro disparador, refacturar ni agregar un asiento o correo.
4. Nuevo test focal de la action/caller real con I/O sintética y aserción del evento persistido: primero ROJO del texto contradictorio, luego VERDE para fecha presente inválida/readback fallido, éxito normal, fallo real/no aplicable, actor/tenant pertinente y cero segunda emisión/poster indebido. La prueba debe atravesar la propagación del resultado real; un doble que inventa el resultado final por sí solo no demuestra la reparación. Reutilizar patrones existentes sin ampliar otras rutas.

El mapa de lecturas de facturas sigue exigiendo exactamente20archivos/44llamadas después del addendum de inventario. Este ajuste de tipo/copy no habilita nuevas lecturas ni modifica el analyzer. Validar focal/tipos/lint y congelar checkpoint app para revisión independiente antes del cierre general. No declarar navegador real aprobado por Vitest/JSDOM.

La ampliación concreta resuelve un hallazgo propio de C1 dentro de la delegación de Sam para avanzar sin detenerse. No absorbe0575 ni promete atomicidad de emisión+asiento; el pendiente permanece explícito. Sin merge, deploy, VPS, datos reales ni migración real. 0495 no se repite.

## Suplemento antes del checkpoint APP · aviso CN

Addendum68 leído completo y hash04c5fc420ac77b7c018e21e3572c61fc2f21c9220addd3ffea99bcc23aac823b cotejado antes de editar. Se resuelve el pendiente del checkpoint anterior: AutoInvoiceResult conserva ok:false y añade invoiceEmitted?:true únicamente tras outcome=invoiced y fecha no comprobable. CN usa ese discriminante para conservar el mensaje verdadero de factura emitida/asiento pendiente; no inspecciona texto ni cambia el disparador, las autorizaciones, consolidación o efectos.

- red-cn-event-1: FALLÓ funcional esperado2/7; ambos casos recibían el prefijo contradictorio. Cinco controles ya pasaban. No se mockea autoInvoiceForReceipt: action CN→motor real→DB sintética→evento persistido.
- green-cn-event-1: PASÓ48/48 en3archivos,0SKIP; suplemento del foco697, no suma de cobertura distinta. Fecha presente inválida/readback fallido, éxito, error RPC, no aplicable, guard denegado y tenant ausente; cero segunda emisión/poster indebido.
- typecheck-app-4: PASÓ salida0,02:58:17.489–02:58:44.335Z.
- pending-symbols-app-2: PASÓ salida0,02:54:36.771–02:55:17.477Z, con2grupos de esperas amarillas declaradas.69anclas reales ajustadas; no estado aplicado nuevo.
- docs-app-1: PASÓ salida0. Scope medido62rutas cambiadas de68permitidas, outside=[]; diff8729→árbol sin whitespace errors. SQL0533 continúa solo preparado fueraGit, NO EJECUTADO.

Matriz SGE: .01/.02/.06/.07/.09/.11 cuentan con evidencia APP focal descrita; .04/.05 quedan pendientes de SQL/HTTP, .10 de navegador y .12 conserva límite de autorización. NUM-01: importes/IVA/monedas intactos por diff y controles de flujo, no aceptación financiera nueva. La guardia histórica de gastos no promete atomicidad0575.
Lint-app-delta-3 PASÓ salida0 sin warnings,02:59:15.716–23.363Z, únicamente las5rutas del delta tipo/copy/test/inventario. Primer checkpoint APP listo para revisión independiente; SQL/HTTP, mutantes y verify permanecen pendientes.

## Revisión APP · transporte malformado de asiento (P2)

Checkpoint publicado: `5dadb10358811351384015dbddc698f3f430b93c`, PR [#312](https://github.com/SoftAgentes/DTDCARGO/pull/312) OPEN/DRAFT apilada sobre b `8729f7f4`. El Director demostró que una respuesta de transporte `error:null/data:[null]` (también false/0/cadena vacía) pasaba como ausencia por truthiness. No se afirma que PostgREST normal la produzca; el contrato exige que solamente `[]` sea ausencia.

Corrección acotada a `gastos/actions.ts` y su prueba ya permitidas: una fila requiere objeto válido y conserva todas las validaciones de identidad/fecha. El doble inyecta el transporte malformado después de ejecutar los filtros; por tanto la regresión llega al guard real y no aprueba por una excepción anterior del mock. Las cuatro variantes verifican cero UPDATE, correlativo, upload, void y post. Permanecen los controles de ausencia legítima, fecha histórica válida/cerrada y coincidencia de la fecha al repostear.

Evidencia externa en `C:/tmp/director-traspaso-20261020/0576-codex-validation/`:

- `red-expense-malformed-1`: FALLÓ funcional esperado, 4 fallos / 18 casos, 03:04:28.312–03:04:30.713Z; recibió ok:true donde correspondía rechazo.
- `green-expense-malformed-1`: PASÓ 18/18, 0 SKIP, 03:04:39.932–03:04:42.303Z.
- `lint-expense-malformed-1`: PASÓ salida0 sin warnings, 03:04:43.039–03:04:51.253Z.
- `typecheck-app-malformed-1`: FALLÓ salida2 únicamente por declaración de import del arnés SQL aún en preparación; no defecto de este handler. Se tipó el enlace del test al arnés sin silenciar reglas. `typecheck-app-malformed-2`: PASÓ salida0, 03:07:34.007–03:07:49.665Z.

El ajuste se guarda en commit separado sin reescribir5dad. SQL sigue en preparación y su primer ROJO funcional de default Caracas se conserva separado; no se ha incorporado ni aplicado0533 al checkpoint APP. No se amplía la allowlist68 ni se certifica atomicidad0575.
## Checkpoint SQL C1 · revisión parcial, sin aplicar

0533 contiene las cinco definiciones completas anteriores (0467/0468/0340/0464/0128), con delta temporal acotado, y los cuatro defaults. No incorpora helper SQL productivo. El día de negocio se captura antes de autorización/locks; los timestamps de auditoría no cambian. La fecha explícita se conserva, incluso si el caller anterior la deriva de UTC. El motor privado0464 devuelve el recibo idéntico autorizado antes de validar frescura de una nueva creación; sigue comprobando actor/tenant/request/report/verb/hash y bloqueando filas. SQL no comprueba bytes actuales de Storage: esa garantía pertenece a la action y su helper.

La migración exige una transacción, lock_timeout5s/statement_timeout60s; ALTER DEFAULT toma ACCESS EXCLUSIVE en cuatro tablas hasta COMMIT, sin backfill. Preflight compara firmas, cuerpos, ACL/owner/defaults/cierre/auditoría; postflight exige cuerpos y catálogo conservados. No GRANT nuevo ni cambio RLS.0467/0468 siguen INVOKER authenticated;0464 privado mantiene EXECUTE authenticated preexistente;0128 sigue service_role. La espera0533 es MIGRATE-FIRST: paquete/previa/OK nominal antes de DB, despliegue posterior. Rollback de app mantiene SQL compatible; rollback SQL requiere solo restaurar cinco cuerpos y cuatro defaults revisados, sin ejecutar migraciones históricas completas ni re-fechar filas.

El contrato carga0533 REAL sin alterarla y toma catálogo/filas antes y después. Después instrumenta exclusivamente anclas exactas de reloj en copias de los cuerpos/defaults, abortando ante deriva; conserva hash, locks, autorización y prueba. Fecha fija02:30Z, límites03:59:59.999/04:00, mes/año/bisiesto e IANA2010; sesiones UTC/Caracas/Shanghai; reloj secuenciado confirma una captura por operación. Fechas explícitas/centavos, gasto original y asiento histórico/cierre, cero nuevas mutaciones en negativos, replay autorizado y cada campo/actor/tenant/revocación/verb están cubiertos.

Fuentes de la fixture: estructura sintética0421 con auditoría real0258/0261/0267/0294/0351; cuerpos reales0464/0467/0468/0128/0340; políticas actuales de0414 extraídas íntegramente desde su DDL/postflight (no se certifica su preflight de release0411–0413); helpers completos get_user_tenant_id0453/current_studio_role0200;0230 y0470 completas para las cuatro tablas financieras. auth.uid es adaptador de claims sintéticos, no Auth alojado. Privilegios estándar service_role de las tablas añadidas se declaran en bootstrap; no se simula permiso con true. La prueba ejecuta acciones bajo SET ROLE authenticated/service_role/anon y evalúa aislamiento/tenant ambiguo, no solo postgres. HTTP/JWT queda pendiente en este checkpoint.

Evidencia externa en C:/tmp/director-traspaso-20261020/0576-codex-validation/:
- ROJO: red-sql-1 y red-sql-groups-1 reproducen defaults/cobro/0128/gasto/futura nueva; red-sql-replay-1 reproduce PAYMENT_INPUT previo al replay idéntico, con5 casos omitidos exclusivamente por selección -t. No representan suite completa verde.
- green-sql-groups-2 PASÓ6/6 sin omisiones; los errores anteriores de bootstrap y postflight se conservan en sus logs. El postflight corrigió las dos representaciones exactas de paréntesis de pg_get_expr, sin relajar reloj/zona/cast.
- green-sql-final-1 PASÓ7/8 y FALLÓ el nuevo fixture de otro actor por constraint real de principal único; se corrigió usando reasignación sintética conservando el constraint. green-sql-portal-final-2 PASÓ3/3.
- lint-sql-checkpoint-1 y typecheck-sql-checkpoint-1 PASÓ salida0. La incorporación posterior de0470 es únicamente fixture SQL; su suplemento se registra en el handoff.

Los controles rojos permanentes esperan el error funcional exacto de la base sin0533; un error de infraestructura no los hace pasar. PostgreSQL/HTTP, mutantes, navegador, verify y revisión SQL siguen pendientes. Este checkpoint no certifica C1 completa ni autorización de integración/producción.

FUERA DE ALCANCE DETECTADO: app/m/erp/actions.ts mantiene occurred_at.slice(0,10) y guardas anteriores (blob9f10b23265c8273e9a2f543ac04092d1c7beea86; líneas95/195/260/354 cotejadas por Director). No se modifica dentro de68. Requiere slice móvil posterior antes de afirmar toda la hora Caracas unificada.

Revisión APP independiente recibida por Director: financiera5dad SHA256dda463a1f60037f81eb85f36d9d0da0963e5ae7a5ee9f48c8d15720f38640743 sin material nuevo; Portal/Gastos5dad SHA25640643e978d1761afec5d8bf95ee44ed3a66607940087137f98c74f7b50bfc81e con el P2 reparado en d5f28fdede9295c60b8eaaa700d0b42c9f7ca3ad. Director confirmó cierre independiente996ecb86. Archivos externos caracas-c1-revision-app-{financiera,portal-gastos}-5dadb103.md. Actions de5dad: startup_failure39536119461/39536106357; no aprobación CI. Estas lecturas/corridas no reemplazan verify final sobre SHA congelado.

Suplemento de fixture0470: green-sql-policies-1 FALLÓ por privilegio estándar service_role ausente en las tablas añadidas después del bootstrap0421. Se declaró exclusivamente ese bootstrap; no se alteró0470 ni authenticated. green-sql-policies-2 PASÓ8/8 en2archivos,0SKIP,03:14:44.715–03:14:58.589Z (incluye controles rojos permanentes y tenant ambiguo con helper0453 real). Archivo0533 SHA256fd42b7a15fe413107d457a32da56b46f051fad29e7cbd7388611d24949b3f0ef. Scope68/68, outside=[]; diff8729→árbol sin whitespace errors;69anclas pendientes coherentes. Utilidad común de contrato guardada, HTTP aún NO EJECUTADO/pendiente de implementar en la misma ruta autorizada. Revisión SQL solicitada sobre este checkpoint parcial.

## Suplemento PostgreSQL/HTTP y mutantes SQL

Checkpoint SQL `b7148218394523a3cca46a47181ac13d17815ff9` publicado, revisión en curso. El arnés HTTP posterior no cambia0533 ni producto APP: fuente realmente ejecutada `scripts/tests/fechas-caracas-postgrest.mjs` SHA2567c6511cd388f8f2d2fd0717cd671aa740ff969ab37dc506b2751cc4d2b43eea3.

`postgres-http-1` PASÓ salida0,03:17:38.312–03:18:19.341Z. PostgreSQL17.11 ejecutó95aserciones del contrato completo y ROLLBACK. PostgREST14.17 ejecutó39comprobaciones, con41respuestas/request sintéticos guardados individualmente. Recibo `C:/tmp/director-traspaso-20261020/0576-codex-validation/postgres-http-1/receipt.json`, contrato `postgres-contract.log`, respuestas `http-responses.json`, catálogo de definiciones/defaults reales `http-real-catalog.json` y log deDDL en ese directorio.

Antes0128 devolvió JSON legado sin issued_at; luego0533 REAL se ejecutó en transacción/COMMIT/NOTIFY, sin DML, y la misma instancia devolvió la fecha efectivamente persistida. StartedAt antes/después idéntico2026-10-21T03:17:51.397728928Z; hash0533 igualb714. Después se instrumentó exclusivamente el reloj para probar medianoche/captura única, fechas explícitas, roles/tenant ambiguo, replay futuro idéntico y negativos por campo/request/actor/tenant/revocación/verb/ACL. Se conserva la fase real separada de la instrumentada. No Auth alojado ni bytes actuales de Storage probados por SQL; éstos siguen cubiertos separadamente por acciones/helpers locales. Recursos con etiqueta propia dtd.task=0576c1 eliminados; remainingOwn vacío. No recursos ajenos tocados ni Docker Desktop detenido.

`sql-mutants-1` PASÓ14/14 muertos por la condición funcional esperada,03:20:00.569–03:20:26.027Z; no cambió ningún archivo productivo. Se cargó0533 real intacta, completó sus pre/postflights y luego se mutaron copias de definiciones instaladas en PGlite; recibo `sql-mutants-1/result.json`. Cubre UTC/defaults/cobro/pago, segunda captura,0128 fecha devuelta/vencimiento, origen y cierre histórico, frescura/replay/hash/actor Portal. El mutante09 demuestra la ausencia de la guarda explícita de cierre: el trigger heredado todavía rechaza, pero produce otro error; no implica que ese mutante pueda persistir un cambio cerrado. SHA0533 intacto en14/14. Lint-http-1 PASÓ salida0. Mutantes APP, UI real y verify siguen pendientes.

## Suplemento de composición 0493 y mutantes · 21oct03:28Z

Producto APP/0533 permanecen idénticos a b714; este suplemento añade pruebas y arnés dentro de las68rutas. La fixture anterior cargaba0133. La actual carga0357 y0493 REALES completas antes0533 (preflight/ACL intactos), con los dos pins search_path de0210;0453 ypgcrypto ya eran reales. Compara hashes, ACL, owner y config de ambos triggers y excepcion_al_cierre_vigente antes/después0533, además de policies/triggers/filas.

- green-0493-composition-1: PASÓ un caso focal PGlite, cinco omitidos únicamente por selección -t. No se presenta como suite completa. Incluye las tres guardas C1 de gasto, OLD cerrado→NEW abierto, inverso, DELETE cerrado, traslado de línea, abierto permitido y cero efectos negativos.
- postgres-0493-composition-1: PASÓ33aserciones yROLLBACK en PostgreSQL17.11,03:27:19.212–03:27:25.099Z; salida0, recursos propios eliminados/remainingOwn vacío. HTTP NO EJECUTADO en este suplemento; la API/0533 no cambiaron y sigue el recibo HTTP41respuestas del checkpoint de8. No Auth alojado ni DB real.
- Excepción mediante RPC0493 real con accounting, motivo, nonce/txid/actor/importes y limpieza. GUC inventado, nonce de otro asiento y txid previo no autorizan. Un nonce real válido para el asiento tampoco vence el bloqueo explícito de void_expense0533. La modificación sintética del txid solo prueba antigüedad: no supone que una API pueda escribir la tabla privada.
- sql-mutants-0493: PASÓ5/5 muertos por aserción funcional esperada,03:27:39.209–03:27:47.493Z; fuente0533 intacta. El nuevo15 demuestra que quitar el bloqueo explícito permitiría la anulación con nonce válido en ese contexto, complementando el09 anterior (otro mensaje de trigger, sin persistencia). No cambia el permiso productivo.
- app-mutants-1: resultado inicial exit1,25/29 clasificados muertos,29restaurados. Dos fallos UI eran funcionales pero el clasificador no reconocía los matchers DOM: evidencia íntegra y reclasificación en app-mutants-ui-classification.json, sin repetirlos. Dos supervivientes reales mostraban huecos de prueba: bytes distintos del mismo tamaño y recibo recovery con replayed=false. Nuevas regresiones PASÓ265/265 en2archivos,0SKIP; app-mutants-supplement-1 PASÓ2/2 muertos/restaurados, sin cambiar producto. Resultado final29casos cubiertos; se conserva el historial inicial, no se reescribe su exit.
- CxP incluye prueba sin today inyectado a03:59:59.999/04:00 y mutante de default UTC muerto. typecheck-supplements-1 PASÓ salida0; lint-supplements-1 PASÓ salida0 sin warnings.

Recibos/logs/JSON externos en C:/tmp/director-traspaso-20261020/0576-codex-validation/. SHA2560499 continúa fd42b7a15fe413107d457a32da56b46f051fad29e7cbd7388611d24949b3f0ef. Navegador real, verify final y cierre de conocimiento siguen pendientes. Revisiones por b714/de8 conservan sus límites; este suplemento se entrega como nuevo objeto para cotejo independiente. No merge, despliegue ni migración real.

Suplemento mínimo tras revisión fd6: se añade negativa de editar importe/descripción de una línea manteniendo su asiento cerrado (rama específica del trigger), y RPC0493 en modo default superclave sin clave antes de habilitar advertencia. postgres-0493-composition-2 PASÓ37aserciones+ROLLBACK, salida0,03:30:28.126–03:30:34.518Z; mismos producto/0533/arnés, cero recursos propios restantes. No se repite HTTP ni los cinco mutantes intactos. No consta un defecto de producto; cierra cobertura de las dos negativas requeridas.

Cierre de orquestación de pruebas: red-composed-orchestration-1 reprodujo2fallos/9 (7PASÓ,0SKIP): los controles Portal sin0533 alcanzaban antes el nuevo grupo de cierre que exige0533. Se aisló run_closing:false en el ejecutor Portal, sin cambiar sus oráculos ni la composición Studio. green-composed-orchestration-1 PASÓ9/9 en2archivos,0SKIP,03:31:19.712–03:31:34.235Z; incluye todos los positivos y negativos permanentes de ambos módulos. Lint-portal-composition-1 salida0. Es reparación propia de orquestación TEST, no producto. Se conserva ROJO original. SQL0533/APP/arnés iguales al checkpoint previo.


## Adopción de ampliación 69 · recibos0068

Leído íntegro antes de editar, SHA256834810d04b4c4eb0525e031885372c30894b84379051950f35cfef75e9322c7f. Verify46c interrumpido por decisión Director ante expectativa heredada vacío→hoy. Se conserva log/recibo, sin atribuir resultado global aprobado. Solo prueba adicional y documentos propios; producto/SQL intactos.

# C1 — addendum del contrato heredado de recibos0068

Fecha: 2026-10-20, Caracas. Decisión del Director dentro del mandato local vigente de Sam. Misma tarea C1, rama, worktree, owner y migración0533; ninguna nueva operación de producto o producción.

## Motivo y alcance exacto

El verify iniciado03:39:19.150Z sobre `46c64bd09b28d36e2689312aeea9d204dd2a2051` detectó el caso de `lib/studio/__tests__/payment-receipts-0068.test.ts` que entrega `receivedAt:""` y exige una fecha válida. El Director y Worker cotejaron por lectura esa expectativa. C1 prescribe valor predeterminado únicamente para `undefined`; vacío no significa hoy. El producto vigente rechaza ese vacío como corresponde al contrato aceptado.

Se añade **una sola ruta** a la allowlist anterior de68: total **69 rutas únicas**.

```text
lib/studio/__tests__/payment-receipts-0068.test.ts
```

Las anotaciones necesarias en spec/handoff propios ya están permitidas. No cambia ninguna otra ruta, migración, módulo, validador, dinero, moneda ni autorización. El contrato original `0576-caracas-c1-asignacion-worker.md`, hash `f4c55bb8c97ac57d9b0c8ce0206d2aabe524e3009320be6c7c974674cfde76ff`, y sus tres addenda anteriores se conservan íntegros.

## Aceptación comprobable

1. Conservar el caso original rojo por su expectativa de vacío→fecha, los recibos y el intento canónico anterior. No atribuirle un resultado global aprobado.
2. Mantener los controles de moneda desconocida→USD, fecha malformada, mandatos, importes, fondos y builders existentes.
3. Exigir para fecha vacía error de campo e input ausente. No debilitar el validador para acomodar el test.
4. Probar fecha omitida y `undefined` con reloj fijo: `2026-10-21T03:59:59.999Z` da `2026-10-20`; `2026-10-21T04:00:00Z` da `2026-10-21`. Conservar fechas explícitas válidas. Restaurar siempre los timers.
5. Pasar el archivo completo, sin omisiones, y sus controles estáticos pertinentes. Publicar checkpoint mínimo, cotejar el delta y ejecutar el cierre canónico sobre el candidato congelado nuevo; no combinar recibos de candidatos distintos como una sola corrida.

## Secuencia y límites

Se permite detener de forma controlada únicamente el árbol de procesos propio del intento canónico ya identificado, conservando logs/recibos y marcándolo INTERRUMPIDO/INCOMPLETO por este hallazgo. Antes del focal comprobar que ese árbol terminó; no ejecutar dos pruebas pesadas ni matar procesos compartidos. El observador auxiliar de JSON E2E propio también debe quedar retirado si ya no corresponde al PID de verify.

Guardar este addendum completo y su hash en el handoff antes de editar. Guard, rama y ownership siguen obligatorios. Commit y push selectivos a la rama propia y PR #312 en borrador ya autorizados. Sin merge, despliegue, migración real, lectura de negocio o modificación de pagos.0495 no se repite.


## Checkpoint test de recibos0068 y evidencia visual final

La ampliación69 no modifica producto APP,0533, arnés ni gates. El primer verify de46c comenzó03:39:19.150Z y fue INTERRUMPIDO/INCOMPLETO por decisión Director al detectar la expectativa heredada vacío→hoy. Harness237/237, lint con0errores/15advertencias de seis archivos idénticos a8729, fronteras1708módulos, tipos y cuatroEdgeFunctions habían pasado. La suite general no terminó; no se le atribuye verde global. Recibo verify-candidate-interruption.json:remaining=[]/unknownChildren=[]; wrapper terminó03:46:15.650Z por cierre controlado, exit forzado4294967295. E2E/build no alcanzados. El observador nativo fs.watch falló por aserción Windows; su sustituto de lectura exacta terminó0 sin captura al retirar la corrida. Son incidencias de captura separadas del producto.

ROJO original completo red-receipts-0068-original:33PASÓ/1FALLÓ/0SKIP,03:46:49.406–03:46:53.508Z; toMatch recibióundefined porque vacío fue rechazado. La prueba conserva moneda desconocida→USD, fecha malformada, importes, fondos, mandatos y builders; ahora exige error/input ausente para vacío. Dos casos con timers restaurados comprueban omisión/undefined a03:59:59.999Z→20 y04:00Z→21, preservando fecha explícita, importe y moneda. green-receipts-0068 PASÓ36/36,0SKIP,03:47:12.712–03:47:15.434Z. Lint focal PASÓ salida0 sin advertencias; typecheck-receipts-0068 PASÓ salida0,03:47:38.163–03:47:53.688Z. No se cambió el validador para acomodar la prueba. Siguiente cierre canónico sobre nuevoSHA congelado, separado del intento46c.

La revisión independiente final del suplemento46c PASÓ sin hallazgo material abierto: caracas-c1-revision-suplemento-fd6e8146.md SHA2566a780886a25aa3263f3604380ee7a04826ab818d15a1186c136e8c970b614313. El dictamen SQL/HTTP previo conserva00c21ac263a5a987e37a9097e0b72cefa2d1028b6f7483c4307d795246c78ed1. Estos dictámenes no sustituyen verify ni release.

Navegador final: visual-final-receipt.json, fuentes/capturas en visual-fixture, producto46c. PASÓ alcance local con componentes reales, globals/tokens/studio.css y wrappers reales, datos/reloj/actions ficticios,390/1280claro/oscuro y navegadorShanghai.35controles funcionales/29mediciones; el recibo inspection-2 conserva FALLÓ por selector de gasto que omitió el punto del locale, corregido solo en suplemento externo inspection-supplement PASÓ. Se conserva tanto el fallo de selector como el resultado funcional; capturas anteriores a studio.css son provisionales. Recuperación Portal reenvía mismosIDs/payload/archivo aun cuando la fecha aceptada parece futura; creación nueva futura se rechaza antes de action; defaults, vacío/fecha explícita, CxP sin today inyectado, foco y Escape comprobados. Director inspeccionó independientemente390conCSSreal sin hallazgo material. No se certifica teléfono físico, Studio/Auth real, A11Y integral, alta/duplicación de factura en navegador ni zoom200%nativo: las teclas Chrome no cambiaron viewport/DPR/escala y no se sustituyó conCSSzoom. Invoice fixture acredita RegistrarPago. Servidor20036 y Chrome propia retirados; visual-cleanup.json conserva cero descendientes propios.

PR312 permanece DRAFT/base8729; Actions de46c startup_failure39539115496/39539111495, sin aprobación. Conocimiento, cierre canónico nuevo, documentación final y release siguen separados. Sin merge/migración real/deploy.


## Adopción de ampliación70 · doble de GastosUSD0572

Leído íntegro y hash506d24fb1d35334877c320a7ee81e2cfa3a4b5c56a5cf1fc796628c767984cbb comprobado antes de editar. Verify2 de9cbe INTERRUMPIDO/INCOMPLETO por doble incompleto sin lt; no es defecto de cálculo. Recibo de corte:remaining=[]/unknownChildren=[]; manifiesto69sin diferencias, lockfile/runner intactos y árbol limpio antes de esta adopción.

# C1 — adaptación del doble de GastosUSD0572

Fecha: 2026-10-20, Caracas. Decisión del Director dentro del alcance local autorizado. Misma tarea, worktree, rama, owner y0533; sin cambio de producto o permiso de producción.

## Evidencia y única ruta adicional

El segundo verify sobre `9cbe8749d09bc1fbed9ebf42cdc4952f178a070b` detectó el caso «lee amount_usd de cada gasto y no recalcula por moneda». Su doble admite select/is/gte/then, pero no lt; la consulta vigente usa ambos límites del día Caracas. El Director leyó la fuente inmutable y comprobó el desajuste.

Se añade una sola ruta a las69 anteriores: **70 rutas únicas**.

```text
lib/studio/__tests__/gastos-y-pagos-en-usd-0572.test.ts
```

La spec y el handoff propios ya están autorizados. Producto, consulta, SQL, conversor, redondeos, gates y demás tests no se modifican. Conservar íntegros el contrato original y sus cuatro addenda anteriores.

## Aceptación y secuencia

1. Guardar este documento completo/hash antes de editar. Autoriza detener de forma controlada solo el árbol propio del segundo verify34808 y su observador exacto17036, con identidad comprobada, logs/recibos conservados y estado INTERRUMPIDO/INCOMPLETO. Comprobar restantes/descendientes desconocidos antes del focal; ningún proceso compartido se detiene.
2. Reproducir el archivo completo original en rojo. Registrar el error de método faltante y/o su efecto exacto en la aserción; no llamarlo un defecto de cálculo del producto ni un resultado global del verify.
3. Añadir lt encadenable al doble, conservando select/is/gte/then y su respuesta de amount_usd. Registrar y exigir ambos límites literales, inferior inclusivo y superior exclusivo de Caracas, con reloj fijo cerca de medianoche. Verificar columnas exactamente amount_usd, total127 y count3; los otros nueve casos monetarios siguen intactos.
4. Usar timers restaurados en finally o equivalente seguro. No cambiar expectativas de moneda, tasa, centavos, signo, redondeo o falta de conversión para acomodar el doble. No convertirlo en respuesta exitosa genérica que omita los límites.
5. Pasar el archivo completo sin omisiones y la regresión directa existente de expense-queries-caracas, sin ampliar rutas. Lint/tipos pertinentes, diff-check, scope70 y checkpoint mínimo selectivo a PR #312 en borrador. Director revisará el delta fijo antes del nuevo cierre canónico.

Inventario acotado ya efectuado por Director sobre9cbe: los únicos archivos de pruebas que mencionan/importan expense-queries son el nuevo `expense-queries-caracas.test.ts`, que ya contempla lt, y esta ruta heredada. No se autoriza un barrido masivo ni cambios especulativos en otros dobles. Si aparece otra ruptura concreta, se identifica y coordina su ruta.

No combinar gates de las dos corridas interrumpidas con la siguiente, ni editar fuentes durante un verify nuevo. Se conserva un único turno pesado. Sin merge, migración real, lectura de negocio, radiografía, deploy, pagos o cambios de cuenta.0495 no se repite.


## Checkpoint de compatibilidad del doble GastosUSD · 21oct04:02Z

Verify2 sobre9cbe, iniciado03:49:03.165Z, fue INTERRUMPIDO/INCOMPLETO por autorización Director al observar que el doble de GastosUSD carecía de lt. Terminó por cierre controlado04:00:36.249Z, exit forzado4294967295. No concluyeron unitarias/SQL/E2E/build ni existe resultado global aprobado. verify-candidate-2-interruption.json acredita remaining=[]/unknownChildren=[]; observador17036 terminó0 sin JSON porque E2E no se alcanzó. Antes de modificar docs, verify-candidate-2-bytecheck.json cotejó69fuentes con su manifiesto de entrada: diferencias=[], lockfile/runner intactos y árbol limpio. No se combinan gates de esta corrida con otra.

red-gastos-usd-original reprodujo el archivo original completo:9PASÓ/1FALLÓ/0SKIP,04:00:57.862–04:00:59.858Z. Error exacto TypeError: .lt is not a function en el doble; no es fallo de cálculo ni un ROJO funcional del producto. La adaptación autorizada solo añade lt encadenable y registro/aserción exacta de ambos límites: a2026-10-21T03:59:59.999Z, gte occurred_at2026-10-20T04:00:00.000Z y lt occurred_at2026-10-21T04:00:00.000Z. Conserva select amount_usd, respuesta original y total127/count3; los nueve casos restantes de monedas/centavos/signo/null siguen intactos. Reloj restaurado en finally.

green-gastos-usd-compat PASÓ17/17 en2archivos completos,0SKIP,04:01:18.302–04:01:20.825Z, incluyendo expense-queries-caracas real que ejecuta filtros contra filas de borde. Lint focal PASÓ salida0 sin advertencias,04:01:25.413–04:01:31.340Z; typecheck-gastos-usd-compat PASÓ salida0,04:01:36.490–04:01:47.322Z. Producto APP/0533/arnés/gates siguen idénticos; el checkpoint contiene únicamente este test y los dos documentos propios. Alcance70rutas exactas. Nueva verificación canónica y cierre de conocimiento aún pendientes sobre el siguienteSHA congelado.

## Cierre local C1 · 21oct2026 · evidencia por264e0531

### OBJETIVO ORIGINAL

Usar el día de operaciones America/Caracas en C1 web/SQL, capturado antes de esperas, sin re-fechar historia ni cambiar dinero, permisos, auditoría o el contrato de recuperación de evidencia. Base8729f7f4 de PR311; allowlist final70 rutas, contrato y cinco addenda íntegros conservados arriba. SDD0576 permanece in-progress porque C2 y móvil no pertenecen a esta entrega.

### COMPLETADO

- Primitiva compartida IANA/calendario estricto; ancla única y defaults en facturas, cobros, CxP/pagos, posters y formularios. Fechas explícitas conservadas; vacío/null no se convierten en hoy.
- Gastos usa rango Caracas completo, muestra el día correcto y rechaza lecturas ambiguas/malformadas o reposteo que cambie la fecha histórica. El P2 de filas falsy quedó cerrado por regresión real, sin prometer atomicidad0575.
- Portal separa creación futura prohibida de recuperación autorizada de un intento idéntico; conserva IDs/payload/prueba y comprueba bytes existentes. Emisión0128 devuelve fecha persistida; readback legado solo ante ausencia estricta; CN distingue emisión confirmada de asiento pendiente.
- 0533 conserva las cinco fronteras SQL, cuatro defaults, RLS/ACL, locks y auditoría; composición con0493 real comprobada. No aplicada a DB real, sin GRANT ni backfill.
- Revisión independiente APP/SQL/Portal y suplementos cerrados sin hallazgo material conocido pendiente. Los dos ajustes finales fueron exclusivamente contratos de pruebas consumidoras heredadas, con ROJO/VERDE y cotejo Director.

### VALIDACIÓN

Evidencia externa: C:/tmp/director-traspaso-20261020/0576-codex-validation/. No contiene datos de negocio ni secretos. Los recibos anteriores conservan su SHA/fecha; no se suman controles solapados como cobertura distinta.

**Verify3 canónico sobre264e0531004ecc8c773c8fb32a88a2b206119a54:** corepack pnpm verify, sin overrides. Inicio04:03:10.374Z, fin04:26:01.702Z, duración22m51.328s, salida0. Log/recibo verify-candidate-3. Veredicto literal: **CIERRE INCOMPLETO — 16/17; migrations-applied crítico no medido**. Salida0 no equivale a cobertura completa.

| Control canónico | Resultado | Evidencia de esta corrida |
|---|---|---|
| harness | PASÓ |237/237,0SKIP;87,245s |
| lint | PASÓ con advertencias |0errores/15warnings en seis archivos con blobs iguales a la base; sin supresiones |
| rsc-boundary | PASÓ |1708 módulos, sin cruces prohibidos |
| typecheck | PASÓ |Sin errores |
| edge-functions | PASÓ |4 funciones compilan |
| test | PASÓ con omisión |12.720 aprobadas/1 omitida;885 archivos aprobados/1 omitido;568,50s |
| docs:check | PASÓ |Índice vigente sobre264e |
| numbering | PASÓ |Sin números repetidos |
| feature-constants | PASÓ |6 banderas coinciden |
| components:check | PASÓ |Consistencia del registro, no aprobación global de conducta |
| governance:check | PASÓ |Consistencia de cápsula, no aprobación global de políticas |
| migrations-applied | NO EJECUTADO / SKIP |Sin URL/key de producción; validación de release pendiente, no motivo para aplicar0533 |
| pending-migration-symbols | PASÓ |0rojo,2amarillos declarados,3homónimos descartados |
| sql-tests | PASÓ |248 contratos locales, rollback total |
| schema-rebuild | PASÓ |473 migraciones desde cero+18solo-ledger=491;219tablas/2tenants sintéticos; controles locales de integridad |
| e2e | PASÓ con advertencia y omisiones |177passed+1flaky+20skipped,4,8min; Next3214 y deny-only13214, sin Auth/negocio real |
| build | PASÓ |Next16.2.11; compilación22,8s, TypeScript98s,162 páginas; tsconfig restaurado |

El runner no proporciona tiempos separados para todos los gates; no se infieren del mtime del log. Los dos intentos anteriores,46c y9cbe, siguen **INTERRUMPIDOS/INCOMPLETOS**, sin combinar sus resultados con verify3.

**Omisiones unitarias:** lib/studio/document-import/corpus.test.ts, suite «corpus real de proformas», caso «lee las proformas con encabezados reconocibles sin llamar a la IA». DOCUMENT_IMPORT_CORPUS no configurado en el entorno heredado; no se abrieron proformas reales. Evidencia verify3-unit-skip-evidence.json y definición skipIf de la fuente.

**Omisiones E2E:**20 líneas exactas en verify3-e2e-log-evidence.json. En chromium/mobile-chrome/mobile-safari se omiten comentarios(1), anulación de gastos Studio/móvil(2), buscador con seed(2) y finiquito(1):18 por requerir entorno/usuarios/fixtures aislados. Las dos capturas adicionales del carrusel en mobile-chrome/mobile-safari se omiten por diseño de ese test, que se ejecuta una vez en chromium a anchos explícitos. No se presentan como recorridos autenticados aprobados.

**Advertencia E2E propia de verify3:** chromium, e2e/auth.spec.ts:81, «Acceso: un token inválido renderiza el mismo error las dos veces», primer page.goto falló net::ERR_ABORTED; aprobó el reintento configurado. Log y verify3-e2e-auth-error-context.md conservados (SHA25659e4e2c05e1e7cb0a6b3f24b810aa7d435795e2085b8f15c98f784309f9ae6eb). Prueba, configuración y runner tienen blobs iguales a8729; ello no establece causa. No hubo watchdog/absolución ni cambio de timeout en esta corrida.

**JSON original E2E: NO DISPONIBLE.** Observador17856 terminó0 con captures=[]/incompleteReads=0; el archivo exacto dtd-e2e-50896.json ya no estaba al iniciar build. El runner elimina ese reporte antes del siguiente paso. El observador también descarta silenciosamente un rootDir que no empieza por WT largo+'/'; no registra esos descartes. Es un límite de captura futura, no prueba de que ocurrió ni explicación de la falta del archivo. No se reconstruyó JSON ni se repitió la suite. La incidencia fs.watch del primer intento permanece separada de verify/producto.

**Focales y SQL/HTTP:** historial de697/697 en19archivos,18/18 del P2Gastos,265/265 de recuperación,36/36 de recibos y17/17 de compatibilidad Gastos conserva recibos y solapamientos. PGlite final9/9 en2archivos,0SKIP. PostgreSQL17.11/PostgREST14.17:95 aserciones SQL+ROLLBACK,39checksHTTP/41respuestas, instancia antes→DDL0533 real→después con mismo StartedAt; suplemento0493 con37aserciones+ROLLBACK. JWT sintético y adaptador auth.uid identificado; no se certifica Auth alojado ni Storage real. Mutantes APP29 cubiertos (25clasificados inicialmente,2fallosUI reclasificados y2repetidos tras fortalecer casos); SQL14+composición0493cinco, todos con restauración. Primer exit1 de clasificación conservado. Hash0533 intacto: fd42b7a15fe413107d457a32da56b46f051fad29e7cbd7388611d24949b3f0ef.

**Visual:** PASÓ alcance local de visual-final-receipt.json, con componentes/CSS/wrappers reales, datos/acciones/reloj sintéticos.35controles/29mediciones y suplemento de selector conservan resultado original y corrección externa.390/1280,claro/oscuro,Shanghai, recuperación con fecha aparentemente futura, nueva futura rechazada, fecha explícita/vacía, defaults, CxP sin today inyectado, foco/Escape; Director cotejó con IAB. Capturas anteriores a studio.css son provisionales. NO DISPONIBLE zoom200%nativo; NO EJECUTADOS lector de pantalla/A11Y integral, teléfono físico, Auth/Studio real y alta/duplicación de factura en navegador. Invoice fixture acredita RegistrarPago. Sin atribuir esas limitaciones a un defecto material demostrado ni aprobar excepción.

**Revisiones finales:** caracas-c1-revision-suplemento-fd6e8146.md SHA2566a780886a25aa3263f3604380ee7a04826ab818d15a1186c136e8c970b614313; cotejo9cbe f0445c9b778c78d98b2266b152ca18bf1e9084769c07576c3eef30479ea1726e; cotejo264e e55bd858176f76423c46c98d1d4244806521c987059c8e890f157759de7db54c. No sustituyen release.

**Congelación comprobada antes de docs:** verify-candidate-3-bytecheck.json,04:27:04.118Z,70/70hashes iguales, lockfile/runner iguales, HEAD264e y árbol limpio. El cierre posterior modifica solo spec/handoff/índice; APP, SQL y pruebas siguen exactamente en esos bytes.

### COMMITS

Checkpoints publicados: eecfbbb1(stub),5dadb103(APP),d5f28fde(P2Gastos),b7148218(SQL),de8b1961(HTTP),fd6e8146(composición0493),b127886d(dosnegativas0493),46c64bd0(orquestaciónPortal),9cbe8749(recibos),264e0531(dobleGastos). Producto APP/0533 no cambió después de b714; los suplementos posteriores son pruebas/arnés/documentación. El SHA documental final se coteja en Git/PR y en el recibo final externo, con delta exclusivo de estos documentos y el índice generado.

### PR / BRANCH

PR312 OPEN/DRAFT: https://github.com/SoftAgentes/DTDCARGO/pull/312. Rama codex/sdd-0576-fechas-caracas-operaciones, base codex/sdd-0572-conversor-usd-sql@8729f7f4. Push propio autorizado; sin merge. Últimos Actions de264e startup_failure39541828194/39541822849, no aprobación CI. La eventual habilitación de Actions no se presume por el cierre local.

### CONOCIMIENTO Y GOBERNANZA

Guardado: contrato, decisiones autorizadas, evidencias y límites en esta tarea. Integración: pendiente. SDD0576 pasa de draft a in-progress; no done global.

knowledge-status-final terminó04:29:46.803Z,salida0, sobre264e; **ok=false**. Graphify0.9.61: estructura INVALID/5012pendientes, graph_missing_or_invalid y graph_empty; semántica global INVALID0/1327, piloto PENDING0/16. Archify PENDING por ARCHIFY_RUNTIME_MISSING2.16.0. Obsidian integrado PENDING y exige main; preview NO EJECUTADA, prerrequisitos locales no disponibles. Sin extracción, reconstrucción, instalación ni publicación compartida por instrucción expresa del Director; pendientes coordinados para conocimiento tras la integración comprobada. El futuro delta documental tampoco queda certificado semánticamente por esta consulta anterior.

governance-plugin-final terminó04:30:06.142Z,salida0: PLG-01 válido read-only,28políticas/5componentes. Solo consistencia del derivado y rutas. La matriz normativa acotada está en la spec: SGE-00/DAT/FRM/ERR/UPL/AUD/NUM/MP; A11Y conserva no conformidad de evidencia pendiente para cobertura no medida, sin inventar excepción ni declarar conformidad global.

### PENDIENTES DE ESTA TAREA

- Revalidación contra la base coordinada por Director, integración según orden humano, CI real por SHA, paquete/previa y OK nominal de0533, migración MIGRATE-FIRST y despliegue/smoke autorizado. Nada de esto se ejecutó ni se autoriza por esta entrega.
- Ledger de release, recorridos autenticados/fixtures omitidos y límites A11Y declarados; JSON original de esta corrida no recuperado. No hay defecto material de C1 conocido abierto tras las revisiones y correcciones.
- Derivados Graphify/Archify/preview/Obsidian según coordinación Director. Mantener separado del funcionamiento y de los16gates locales medidos.

### FUERA DE ALCANCE DETECTADO

- C2 anual y slice móvil siguen pendientes en0576. app/m/erp/actions.ts mantiene occurred_at.slice(0,10)/guardas previas (blob9f10b23265c8273e9a2f543ac04092d1c7beea86, líneas95/195/260/354); ninguna afirmación de unificación global.
- BCV corresponde a0569; no autocarga ni fuente nueva.0575atomicidad,0573/2.3/KPIs, históricos, datos reales y reglas monetarias no se absorben.
- Advertencia de navegación ERR_ABORTED sin causa establecida; observador con límite rootDir y15warnings heredados quedan registrados, sin reparar módulos ajenos para ocultarlos.

### HANDOFF AL DIRECTOR Y LIMPIEZA

Verify y observador terminaron realmente; verify3-process-cleanup-final.json acredita cero procesos/puertos/recursos Docker propios. Dos procesos de otro encargo fueron incluidos inicialmente por enlace numérico de PID; sus CreationDate anteriores al verify y rutas ajenas los excluyen de ownership y NO fueron detenidos. El recibo intermedio de clasificación con error cultural de PowerShell se conserva como inválido; el final usa comparación temporal tipada. No se apagó Docker Desktop ni se tocó recurso ajeno.

Knowledge/plugin finalizaron antes de devolver explícitamente el turno pesado al Director, quien lo recibió. Writer/claim se conserva solo hasta concluir documentos/índice, commit/push y lectura de PR. La liberación posterior se registra en final-receipt.json externo y se comunica expresamente al Director, después de comprobar remoto/árbol limpio. No se elimina worktree ni rama. C2 no se inicia desde esta sesión.

## Renumeración 0499 → 0533 (2026-11-11)

Main llegó a la 0526 antes de integrar esta pila, la 0499 no está aplicada en
ningún entorno y de la 0528 a la 0532 ya las ocupan otras PR. La migración pasa a
`0533_fechas_caracas_operaciones` con su contrato
`supabase/tests/0533_fechas_caracas_operaciones.test.sql`; se renumeraron sus
literales internos, la espera de `migrations-baseline.json` (sigue sin aplicar),
pruebas, arnés HTTP y citas. Cambia sólo el número: el SHA-256 anterior
`fd42b7a15fe413107d457a32da56b46f051fad29e7cbd7388611d24949b3f0ef` (blob
`ba9d4b4cae90ea65406bbc63e5a1425dafcffea5`) pasa a
`da9343c22d38a2cffce7d7118c090a8e6c412ae0956979d2dc315754cc1e85e0` (blob
`9c70be6e81a143502b1cdb03133fe96d343950fd`). Las evidencias anteriores a esta
nota describen el archivo con número 0499.

Composición con main: ninguna de las cinco funciones que redefine
(`register_collection_receipt` 0467, `register_supplier_payment_order` 0468,
`void_expense_governed` 0340, `payment_private.run_report_command` 0464,
`sales_order_claim_and_invoice` 0128) cambió en main después de esas versiones.
El asiento de factura ya no lo inserta JS: la RPC atómica de la 0497 lo fecha con
`issued_at` persistido, así que el default `fechaCaracas()` de
`invoice-posting.ts` se retiró al traer main. La 0533 corre después de la 0511
(RLS de escritura de asientos); su contrato `.test.sql` en el CI es la prueba de
los asientos bajo esa RLS. La rama `claude/sdd-0576-fechas-caracas-operaciones`
reemplaza a la PR #312.
