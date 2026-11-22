# Handoff · SDD-0582 — línea base v5 y corte de Kommo sin esperar el bot

- **Owner:** Worker `w-0582-v5`, sesión lanzada por el Director General · **Rama:** `claude/modest-brahmagupta-fc8f7e` · **Base:** `origin/main` `875767eaf`.
- **Objetivo:** dejar el plan 0582 al día (línea base v5), registrar las decisiones de Sam del 2026-11-19 y dar el camino al corte (E8) con días y fecha. Solo documentos y una prueba de harness.
- **Alcance (allowlist de la spec 0582):** `checklist.md`, `spec.md`, `scripts/__tests__/avance-checklist.test.mjs` (la prueba fija la línea base y exigía v4) y este handoff.
- **Permisos:** subir la rama y abrir la PR. Sin datos de producción, sin PII, sin montos. Sin `pnpm verify` ni instalación.

## OBJETIVO ORIGINAL

Volver a analizar el plan completo Kommo → Chatwoot, anotar los cambios no previstos desde el 2026-11-08, sacar la v5 y calcular lo que falta para el corte.

## COMPLETADO

- **Línea base v5 (2026-11-19):** alcance 129,5 → **127,75 d**; avance 49,0 % → **49,7 %** (63,5 d aceptados; no se aceptó nada nuevo).
  - E7 (bot propio, 18,5 d) sale como **fase posterior**: sus 11 pasos quedan `descartado`. Criterio: Sam dijo «no hace falta *ya*», no «no se hará»; el script solo saca del alcance lo descartado; el código de `dtd-bot` ya fusionado queda apagado en `main`. Retomarlo exige una v6.
  - La 7.3 (respaldo del conocimiento de la IA de Kommo) pasa a la **8.14**, porque se pierde al cancelar la licencia.
  - 8.1 y 8.2 ajustadas: el corte ya no espera a E7, y según Sam, el bot está siempre apagado, y el estado de la IA y de los Salesbots de Kommo se verifica en 8.1.
  - 14 filas nuevas (+16,75 d): 2.9–2.12, 4.10, 6.11–6.17, 8.14, 10.9. Sección «Cambios desde v4» con la evidencia (PR y SHA).
  - Estados corregidos: 10.5 y 10.7 pasan a `entregado` (chat del portal en producción desde 2026-11-15; smoke 5c de Sam). 10.8 con 0 restante. Nota vencida de 4.9 corregida: las alarmas del cupo y del token de Instagram **ya están en `main`** desde 2026-11-06 (`a3fa6df2c`); instalación en el VPS: NV.
- **Spec:** sección «Cambio de alcance v5: corte sin esperar el bot propio» con las tres decisiones de Sam citadas literalmente, el criterio sobre E7, el NV, y ajustes en alcance, metodología, aceptación del programa, allowlist y seguimiento.
- **Camino al corte (E8)** en el checklist, con dos escenarios (ver abajo).

## Aceptaciones

Ninguna. Marqué `entregado` lo que está fusionado o en producción sin aceptación de Sam documentada (2.9, 4.10, 6.11–6.15, 9.3, 10.5, 10.7–10.9). No inventé aceptaciones. Los días de 2.10, 2.11, 2.12, 6.16 y 6.17 son estimación del Worker; **Sam aprobó la estimación el 2026-11-19** (relatado por el DG; citas en el checklist). No es aceptación de los pasos. La 2.12 pasa a `entregado` con la #690 fusionada en `7f90d8483`.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/avance-checklist.mjs docs/specs/0582-chatwoot-piloto/checklist.md` | PASÓ (exit 0), salida abajo |
| `node scripts/build-docs-index.mjs --check` (`docs:check`) | PASÓ (655 specs) |
| `node scripts/check-numbering.mjs` (`sdd:check`) | PASÓ (solo choques históricos ya conocidos) |
| `git diff --check` | PASÓ |
| `scripts/__tests__/avance-checklist.test.mjs` (Vitest) | NO EJECUTADO: el worktree no tiene `node_modules` y no se instala. Lo revisé a mano: alcance, etapas, firma de días por paso y pesos por resto mayor se recalcularon con el mismo algoritmo y coinciden; el CI lo corre |
| `pnpm verify` | NO EJECUTADO (por encargo; cambio solo de documentos y de la prueba del harness) |

Salida de `avance-checklist`:

