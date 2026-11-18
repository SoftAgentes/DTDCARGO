# Handoff: SDD-0656, oleada B (tipos y herramientas)

- **Owner:** Claude Worker (`sdd-0656-b`).
- **Autorización:** Sam aceptó D4 y D5 (TS 6.0.3, ESLint 9.39.5) el 2026-11-17, con «Sí, las 6». El DG encargó la B y coordina el turno de PC.
- **Rama:** `claude/0656-b-tipos`, con base en `origin/main` `96bb2b4de`.
- **Alcance:**
  - `@types/node` de ^20 a ^24.19.2.
  - `typescript` de ^5 a 6.0.3.
  - `eslint` de ^9 (9.39.4) a 9.39.5.
  - `vitest` y `@vitest/ui` de 4.1.12 a ^5.1.0.
  - pnpm de 11.19.0 a 11.28.12, en `Dockerfile` (2 pins), `quality.yml`, `sql-tests.yml` y `chatwoot-portal-poc.yml`.
  - jsdom **se queda en ^29.1.1**: decisión del DG, ver abajo.

## Cambios de código y pruebas

| Archivo | Por qué |
|---|---|
| `app/studio/(app)/tesoreria/_components/TesoreriaClient.tsx` | TS 6 marca TS2871 («expression is always nullish») en el `?? null` anidado dentro del ternario. Se parte en `payableDeLaCola`, con la misma semántica |
| `scripts/__tests__/ci-workflow-contract.test.mjs:36` | El contrato fija la versión de pnpm del CI. Pasa de `11\.19\.0` a `11\.28\.12`, con el mismo patrón estricto |

**Prueba del cambio de Tesorería.** `TesoreriaClient.cxp-saldada.test.tsx` cubre las dos ramas del ternario:
- La de la cola: «si la CxP YA está en la cola, no pide la consulta al servidor» y «tras volver a la cola con saldo, el drawer muestra el saldo FRESCO, no el consultado».
- La de la consulta: «la fila de la orden abre la CxP aunque NO esté en la cola».

El archivo pasó en la corrida completa con TS 6 y Vitest 5.

## jsdom 30: pendiente para la oleada C

Con jsdom 30 fallaron 27 pruebas que dependen de internos de jsdom:
- `app/m/erp/_components/MobileErpClient.fechas-caracas.test.tsx` (18) y `lib/portal/__tests__/payment-report-ui.test.tsx` (8). Sus fixtures llenan el FileList nativo leyendo el símbolo interno `impl`. En jsdom 30, `Object.getOwnPropertySymbols` de un FileList o un File da `[]`, y tampoco existe `DataTransfer`. La guarda del fixture salta, como está diseñada.
- `app/studio/(app)/_components/comments/CommentsThread.test.tsx` (1): `toHaveStyle` ya no ve `flex: 1 1 12rem` ni `minWidth: 0`, por el motor de CSS nuevo de jsdom.

Decisión del DG: jsdom queda en 29 dentro de la B. La 30 pasa a una tarea aparte, junto con la reescritura de los dos fixtures, sin debilitar pruebas. Ya está anotado en la spec como pendiente de la oleada C (PR de seguimiento, rama `claude/0656-seguimiento-docs`).

## Validación

Windows, Node 24.22.1 local, pnpm 11.28.12.

| Comprobación | Resultado |
|---|---|
| `install` con pnpm 11.28.12 | PASÓ |
| `install --frozen-lockfile` | PASÓ |
| `typecheck` | PASÓ, después del arreglo de Tesorería |
| `lint` | PASÓ: 0 errores, 32 advertencias, las mismas que antes |
| Conteo de pruebas | 19.365 activas en main y en la B. La B suma 32 omitidas; tiene 1.211 archivos activos y 4 omitidos |

**Las 32 omitidas no son nuevas.** Main ya las tenía: la corrida completa de la A2 dio «2 failed | 18802 passed | 32 skipped». No aparecen en la fila de main porque `vitest list` no cuenta las pruebas omitidas.

Primera corrida completa, con jsdom 30: 19.335 pasaron y 30 fallaron.
- 27 son de jsdom 30.
- 1 es el contrato del pin de pnpm, ya corregido.
- 2 son tiempos agotados por carga: `infra/ops/tests/migraciones.test.mjs`, a los 600 s, igual que en la A2, y `lib/studio/__tests__/solo-superadmin-crea-admin.migration.test.ts`.

El `build` no se ejecutó: se cortó al pasar el turno de PC a otra tarea.

Pendiente, con el turno de PC: `install` con jsdom 29; repetir los 6 archivos que fallaron y la prueba de Tesorería; y correr el `build`.

## Cierre con jsdom 29 (turno de PC del DG)

| Comprobación | Resultado |
|---|---|
| `install`, con jsdom 30.1.3 → 29.1.1 | PASÓ |
| `install --frozen-lockfile` | PASÓ |
| Los 6 archivos que fallaron, más `TesoreriaClient.cxp-saldada` | 7 archivos, 215/215 PASÓ. `CommentsThread` pasa sin tocar la aserción |
| `build` | PASÓ en 220 s |
| Suite completa | NO EJECUTADA otra vez, por orden del DG: la valida el CI |

Los avisos de Supabase del build son los de siempre: el build local no tiene `NEXT_PUBLIC_SUPABASE_*`.
