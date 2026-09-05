---
sdd: "0443"
title: "Prealertas: proveedor, etiquetas y recepción por lote"
status: in-progress
author: "Codex con Sam"
created: 2026-09-05
updated: 2026-09-05
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
- [ ] Página del proveedor: referencias automáticas, privacidad y accesos directos.
- [ ] Editor amplio: acciones reconocibles, borrador versus envío, impresión diferenciada y plantilla coherente.
- [ ] Etiquetas: códigos, privacidad, impresión libre con aviso y reimpresión estable.
- [ ] Recepción CN: lote/individual/parcial, concurrencia y servicios solicitados.
- [ ] Administración: editor guiado, vista previa, permisos y versiones.
- [ ] Ciclo de vida: cierre separado de archivo, sin caducidad arbitraria.
- [ ] Pruebas funcionales, privacidad, SQL si aplica, UI-check y revisión visual.
- [ ] Revisar choques, publicar rama y abrir PR para coordinación.

## Criterios de aceptación

Imprimir con el documento vacío sigue disponible. Guardar borrador no anuncia entrega a DTD.
El proveedor no recibe identidad personal del cliente ni puede cambiar la asociación por editar el Shipping Mark.
Reimprimir conserva el QR de la caja. Recibir no equivale a verificar artículos y nunca duplica cajas.
Todos los controles tienen etiqueta, foco y resultado coherentes. Los totales son información, no botones.

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
