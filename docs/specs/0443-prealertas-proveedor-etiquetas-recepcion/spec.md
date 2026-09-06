---
sdd: "0443"
title: "Prealertas: proveedor, etiquetas y recepción por lote"
status: in-progress
author: "Codex con Sam"
created: 2026-09-05
updated: 2026-09-06
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