```
Etapa 3 de 11 · E2 Bandeja en Studio, usuarios y permisos · paso 2.9 · Avance 49,7 % (falta 50,3 %) · Esfuerzo: real 19,38 d, restante 42,75 d
Línea base v5 (2026-11-19) · alcance 127,75 d · aceptado 63,5 d
Cambio de alcance: v4 129,5 d → v5 127,75 d · avance antes 49,0 % → ahora 49,7 %
Ritmo real: 3,19 d base por día real · faltan ≈ 13,4 días de trabajo
Entregados sin aceptar: 2.9, 4.10, 6.11, 6.12, 6.13, 6.14, 6.15, 9.3, 10.5, 10.7, 10.8, 10.9
Esperando: ninguno
Bloqueados: ninguno
Por etapa:
  E0 Preparación y puertas: 5,5 de 5,5 d (100,0 %)
  E1 Chatwoot en el VPS: 4,75 de 4,75 d (100,0 %)
  E2 Bandeja en Studio, usuarios y permisos: 20,75 de 23,25 d (89,2 %)
  E3 Actualizaciones desde Studio: 5 de 5 d (100,0 %)
  E4 Canales en paralelo a Kommo: 2,25 de 10,75 d (20,9 %)
  E5 Historial de Kommo: 7,25 de 7,75 d (93,5 %)
  E6 Embudo propio y reemplazos: 11 de 36,5 d (30,1 %)
  E7 Bot propio (descartado de la línea base v5; fase posterior): 0 de 0 d (0,0 %)
  E8 Corte, salida de Kommo y limpieza del ERP: 0 de 10,5 d (0,0 %)
  E9 Guía interactiva «Antes en Kommo → Ahora aquí» (termina antes de 8.1): 3 de 9 d (33,3 %)
  E10 Enrutamiento por segmento (SDD hija nueva; se reserva al arrancar, después de 2.3): 4 de 14,75 d (27,1 %)
```

## Lo que falta para el corte (resumen; el detalle está en el checklist)

Antes del corte: 26 d base (Bandeja y 0566 2 · portal 2 · reemplazos de Kommo 11,5 · canales 4 · acta E5 0,5 · guía 4,5 · 8.14 y 8.1 1,5). Corte (8.2, 8.3): 0,75. Después: 8,25.

| Escenario | Fin del trabajo previo | Corte | Cierre de E8 |
|---|---|---|---|
| Ritmo del script (3,19), arranque 2026-11-23 | ≈ 2026-12-02 | ≈ 2026-12-09 | ≈ 2026-12-30 |
| 1:1 (cota prudente) | ≈ 2026-12-29 | ≈ 2027-01-05 | ≈ 2027-02-01 |

Inferencia: no cuenta las esperas de Sam, Meta ni revisión. **Instagram: el token vence el 2026-12-30**; la renovación (script ya en `main`) va antes del 2026-12-20 con OK de Sam, haya o no corte. Messenger queda fuera del corte (Sam, 2026-11-19, relatado por el DG: «Deja Messenger, no los cuentes, sé que no hay casi nada.»): la 8.3 corta solo Instagram; Messenger se conecta después o no se conecta.

## COMMITS

Se registran en la PR (un commit para checklist, spec y prueba; otro para este handoff).

## PR / BRANCH

Rama `claude/modest-brahmagupta-fc8f7e`; PR contra `main`, número en el aviso al DG.

## PENDIENTES DE ESTA TAREA

- Que Sam acepte, si quiere, los pasos `entregado` (ninguno está aceptado).
- CI de la PR (incluye la prueba de Vitest del checklist) y revisión independiente, que lanza el DG.

## FUERA DE ALCANCE DETECTADO

- **NV por verificar:** alarmas del cupo y del token de Instagram instaladas en el VPS; que C1 a C10 sigan aprobadas en la cuenta de Meta; aplicación de la 0553 en producción; que la 0554 y la 0566 sigan sin aplicar.
- El cable de la oficina (SDD-0626) usa Chatwoot como canal y no está en la línea base: ¿debe entrar? Lo decide el DG.
- La 9.3 sigue `entregado` con el botón «Guía» sin montar (espera la adopción de la SDD-0603): conviene revisar si la adopción ya ocurrió.
- Las specs 0647 y 0671 siguen en `proposed` aunque su código está fusionado.

## HANDOFF AL DIRECTOR

Revisar la PR; el checklist es la fuente del avance y la prueba `avance-checklist.test.mjs` fija ahora la v5. Decisiones que necesitan a Sam: confirmar v5 y estimaciones, arrancar la renovación del token de Instagram.

## Impacto documental

Documentos canónicos actualizados: `docs/specs/0582-chatwoot-piloto/{spec.md,checklist.md}`. `docs/specs/README.md` no cambia (`docs:check` PASÓ). Sin runbooks nuevos. Propuesta aparte, no decidida: borrar o archivar los recorridos de IA de la 9.5.
