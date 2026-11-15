# Handoff · SDD-0603, tramo 5e: archivos liberados (barra superior, ficha de usuario, factura, imprimibles, Mis reportes y un reporte)

- **Owner:** Claude (Worker), sesión abierta por el Subdirector Rebrand (`local_9104159b-a41d-4fd2-bde2-63c17443a370`).
- **Worktree:** `.claude/worktrees/0603-t5e-liberados-6ea340`. **Rama:** `claude/0603-t5e-liberados-6ea340`, desde `claude/rebrand-base-main` = `origin/main` `cb240b17f`.
- **SDD:** 0603 (BD-037), con `Aviso` de SDD-0628. Detalle por archivo, excepciones, aceptación y gate VIS-01 en `docs/specs/0603-claridad-controles/tramo-5e.md`. `spec.md` no se edita.
- **Encargo:** aplicar BD-037 a los 8 archivos de la allowlist (`rebrand-0603-allowlist-t5e-cb240b17f.txt`), que estaban detenidos por las PRs #515 y #509. Contrato nuevo, `/ui-check`, pruebas focales y PR lista para revisión. Sin Auto-fix, sin traer main, sin fusionar.

## Hecho

- Avisos: 9 `<Aviso>` en 3 archivos. Seis en la ficha de usuario, uno en la factura (créditos de referido sin liberar) y dos en «Embarques sin facturar».
- Filas: Mis reportes trae «Abrir» («Abrir reporte <folio>») bajo cada tarjeta; la tarjeta sale del Tab y sigue abriendo con el ratón.
- Controles: «Volver al listado» (factura) y «← Reportes» pasan a secundario `-sm`; los vínculos de cliente y cotización de la factura dejan el vino (`studio-link-quiet`); los ítems del menú de usuario suben de 29 a 32 px.
- Sin cambios, a propósito: recibo de cobranza, expediente legal y rendición. Sus cajas de estado van dentro del papel.
- Prueba nueva: `claridad-t5e-contract.test.ts`, con cuenta exacta por archivo, vigilancia del papel y 8 mutantes.

## Decisiones

- El papel no se toca: `Aviso` pinta con `.studio-aviso*` y un icono que las hojas de impresión no anclan al tema claro. El contrato impide que entre un `<Aviso>` a esas tres páginas.
- De `alert` a `status`: «Es tu propio correo…» y el aviso de créditos de la factura, porque son persistentes y no responden a una acción. El aviso equivalente de Fidelización quedó `urgente` en el tramo 4d; queda anotado por si se quiere unificar.
- «Copiar enlace» se queda dentro del aviso como hijo y no como `accion`, para conservar su `title` y su tamaño `-xs`. El enlace nunca se pinta.
- «Abrir» de Mis reportes va debajo de la tarjeta y no dentro: `BugCard.tsx` está fuera de la allowlist.
- Los códigos de referido del aviso de la factura pierden el cajón: solo se leen.

## Validación

Turno de la PC concedido por el DG, vía el Subdirector Rebrand, el 2026-11-15. Corridas en serie.

- `pnpm install --frozen-lockfile`: PASÓ, 1 min 3 s. Sin junction al `node_modules` de main.
- Vitest focal (contratos `claridad-t5e`, `avisos`, `claridad-controles`, `dark-theme-contrast` y `browser-state`; `lib/studio/guia`; carpetas `usuarios`, `mis-bugs`, `facturacion`, `reportes` y `(app)/_components`; `SinFacturarCard.test.tsx`): PASÓ, 37 archivos y 444 pruebas.
- Contrato nuevo solo: PASÓ, 26 pruebas; 8 mutantes muertos dentro del contrato.
- `tsc --noEmit`: PASÓ.
- ESLint de los 5 archivos tocados y el contrato: PASÓ.
- `/ui-check` sobre el diff: PASÓ, OK con ajustes menores. Media: la tarjeta de Mis reportes crece unos 44 px. Baja: `marginBottom: 14` heredado en la factura, fuera de la escala de 4 px.
- Mutantes sobre los archivos reales: NO EJECUTADO. Los mutantes corren en memoria dentro del contrato, para no tocar el árbol.
- `pnpm verify` local: NO EJECUTADO. Lo cubre el CI de GitHub.
- Vista en pantalla con datos, en claro, en oscuro y en compacto: NO EJECUTADA.
- Impresión de recibo, expediente y rendición: NO EJECUTADA; los tres archivos no tienen diff.

## Impacto documental

Nuevo `tramo-5e.md`. Sin cambios en documentos canónicos ni en `spec.md`.

## Pendientes de esta tarea

- Revisión visual de Sam en la imagen de prueba: ficha de usuario (franjas en lugar de texto verde o rojo), aviso de créditos en una factura anulada, Mis reportes con «Abrir», menú de usuario.
- Revisión del Subdirector contra la allowlist y revisión independiente del DG.

## FUERA DE ALCANCE DETECTADO

- Mis reportes, chips del resumen: «Total» con relleno de tinta se lee como oprimible y no lo es; además traen colores de respaldo en hex.
- `BugCard.tsx`: folio en vino y `MiniBadge` propio. Meter «Abrir» dentro de la tarjeta pide editarlo.
- Factura: el código del encabezado va en un cajón con contorno y solo se lee.
- Menú de usuario: «Admin» y «DTD» están fijos en el código, no salen del rol real.
- Roles: `StrandedCreditsBanner` de Fidelización es `urgente` y el aviso de la factura ahora es `status`; falta decidir uno solo.
