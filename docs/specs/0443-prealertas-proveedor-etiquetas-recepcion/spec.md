---
sdd: "0443"
title: "Prealertas: proveedor, etiquetas y recepción por lote"
status: in-progress
author: "Codex con Sam"
created: 2026-09-05
updated: 2026-09-19
supersedes: null
superseded_by: null
related: ["0057", "0096", "0097", "0153", "0154", "0308", "0442"]
confidencialidad: interno
---

# Prealertas: proveedor, etiquetas y recepción por lote

## Decisiones autorizadas

Una tarea continua en `codex/cambios-portales`, worktree separado; entrega por PR sin merge ni producción.
El proveedor completa el formato web o usa Excel, sin duplicar trabajo. Originales solo si DTD los solicita.
Impresión libre con aviso informativo, nunca condicionada a completar/enviar el documento.
Identidad compartida del cliente: solo Shipping Mark y códigos operativos, sin nombre/teléfono/email.
Etiquetas sin SHIPPING TO DTD CARGO; marca, cuando corresponda: DTD Cargo.
Recepción CN: lote pendiente por defecto, confirmación explícita, alternativa individual/parcial y servicios persistentes.

## Checklist del goal

- [x] Crear worktree aislado y comprobar PRs abiertos.
- [x] Página del proveedor: referencias automáticas, privacidad y accesos directos.
- [x] Editor amplio: acciones reconocibles, borrador versus envío, impresión diferenciada y plantilla coherente.
- [x] Etiquetas: códigos, privacidad, impresión libre con aviso y reimpresión estable.
- [x] Recepción CN: lote/individual/parcial, concurrencia y servicios solicitados.
- [x] Administración: editor guiado, vista previa, permisos y versiones.
- [x] Analizar el ciclo de vida y documentar cierre/archivo sin caducidad arbitraria.
- [x] Pruebas funcionales, privacidad, SQL, UI-check y revisión visual; límites documentados.
- [x] Revisar choques, publicar rama y abrir PR #33 para coordinación (sin merge).

## Criterios de aceptación

Imprimir con el documento vacío sigue disponible. Guardar borrador no anuncia entrega a DTD.
El proveedor no recibe identidad personal del cliente ni puede cambiar la asociación por editar el Shipping Mark.
Reimprimir conserva el QR de la caja. Recibir no equivale a verificar artículos y nunca duplica cajas.
Todos los controles tienen etiqueta, foco y resultado coherentes. Los totales son información, no botones.

