# Handoff — SDD-0502 · mínimo facturable con batería configurable

Fecha: 2026-09-23. Task ID: `0502-minimo-bateria-configurable`.

- **Owner / sesión escritora:** `01a0cf85-0b0a-7a53-8817-e6cef69a8297` (Worker Codex). Sin subagentes.
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/calculadora-minimo-bateria-config`.
- **Rama:** `codex/calculadora-minimo-bateria-config`, creada desde `origin/main` `e9b7c4f43406a00d11068e032f07660e0391e821` después de `git fetch origin`.
- **SDD:** `docs/specs/0502-minimo-bateria-configurable/spec.md`, asignada por el Director y reservada de forma atómica antes de editar producto.
- **Estado:** en progreso; el stub canónico SDD-0502 ya está incorporado en `86abfc5d`. Todavía no hay cambios de producto ni PR.
- **Permiso de publicación:** Sam autorizó implementar, probar, commitear, publicar la rama y crear el PR. No autorizó merge ni despliegue; esas fronteras quedan para el Director.

## Objetivo autorizado

Corregir la calculadora pública para que, cuando una cotización caiga en la carga mínima y lleve baterías, el recargo se aplique sobre el mínimo facturable usando el multiplicador vigente de `public_calculator_config.battery_multiplier`.

No se hardcodeará `$100` ni un segundo multiplicador. Con piso `$50`, la configuración `×1.5` debe producir `$75`; si Administración cambia a `×2`, debe producir `$100` automáticamente.

## Aceptación

1. Sin batería, el mínimo vigente conserva su comportamiento.
2. Con batería y subtotal bajo el piso, el total es `piso × multiplicador configurado`.
3. Con batería y subtotal sobre el piso, se conserva el recargo configurado sobre el subtotal facturable.
4. El desglose visible reconcilia exactamente con el total, incluidos importes fraccionarios.
5. Los consumidores compartidos de `calcularEnvioLCL`, incluido document-import, mantienen contratos y reciben la regla corregida.
6. Pruebas de comportamiento prueban por lo menos `×1.5` y `×2`, de modo que la implementación anterior y un `$100` fijo fallen.
7. `pnpm verify` se ejecuta como cierre canónico; cualquier gate no disponible o fallido se reporta sin convertirlo en verde.
8. Se crea PR contra `main`; el Worker no mergea ni despliega.

## Alcance previsto

- `lib/calculadora.ts` y sus pruebas.
- Consumidor/pruebas de `lib/studio/document-import/estimate.ts` si el contrato compartido lo requiere.
- Presentación numérica mínima en `components/tarifas/CalculadoraPage.tsx` y su prueba, sin rediseñar la UI.
- SDD asignada, `docs/marketing/README.md`, `docs/marketing/calculadora-explicada.html` si corresponde y este handoff.

## Dependencias y límites

- La fuente de verdad de tarifa, mínimo y multiplicador sigue siendo la RPC/configuración de Administración; los respaldos del código no reemplazan esa configuración.
- No se cambia el módulo de Administración ni el esquema de base de datos.
- No se leerán filas de negocio ni PII, y no se aplicarán migraciones.
- El cambio central afecta a los consumidores de `calcularEnvioLCL`; Graphify se usa para identificar y volver a comprobar ese impacto.

## Incidente de coordinación SDD

El Director asignó inicialmente `0501` después de verificar carpetas, refs y worktrees. El Worker creó y publicó la reserva create-only `codex/sdd-reserve-0501`, commit `393aa37dff231ba1e888e03816fb5fb5b6bc563f`. Antes del primer cambio de producto, el Director detectó que el handoff canónico de cierre etiqueta de forma contradictoria otro trabajo como “SDD-0501”, aunque ese trabajo no tiene carpeta de spec. Ordenó no reutilizar el número y reasignó esta tarea a `0502`.

La reserva `0501` queda preservada y abandonada por colisión documental: no se borra, no se fuerza, no abre PR y no se recicla. El cleanup queda exclusivamente para el Director con autorización posterior. La reserva válida de esta tarea es `codex/sdd-reserve-0502`, commit `11ed19287734ff7966506ce82a6f552633b5ff19`; su stub se incorporó a esta rama como `86abfc5d`.

## Evidencia inicial

La implementación vigente multiplica el subtotal por batería antes de aplicar `Math.max(totalSinPiso, piso)`. En una carga base de `$17`, `×1.5` produce `$25.50`, pero el piso posterior la devuelve a `$50`; por eso el recargo aparece desglosado y luego es absorbido por el ajuste al mínimo. La UI además redondea cada renglón por separado, lo que puede impedir que el desglose visible sume el total.

## Validación acumulada

- PASÓ: `node scripts/build-docs-index.mjs --check` — 488 specs.
- PASÓ: `node scripts/check-numbering.mjs` — sin colisiones nuevas; sólo las excepciones históricas registradas.
- PASÓ: `git diff --check` antes del commit documental inicial.

## Pendientes de esta tarea

- Completar el commit inicial de SDD/handoff y publicar la rama antes del primer cambio de producto.
- Implementación, pruebas, documentación, Graphify/preview de conocimiento, commits adicionales y PR.

## Fuera de alcance detectado

- Merge a `main`, despliegue, migraciones o cambios manuales en producción.
- Cambiar tarifas o el valor actual del multiplicador desde este Worker.
- Limpiar o reciclar la reserva remota ambigua `codex/sdd-reserve-0501`.
