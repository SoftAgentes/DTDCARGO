# Handoff · SDD-0699 — Cascada al cambiar el dueño (embarque reasignado o clientes fusionados)

- **Owner:** Worker (sesión `peaceful-turing-f99fd0`), encargado por Dir_DTD; número 0699 confirmado por Dir_DTD el 2026-11-21.
- **Ruta:** `.claude/worktrees/peaceful-turing-f99fd0` · **Rama:** `claude/peaceful-turing-f99fd0` · base `main` (`2e174c818`).
- **SDD:** `docs/specs/0699-cascada-cambio-de-dueno/spec.md` (`draft`). Sin migraciones.
- **Permisos del encargo:** PR a `main` con el handoff. No fusionar. Sin producción ni Supabase Cloud.

## OBJETIVO ORIGINAL

Pedido de Sam (2026-11-21): al cambiar el cliente de un embarque, o al fusionar clientes, la factura, la pre-orden,
los pagos y todo lo que está atado se arrastran en cascada, con un aviso previo de qué cambia. Por ahora solo la spec.

## COMPLETADO

- Medición en `main` con archivo:línea (§2): 0551, 0361, 0466, 0467, 0497, 0552, 0492, 0122, RBAC, Portal y auditoría.
- Principios (§3), matriz del caso 1 (§4), fusión (§5), vista previa con huella, auditoría, permisos (§6) y fases F-0 a F-4 (§8).
- Nueve preguntas para Sam con opciones y recomendada (§9). Aceptación verificable para cuando se implemente (§10).

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ (678 specs) |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ (solo choques históricos ya conocidos) |
| `pnpm verify` | NO APLICA: la PR solo trae docs (spec, índice, handoff) |
| Ledger de producción (F-0): 0466, 0467, 0497, 0551, 0552, 0564 y 0569 | VERIFICADO por Dir_DTD el 2026-11-21 (solo lectura): aplicadas |

Los scripts se corrieron con `node` directo, sin `pnpm install`, porque el worktree no tiene `node_modules`.

## IMPACTO DOCUMENTAL

- Spec nueva y el índice `docs/specs/README.md` regenerado. Ningún documento canónico cambia.
- Cuando Sam conteste la §9, se enmienda la spec y la 0645 apunta a esta como su continuación.

## DECISIONES DE SAM (2026-11-21)

Sam aprobó, en el chat de Dir_DTD, las nueve opciones recomendadas: «SDD-0699: apruebo las nueve opciones
recomendadas». Dir_DTD se lo pasó a este Worker el mismo día. Quedaron en la §9 de la spec, que pasó a `approved`
(aprobada para planear). La reclasificación de la P4 está aprobada, pero contabilidad la valida antes de implementarla.

## REVISIÓN INDEPENDIENTE (6334e4940, CHANGES_REQUESTED) Y CÓMO SE ATENDIÓ

Comentario: https://github.com/SoftAgentes/DTDCARGO/pull/751#issuecomment-7068022803

- **H1, asiento:**
  - el recibo soltado no vuelve a `recibido_sin_ref`: pasa al estado nuevo `liberado`;
  - cuenta nueva 2.1.9 «Anticipos de clientes». Soltar es DR 1.1.2 / CR 2.1.9 y reaplicar, DR 2.1.9 / CR 1.1.2;
  - la 2.1.8 no se toca;
  - los asientos van en la misma transacción, con la fecha de la operación y la regla del cierre de la 0497;
  - el cuadre quedó como criterio de aceptación (§4.4.2-§4.4.3, §10 4b-4c).
- **H2, pagador:**
  - columnas congeladas `payer_client_*`;
  - RPC propia `apply_released_receipt`, con aplicación parcial (recibo hijo), y el resto como saldo a favor
    del pagador;
  - la casilla de la vista previa deja una instrucción que se aplica al emitir (§4.4.4-§4.4.5).
- **H3, dos pasos:** `ownership_change_requests`, preparar, confirmar, rechazar, cancelar y vencer a las 72 h. No
  confirma quien preparó, la huella se recalcula al confirmar, y la spec dice qué ve cada rol (§6.3).
- **Notas bajas:**
  - B1: un recibo `rendido` bloquea;
  - B2: una pre-orden que queda con total en 0 o menos bloquea;
  - B3: el total se conserva, con ±0,01 por pre-orden;
  - B4: los saldos de signo contrario se avisan y no se compensan;
  - B5: limpié las frases previas a la aprobación y la P7 completa;
  - B6: la 0464 y la 0494 quedaron como aplicadas, según Dir_DTD;
  - B7: lo del Portal en la fusión volvió a decir INFERENCIA.

## RE-REVISIÓN (0e64553fe, CHANGES_REQUESTED por H4) Y CÓMO SE ATENDIÓ

Comentario: https://github.com/SoftAgentes/DTDCARGO/pull/751#issuecomment-7068429690

- **H4:** se quitó el recibo hijo, y la spec adopta la alternativa de la revisión, una tabla `receipt_applications`:
  - el recibo es uno solo; su `amount` no cambia y el disponible se calcula;
  - un estado nuevo, `reaplicado`, para cuando el disponible llega a 0;
  - la tabla de lectores de la §4.4.7 dice cómo cuenta una sola vez cada uno: Reportes, «Por contabilizar», el
    cruce de 1.1.2 y 2.1.9, Rendiciones, Cobranzas y `client_outstanding`;
  - criterio 4f, por lector.
- **N1:** el cuadre se mide por cliente (con `client_outstanding` y los disponibles) y en el libro (total de 1.1.2
  más 2.1.9).
- **N2:** soltar un cobro sin asiento vivo bloquea con `cobro_sin_asiento` (§4.4.6, criterio 4g).
- **N3:** el cruce de la 1.1.2 suma los orígenes `receipt_release` y `receipt_reapply`.
- **Dato:** ningún tenant de producción tiene la cuenta 2.1.9. Lo verificó Dir_DTD el 2026-11-21, con solo lectura;
  la F-2 lo vuelve a medir.

## PENDIENTES DE ESTA TAREA

- Revisión independiente de la PR #751 (la lanza Dir_DTD).
- **F-0, hecha:** Dir_DTD la verificó el 2026-11-21 en el ledger, con solo lectura. 0466, 0467, 0497, 0551,
  0552, 0564 y 0569 están aplicadas; sus cabeceras «NO APLICADA» quedaron viejas y no se editan. Después midió
  igual 0464 y 0494: también están aplicadas.
- Validación de contabilidad de la P4, antes de la F-2.
- Cada fase trae su allowlist en una enmienda de la spec.

## FUERA DE ALCANCE DETECTADO

- Muchas cabeceras de migración dicen «NO APLICADA A PRODUCCIÓN», mientras que `migrations-baseline.json` tiene
  `pendingBelowCutoff` vacío. Las dos fuentes no coinciden, y conviene que Dir_DTD las concilie.
- `lib/studio/reasignar-embarque.ts:92-93` le dice a la oficina «Sepárala primero», pero el sistema no ofrece cómo
  separar una pre-orden. La F-1 lo resuelve; mientras tanto, el texto promete algo que no existe.