Entrega de implementación: [PR #33](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/33). Aceptación reabierta por los dos hallazgos de acceso QR; entrega y despliegue se registran por separado. La migración sigue pendiente de autorización y aplicación.

## Coordinación

PR #30 / SDD-0442 es dueño de SupplierPicker, PortalAlertasHub, SuppliersClient, DocumentsClient y NewPurchaseButton.
SDD-0441 es dueño de tokens globales y marca. No editar esos archivos en esta tarea.
Las migraciones se preparan como archivos; aplicarlas a producción requiere autorización específica.

## Gobernanza

Aplican BTN-01, FRM-01, ERR-01, A11Y-01, AUD-01, MP-01 y CMP-01.
Clasificación inicial: no conformidad en exposición del nombre y ambigüedad de guardar/enviar;
cumplimiento en reutilizar tokens y conservar identidad de cajas; no aplica a pagos/firma legal.
Revisión de privacidad técnica con evidencia, sin afirmación de cumplimiento legal.

## Decisiones pendientes acotadas

No inventar una caducidad automática: mantener revocación explícita hasta acordar el plazo poscierre.
HS desconocido no se inventa; distinguir dato informado de clasificación revisada.
Pruebas desde China/WeChat y evaluación por proveedor nativo se reportan si no hay acceso representativo.

## Allowlist exacta

- app/m/cn/recibir/_components/RecibirClient.tsx
- app/m/cn/recibir/actions.ts
- app/m/cn/recibir/page.tsx
- app/m/cn/recibir/reception-flow.test.tsx
- app/m/cn/servicios/page.tsx
- app/p/[token]/PackingListFormSection.tsx
- app/p/[token]/packlist/route.ts
- app/p/[token]/page.tsx
- app/p/[token]/ProviderShareClient.tsx
- app/p/[token]/supplier-flow.test.tsx
- app/p/[token]/SupplierUploadSection.tsx
- app/portal/_components/ShareProviderButton.tsx
- app/portal/_components/ShippingBoxLabel.tsx
- app/portal/(app)/compras/[code]/etiquetas/LabelsClient.tsx
- app/portal/(app)/compras/[code]/etiquetas/page.tsx
- app/studio/(app)/admin/etiquetas/actions.ts
- app/studio/(app)/admin/etiquetas/LabelEditor.tsx
- app/studio/(app)/admin/etiquetas/page.tsx
- app/studio/(app)/admin/page.tsx
- app/studio/(app)/etiquetas/__tests__/white-label.test.tsx
- app/studio/(app)/etiquetas/_components/Label.tsx
- app/verificar/page.tsx
- docs/specs/0443-prealertas-proveedor-etiquetas-recepcion/coordination.json
- docs/specs/0443-prealertas-proveedor-etiquetas-recepcion/privacy-review.md
- docs/specs/0443-prealertas-proveedor-etiquetas-recepcion/qa.md
- docs/specs/0443-prealertas-proveedor-etiquetas-recepcion/spec.md
- lib/shared/label-presentation.ts
- lib/shared/print-document.ts
- lib/studio/label-presentation-queries.ts
- lib/studio/prealertas/__tests__/packlist.test.ts
- lib/studio/prealertas/packlist-draft.ts
- lib/studio/prealertas/packlist.ts
- lib/studio/prealertas/queries.ts
- lib/studio/prealertas/reception-instructions.ts
- public/templates/dtd-packing-list-invoice.xlsx
- scripts/build-packlist-template.mjs
- scripts/qa/prealertas-reception-concurrency.mjs
- supabase/migrations/0449_prealerta_exact_box_reception.sql
- supabase/tests/0449_prealerta_exact_box_reception.test.sql

## Corrección QR · 2026-09-06

Task pr33-qr-remediation-20260906. Director aprobó ampliar las rutas exactas:

- app/m/cn/login/page.tsx
- app/m/cn/login/actions.ts
- app/m/cn/login/qr-login.test.tsx
- app/m/cn/recibir/qr-entry.test.tsx
- .agents/handoffs/pr33-qr-remediation-20260906.md
- docs/specs/README.md

Se conserva únicamente box validado con isBoxCode; PIN correcto retorna a una ruta
interna fija. No se acepta returnTo arbitrario ni contextos múltiples. found:false
muestra su error recuperable; excepciones inesperadas usan copy genérico, sin detalle
interno. Reintentar vuelve a consultar y nunca confirma recepción automáticamente.
Criterios QR cubiertos con pruebas focalizadas; aceptación global aún en revisión.

## Concurrencia en la suite SQL · 2026-09-19

Seguimiento sin número nuevo, asignado por el Director (`dtdcargo-18`). La 0449 no se
toca. La frase de «Criterios de aceptación» que la da por pendiente quedó
desactualizada.

**La 0449 en producción** (verificado por `dtdcargo-18` el 2026-09-19, leyendo sólo el
catálogo, sin filas):

- **Ledger:** `20260910170544 · 0449_prealerta_exact_box_reception`, aplicada el
  2026-09-10 a las 17:05:44 UTC.
- **El archivo no es idéntico byte a byte.** El ledger tiene md5 `fd78ded2…` y
  11 195 bytes. El archivo en `main` tiene `8f3c228d…` y 11 385 bytes, porque dos commits
  del 2026-09-10 (`ff08ef99` y `4de236f3`) editaron la cabecera después de aplicar.
  Tampoco coincide el original (`e2ec0adc`: `fb992504…`, 11 179 bytes). Fuera de los
  comentarios, el SQL de `e2ec0adc` y el de `main` son iguales. La cabecera no se corrige.
- **Los cuerpos sí coinciden exacto.** El `md5(prosrc)` de producción es el mismo que
  deja el fixture de la carrera; las tres funciones son DEFINER y ninguna otra migración
  las redefine:
  - `receive_prealerta_boxes_as_operario`: `bf85211e…`, 6350 bytes;
  - `save_shipping_label_presentation`: `f6550630…`, 1332 bytes;
  - `reconcile_labels_after_packing_list`: `66889600…`, 804 bytes.

  La carrera prueba exactamente lo que corre en producción.

**Corrección de la evidencia anterior.** El `qa.md` afirmaba, con
`scripts/qa/prealertas-reception-concurrency.mjs`, que dos llamadas simultáneas dejan
una recepción y tres cajas. El script lanza las dos llamadas con `Promise.all`, sin
barrera, así que su verde no demuestra que compitieran. Además no corría en `verify`. El
script se conserva.

**`supabase/tests/0449_recepcion_prealerta_carrera.test.sql`** corre en el paso
`sql-tests` de `verify` (no en CI). Usa sesiones reales por dblink contra una base
propia, el fixture del contrato 0449 y una barrera por `pg_blocking_pids` que también
exige el tipo de lock en que espera la segunda sesión. Cada escenario corre primero con
una variante sin el lock que defiende, que tiene que reproducir el defecto, y después con
la 0449:

| # | Escenario | Sin el lock (control) | Con la 0449 |
|---|---|---|---|
| 1 | Las mismas cajas, dos operarios a la vez (el del script) | Sin los tres locks: la segunda choca con el código WR- repetido | La segunda espera en el lock de la tabla y recibe «Las cajas cambiaron o ya fueron recibidas»; una recepción con tres cajas |
| 2 | Dos compras del mismo tenant a la vez | Sin el lock de la tabla: la segunda muere por el código WR- repetido | La segunda espera en el lock de la tabla; las dos reciben, con códigos consecutivos |
| 3 | La compra se cancela durante la recepción | Sin el FOR UPDATE de la compra: se recibe una compra cancelada y su estado termina en `recibida` | La recepción espera la fila y recibe «no está activa»; la compra sigue cancelada |
| 4 | Una caja se anula durante la recepción | Sin el FOR UPDATE de las cajas: aborta tarde, con «Recepción concurrente» | La recepción espera la fila y rechaza enseguida con «Las cajas cambiaron» |
| 5 | Dos administradores guardan las etiquetas con la misma versión | Sin el lock consultivo: la clave primaria rechaza con 23505. Sin la versión esperada: el segundo pisa al primero en silencio | El segundo espera en el lock consultivo y recibe «Otra sesión cambió las etiquetas» |
| 6 | Llega una lista de empaque durante la recepción | Sin el FOR UPDATE del trigger: el lote se redimensiona después de empezar la recepción | El trigger espera la fila de la compra y ya no cambia el lote |

**Mutantes de la 0449, con el runner real y fuera del repo.** Cada lock, quitado de a
uno, hace fallar sus escenarios:

- sin el lock de `warehouse_receipts_cn`: 1 y 2;
- sin el FOR UPDATE de la compra en la recepción: 3 y 6;
- sin el FOR UPDATE de las cajas: 4;
- sin el lock consultivo de las etiquetas: 5;
- sin la versión esperada: 5;
- sin el FOR UPDATE del trigger de conciliación: 6.

El contrato de una sola sesión solo detecta el de la versión esperada. El detalle y el
script de los mutantes están en el handoff `.agents/handoffs/0443-carrera-recepcion-0449.md`.

Rutas agregadas a la allowlist por este seguimiento:

- supabase/tests/0449_recepcion_prealerta_carrera.test.sql
- .agents/handoffs/0443-carrera-recepcion-0449.md