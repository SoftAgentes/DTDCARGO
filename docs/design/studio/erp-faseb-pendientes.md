# ERP Fase B — pendientes reportados (para Fase C) · 2026-07-10

> Salida del barrido mecánico de Fase B (los 40 módulos restantes, 2026-07-10). El barrido aplicó fixes seguros (spacing→tokens, motion→tokens, voseo→tuteo). Esto es lo que **NO** se tocó a propósito porque necesita criterio de diseño / un token nuevo / refactor de a11y — es el backlog de **Fase C**.

## 1 · ✅ CERRADO por SDD-0294 · `--wine` como TEXTO falla contraste en dark (SISTÉMICO)

> **Cerrado el 2026-08-25.** El token `--wine-text` bajó y se migraron los 48
> usos de `color: var(--wine)` que quedaban. Al medir, la prioridad estaba
> invertida: los 43 de `app/m/` **no** fallaban (el layout móvil fija
> `data-theme="light"`), y los 5 que sí fallaban estaban en el Studio.
> Detalle en `docs/specs/0294-wine-crudo-deja-de-ser-texto/spec.md`.

`color: var(--wine)` como texto da **2.79:1 en dark** (falla WCAG AA; medido). Aparece en **~100+ lugares** en todo el ERP: eyebrows (`.studio-eyebrow` inline), tabs/sort activos, links "→", códigos mono (folio/Shipping Mark), y `valueColor` de KPIs (también fallan, 2.79 < 3:1).

**NO se arregla línea por línea.** La corrección de raíz es el **token `--wine-text`** (light `#7F0F1A` / dark `#D89AA4`) — ya pedido a Cloud Design en `pedido-cloud-design-token-acento-texto-2026-07-10.md`. Cuando baje por NORTE-SYNC:
1. Migrar `color: var(--wine)` → `var(--wine-text)` en usos de texto (no en fills).
2. Considerar meterlo en la clase `.studio-eyebrow` de una vez (cubre el patrón dominante).

Muestras representativas: `dashboard/page.tsx:140`, `cn/AlmacenCnClient.tsx:626`, `seniat/SeniatClient.tsx:209`, `financiero-china/LedgerTab.tsx:312`, `academia/AcademiaClient.tsx:397`, `usuarios/UsersClient.tsx:115`, `tms/TmsClient.tsx:145`. (Lista completa en los transcripts de los 5 batches — es todo el ERP.)

## 2 · 🟡 Modales/drawers custom sin `DrawerShell` (~16)

Modales `role="dialog"` hand-rolled (scrim + `stopPropagation` manual) que NO usan el `DrawerShell` del sistema → sin focus-trap, sin Escape, sin foco inicial (WCAG 2.4.3 / 2.1.2). Migrar a `DrawerShell`:

- `embarques/_components/ShipmentDetailDrawer.tsx:61` ⚠️
- `cn/_components/NewReceiptDrawer.tsx:221` ⚠️
- `seniat/_components/FilingDetailDrawer.tsx:178` ⚠️ · `seniat/_components/CreateFilingDrawer.tsx:123`
- `usuarios/_components/UsersClient.tsx:376` (PermissionsByRoleModal)
- `tarifas/_components/RateDrawer.tsx:137` · `tarifas/_components/ImportRatesDrawer.tsx:51`
- `inspecciones/_components/ReportEditor.tsx:68`
- `marketing/noticias-web/_components/PublishModal.tsx:214` y `:355` · `ManualPromptModal.tsx:93`
- `legal/_components/LegalClient.tsx:786` y `:1214`
- `etiquetas/_components/SupplierMessageModal.tsx:115`
- `cola-qr/_components/QrQueueTable.tsx:324` · `ve/_components/VeRowActions.tsx:374` (PromptModal) · `admin/_components/calculator/CityDrawer.tsx:74`

⚠️ = los 3 con scrim hardcodeado `rgba(15,30,61,0.55)` inline → cambiar a `var(--scrim)`.

## 3 · ✅ CERRADO por SDD-0295 · `transition: all` (perf)

> **Cerrado el 2026-08-25.** Los 3 de abajo ya estaban corregidos… pero al
> barrer de nuevo había **17** en otros archivos, escritos después de julio.
> Este hallazgo no se paga una vez: vuelve a nacer con cada componente que
> tenga estados. Los 17 quedaron con la lista de propiedades que de verdad
> cambian en cada sitio (leída del componente, no copiada de plantilla).
> Detalle —incluidas las 3 decisiones que cambian algo visible— en
> `docs/specs/0295-animar-solo-lo-que-cambia/spec.md`.

- `academia/_components/AcademiaClient.tsx:873` · `academia/diplomas/_components/DiplomasClient.tsx:369` (`"all var(--dur-fast) var(--ease)"` — listar solo las props que animan).
- `marketing/noticias-web/_components/Step2Outlines.tsx:123` (clase Tailwind `transition-all`).

## 4 · 🟢 Trampas de teclado (`<tr onClick>`)

**Cero** en los 40 módulos restantes. Todas las filas accionables ya usan `<button>`/`<Link>` o `<ActionableRow>` (los core ya migrados en Fase A/B). Nada que migrar.

## 5 · 🟢 Notas de alcance del barrido

- **Spacing con `0` en compuestos** (`"8px 0 8px"`, `"0 12px"`) se dejó sin tokenizar (conservador). Pase opcional si se quiere `var(--s-2) 0 var(--s-2)`.
- **Spacing en render de PDF/impresión** (`inspecciones/ReportPreview.tsx`, `DiplomaPrint.tsx`, print CSS) se dejó a propósito: los tokens responden a densidad y alterarían el documento que recibe el cliente.
- **Inconsistencia menor:** algunos batches convirtieron `gap: 12` (número) → `"var(--s-3)"` (string) y otros lo dejaron. Ambos rinden idéntico en React; no requiere fix.
- **`--ink-mute` borderline como texto de-énfasis:** `debug/EstadoTab.tsx:623` (label "Preview") y `:664` (sha viejo) — dejados por conservador; Fase C puede evaluarlos.

---

*Generado del barrido mecánico Fase B (5 subagentes, 2026-07-10). Los `archivo:línea` son válidos al commit de cierre de Fase B; verificar antes de tocar por si hubo drift.*
