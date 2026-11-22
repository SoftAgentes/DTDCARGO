# Handoff — temporizador de ActionButton que sobrevive al desmontaje

Fecha: 2026-11-21. Task ID: `actionbutton-timer-desmontaje`.
Owner: Worker Claude Code (sesión `dazzling-einstein-a92a6c`), asignado por Dir_DTD.
Rama: `claude/dazzling-einstein-a92a6c`.

## Síntoma

En el job «Calidad local sin secretos», paso «Unitarios» (run 44967288416, PR #760), pasaron las 21572 pruebas, pero vitest terminó en rojo por `Unhandled Error: ReferenceError: window is not defined`, con traza en `ActionButton.tsx:143` → `dispatchSetState`. El `setTimeout` del flash de éxito seguía vivo tras desmontar y se disparaba con el jsdom ya cerrado.

## Causa y arreglo

`handleClick` hacía `setTimeout(() => setSuccess(false), successMs)` sin guardar el id ni limpiarlo. Ahora el id vive en un `useRef`, se limpia en el cleanup de un `useEffect` al desmontar y se reemplaza si llegara a armarse otro. El comportamiento visible (flash verde `successMs`, botón deshabilitado durante loading y success, SDD-0678) no cambia.

## Allowlist exacta

- `app/studio/_components/ui/ActionButton.tsx`
- `app/studio/_components/ui/ActionButton.test.tsx` (nuevo)
- `.agents/handoffs/actionbutton-timer-desmontaje.md` (este archivo)

No hay SDD nuevo: es una corrección de defecto sin cambio de comportamiento ni de contrato.

## Pruebas

`ActionButton.test.tsx` (timers falsos):
1. el flash aparece y vuelve a idle pasados `successMs`;
2. al desmontar durante el flash, `vi.getTimerCount()` es 0 (sin el arreglo queda 1 y la prueba falla) y avanzar los timers no lanza.

Estado de ejecución: ver sección «Evidencia» al final.

## Revisión de otros componentes en `app/studio/_components/ui/`

- **`SplitActionButton.tsx:249`** — MISMO PATRÓN: `setTimeout(() => setSuccessKey(null), successMs)` sin cleanup. Es candidato idéntico a la misma falla intermitente. No lo toqué (fuera de la allowlist); conviene una tarea corta aparte.
- `ClientCombobox.tsx:108`, `ConfirmDialog.tsx:228` (usa `holdTimerRef`), `ToastProvider.tsx` (mapa de handles con «cleanup automático en unmount») y `useRowHighlight.ts:145`: no verifiqué su cleanup a fondo; solo confirmé que guardan el id. Revisar si se quiere cerrar el tema.

## FUERA DE ALCANCE DETECTADO

- `SplitActionButton.tsx:249` (arriba).
- `app/studio/CLAUDE.md` sugiere en sus ejemplos `setTimeout(() => setJustSent(false), 2500)` dentro de `onSuccess` sin cleanup: mismo patrón en los callers que copien ese ejemplo.

## Impacto documental

Ninguno.

## Evidencia

- `pnpm exec vitest run app/studio/_components/ui/ActionButton.test.tsx` con el arreglo: PASÓ (2/2).
- Mismo archivo con `ActionButton.tsx` revertido: FALLÓ la prueba de desmontaje (`getTimerCount` distinto de 0), 1 fallo y 1 pasa.
- `pnpm verify` completo: NO EJECUTADO (lo corre el CI de la PR); suite completa de vitest: NO EJECUTADA.
