# Handoff · SDD-0563 · La factura en bolívares o yuanes no se convierte para cuadrar, y el borrador no cuenta

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19, en Caracas de 11:10 a 11:40 aprox. (UTC 15:10 a 15:40) |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0563-subdiario-sin-conversion-y-borradores` |
| Rama | `codex/sdd-0563-subdiario-sin-conversion-y-borradores`, desde `origin/codex/sdd-0562-subdiario-alineado` `997e9684`, porque necesita la prueba de paridad de la 0562, que no está en `main`. Después, con la base de la #287 mezclada en `8ca7f946` (`b059b8da`, que trae `main` con la 0558, `8d11ac77`), sin conflictos |
| SDD | [0563](../../docs/specs/0563-subdiario-sin-conversion-y-borradores/spec.md), `in-progress`. La reserva es `codex/sdd-reserve-0563` (`a53331fb`) y entró por cherry-pick |
| Estado | lista para revisión, con PR en borrador **apilada sobre la #287**; `pnpm verify` necesita turno del Director |
| Permisos | El Director pidió la SDD el 2026-10-19 («Junta 1, 2 y 3 en una sola SDD de seguimiento, después de la #287»). Sam había pedido alinear la 0557 («4. Para la siguiente tarea, alinear la 0557»). Eso cubre commits selectivos, push de la rama propia y PR en borrador. No incluye producción ni base de datos |

## OBJETIVO ORIGINAL

Son las decisiones del Director del 2026-10-19 sobre lo que midió la paridad de la SDD-0562, revisables por Sam. Las cita textuales la spec:
1. Tenant H se alinea hacia la radiografía. Después el Director lo precisó así, **como enmienda de la decisión 7**: «pasa a "no comparable" si hay al menos una factura VES o CNY abierta con saldo, con o sin asiento».
2. Filtrar los borradores en `fac` de la radiografía.
3. Fijar los dos casos teóricos con una prueba, si sale barata.

## COMPLETADO

- **«Por contabilizar»** (`lib/studio/accounting/subdiario.ts`):
  - en clientes solo suman USD y USDT, y la VES ya no se convierte con su tasa;
  - la factura abierta con saldo en VES o CNY se cuenta en `sinConvertir` y vuelve «no comparable» la 1.1.2;
  - el orden de los estados no cambia;
  - las notas dicen por qué (`libro-control.ts`).
- **Radiografía** (`scripts/qa/radiografia-integridad.sql`):
  - en el `case` del estado, 1.1.2 es «no comparable» también con `fuera`; la condición está escrita una sola vez y aplica solo a 1.1.2;
  - la cláusula de facturas excluye los borradores;
  - la fila 91 cambia su texto, la 96 queda en 0 como control y 2.1.1 no cambia.
- **Fixture:**
  - FP3 en P, un borrador VES con asiento vivo, es la trampa del filtro;
  - FN1 (N) pasa a pagada y FS2 (S) a USD. Sin esos dos cambios, N y S quedaban «no comparables» por su factura abierta y eso tapaba sus trampas. Lo destapó el mutante «solo con los recibos reclasificados», que dejó de morir.
- **Paridad** (`scripts/__tests__/subdiario-radiografia-paridad.test.ts`):
  - (d) compara el estado **completo** de 1.1.2 tenant por tenant, con la equivalencia de la spec, y exige que la fixture recorra todos los estados;
  - (e) es el control: con la regla anterior de la radiografía, A y H dejan de coincidir;
  - (f) H: FH2 está en «sin asiento» y vuelve «no comparable» la cuenta;
  - (g) y (h) son los dos casos teóricos, como escenarios que se deshacen.
- **Specs 0557 y 0559:** llevan la nota de la enmienda.
- **Guarda de Git** (`radiografia-integridad.test.ts`): ahora tiene el tope de las pruebas lentas, porque en el `verify` de la #287 tardó 20940ms bajo carga.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `vitest run` radiografía, paridad, `lib/studio/accounting`, contabilidad, reportes, `lib/studio/reports`, dirección y dashboard | lo tocado y sus consumidores | PASÓ: `Test Files  29 passed (29)`, `Tests  554 passed (554)` |
| `radiografia-integridad.test.ts` sola | fixture, filas esperadas y 3 mutantes nuevos | PASÓ: `Tests  95 passed (95)`. Las 25 diferencias de `cambia` se explicaron una por una contra la fixture antes de escribirlas; ninguna se copió de la corrida |
| `subdiario-radiografia-paridad.test.ts` | la paridad completa y los escenarios | PASÓ: `Tests  10 passed (10)` |
| Control rojo, 7 mutantes, restaurados por copia con la huella sha256 igual antes y después | S1 vuelve a convertir la VES; S2 la abierta no vuelve no comparable; S3 «no comparable» antes que «cuenta no encontrada»; S4 la nota vieja; S5 el rollup sube la huérfana; R1 la radiografía cuenta el borrador; R2 la radiografía sin la enmienda | `MUERTOS 7/7 · restaurados 7/7`. R2 dio primero «no tests» (el archivo lanzaba al cargarse); se corrigió para que lo diga una aserción y repetido dio `Tests  4 failed | 6 passed (10)` |
| `typecheck`, eslint `--max-warnings=0` (7 archivos), `check-rsc-boundary` | repo y archivos tocados | PASÓ |
| `docs:check` (549 specs), `sdd:check`, `governance:check`, `components:check`, `migrations-lock verificar` | documentación y candado | PASÓ |
| `pnpm verify` sobre `ce4e8ee6` (turno del Director, 2026-10-19 desde las 15:36:53Z) | completo | NO CONCLUSIVO. Se apagó el equipo de Sam (lo confirmó el Director). Pasaron harness, lint, rsc-boundary, typecheck y edge-functions; el registro se corta a las 15:41Z dentro de `test`, sin ninguna línea FALLÓ. Se repite sobre la cabeza con la base `b059b8da` (`main` con la 0558) |

## Impacto documental y conocimiento

La spec 0563, la nota de la enmienda en las specs 0557 y 0559, y el índice. No hay cambios de esquema ni de RBAC. En pantalla cambian solo el estado y las notas de «Por contabilizar», y solo con facturas VES o CNY abiertas; en producción hoy no hay ninguna (radiografía del 2026-10-18). No pasó por `/ui-check`: no hay pantalla nueva ni cambio visual, solo dos textos de nota. Graphify y Archify los publica el Director desde `main`.

## PENDIENTES DE ESTA TAREA

1. `pnpm verify` con turno del Director.
2. Integración: **primero la #287**. Cuando se fusione, esta sesión cambia la base de la #288 a `main` (`gh pr edit 288 --base main`), como pidió el Director, porque el CI de quality solo corre contra `main`, y trae `main` si hace falta. No lleva migración; el merge publica por el VPS.

## FUERA DE ALCANCE DETECTADO (para el Director)

1. **La subcuenta huérfana no es solo teórica.**
   - Qué pasa: `validateAccountInput` (`lib/studio/account-types.ts`) no exige que exista la cuenta padre, y `buildAccountTree` sube las huérfanas a la raíz. Pero `computeBalances` (`lib/studio/account-queries.ts`) sube una cuenta solo a su padre directo. Con `1.1.2.9.1` sin `1.1.2.9`, el saldo no llega a 1.1.2.
   - Dónde se nota: en «Por contabilizar» (la prueba (h) lo fija) y, por la misma regla, en el total del grupo en Reportes.
   - Opciones: subir al ancestro más cercano (el mutante S5 lo hace y solo rompe la prueba que lo fija) o exigir la cuenta padre al crear.
   - **Decidido por el Director (2026-10-19):** exigir la cuenta padre en `validateAccountInput`, en una SDD aparte y después de la #288. El rollup al ancestro no hace falta: midió producción, solo el catálogo y en solo lectura, y encontró 91 cuentas y 0 huérfanas. La prueba (h) se queda como documentación hasta que entre esa SDD.
   - **Otro camino a la huérfana, para esa SDD:** `deleteAccount` (`app/studio/(app)/contabilidad/actions.ts`) deja eliminar una cuenta intermedia sin movimientos aunque tenga subcuentas. Las que no tienen `parent_id` (el cajón lo deja opcional) quedan huérfanas. Si esa SDD no lo cubre, va como FUERA DE ALCANCE.
   - **Corrección:** un texto anterior decía que «el plan de cuentas permite» renombrar la 1.1.2. No es así: `updateAccount` no cambia el código. El escenario (g) lo hace con un `update` directo, que la base acepta, y por la pantalla lo que se puede es eliminar la 1.1.2 si no tiene movimientos. Corregido en la prueba y en la spec.
2. **«Sin cuenta 1.1.2»:** «Por contabilizar» dice «cuenta no encontrada»; la radiografía no tiene ese estado y dice «sin movimiento en el mayor». Queda fijado en (g). Para la fila 91 no importa, porque ninguna de las dos lo cuenta como «no comparable».
3. **Un mutante viejo quedó solo con su fila de documentos.** «Facturas abiertas sin "vencida"» ya no mueve el estado de A, que ahora es «no comparable»: sigue muriendo por la fila 50. Pasa lo mismo con cualquier cambio a la suma en USD de la radiografía: con una VES o CNY abierta gana «no comparable», así que ya no se ve en el estado.
