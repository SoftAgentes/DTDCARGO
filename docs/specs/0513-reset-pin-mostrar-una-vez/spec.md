---
sdd: "0513"
title: "Restablecer el PIN de un operario con uno generado y mostrarlo una vez"
status: in-progress
author: "Sam (founder) + Claude"
created: 2026-10-14
updated: 2026-10-14
supersedes: null
superseded_by: null
related: ["0085", "0174", "0235", "0251"]
confidencialidad: interno
---

# SDD-0513 — Restablecer el PIN de un operario con uno generado y mostrarlo una vez

> Cuando a un operario de la app del teléfono (`/m/cn`, `/m/ve`) se le olvida el
> PIN, un admin del Studio lo restablece con uno que genera el servidor, lo ve una
> sola vez y se lo pasa. El PIN sigue guardado solo como hash bcrypt.

## Objetivo

Hoy Studio › Operarios deja cambiar el PIN escribiéndolo a mano, y el cajón lo
prellena con `Math.random` en el navegador. Esta spec pasa la generación al
servidor, muestra el PIN una vez con aviso y copia, y conserva el camino manual.

**Decisión de Sam (2026-10-14, AskUserQuestion, opción elegida literal):**
«Restablecer y mostrar (Recomendado)». Un botón «Restablecer PIN» genera uno nuevo
y lo muestra una sola vez; el PIN sigue sin poder leerse en la base y la auditoría
registra quién lo restableció. Sam descartó «Ver el PIN guardado».

## Criterios de aceptación

1. **Generado en el servidor.** «Generar PIN nuevo» llama a
   `generateOperarioPinAction`, que sortea con `crypto.randomInt` (nunca
   `Math.random`) **después** del candado de rol, ignora cualquier `pin` del
   formulario y nunca produce un PIN que `public.validate_operario_pin_format`
   rechace (4 dígitos, fuera de los 24 comunes). Evidencia:
   `lib/studio/__tests__/operario-pin.test.ts` (20.000 sorteos, muestreo de
   rechazo sin sesgo) y `lib/studio/__tests__/operario-pin.migration.test.ts`
   (la función SQL real en PGlite: mismo conjunto sobre los 10.000 PIN y 5.000
   sorteos sin una excepción).
2. **El mismo candado.** Solo admin y operations restablecen (el
   `moduleEditDenial(…, "operarios")` de siempre y `assert_studio_role` dentro de
   la RPC desde 0351). Los otros cinco roles, un usuario desactivado y una sesión
   vacía reciben la denegación, sin sorteo ni llamada a la RPC. Evidencia:
   `app/studio/(app)/operarios/__tests__/reset-pin-actions.test.ts`, con el gate
   real.
3. **Se ve una vez.** El PIN viaja solo en la respuesta de la action y en el
   estado del cajón: grande, con «Copiar PIN» y el aviso «Anótalo ahora: no se
   vuelve a mostrar.». Al cerrar (Listo, Cerrar, Escape o clic afuera) o recargar,
   desaparece. No se escribe en localStorage, sessionStorage, URL, historial,
   consola ni en ninguna tabla. Evidencia: `ResetPinDrawer.test.tsx` y la suite de
   actions (espías de consola, RPC y tablas).
4. **El camino manual se conserva.** «Escribirlo yo» arranca vacío; los PIN
   comunes se rechazan en vivo y en el servidor con tuteo, sin llegar a la base
   (cuyo mensaje dice «Elegí», con voseo).
5. **Auditoría de quién y a qué operario, sin el PIN. — PENDIENTE, requiere
   migración.** Hoy el restablecimiento no deja ningún evento: `audit_entity_types`
   no tiene `operario`, `append_audit_event` solo lo ejecuta `service_role` y
   AUD-01 §1 y §4 exigen el evento en la misma transacción que el cambio de
   credencial, así que un registro aparte desde TypeScript no cumple. La forma que
   cumple es una migración que registre la entidad y haga que
   `admin_reset_operario_pin` escriba el evento (actor, operario, tenant; nunca el
   PIN) dentro de su transacción. El número lo asigna el Director y aplicarla
   necesita el OK nominal de Sam. Sin esto, la spec no pasa a `done`.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/studio/operario-pin.ts` | nuevo · validador espejo del SQL, copy en tuteo y sorteo por rechazo (puro, apto para cliente) |
| `lib/studio/operario-pin-generator.ts` | nuevo · `server-only`, inyecta `crypto.randomInt` |
| `app/studio/(app)/operarios/actions.ts` | `generateOperarioPinAction` nueva; la manual valida con el espejo y usa tuteo |
| `app/studio/(app)/operarios/_components/ResetPinDrawer.tsx` | dos modos, revelado único, copiar, sin `Math.random` |
| `app/studio/(app)/operarios/_components/OperariosClient.tsx` | botón «Reset PIN» → «Restablecer PIN» |
| `app/studio/(app)/operarios/_components/EditOperarioDrawer.tsx` | subtítulo que nombra «Restablecer PIN» |
| `lib/studio/rbac-actions-guard.test.ts` | inventario de acciones 428 → 429, con la justificación escrita |
| `lib/studio/__tests__/operario-pin.test.ts` | nuevo |
| `lib/studio/__tests__/operario-pin.migration.test.ts` | nuevo (PGlite) |
| `app/studio/(app)/operarios/__tests__/reset-pin-actions.test.ts` | nuevo |
| `app/studio/(app)/operarios/_components/ResetPinDrawer.test.tsx` | nuevo |
| `docs/specs/0513-reset-pin-mostrar-una-vez/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `docs/architecture/module-sdd-map.md` | fila de Operarios |
| `.agents/handoffs/0513-reset-pin-mostrar-una-vez.md` | handoff |

Sin migración, sin RPC nueva y sin cambios de policy.

## Revisión de datos (`/revisar-datos-ve`)

Advisory; no afirma cumplimiento. El PIN es una credencial de acceso a datos
operativos y personales en `/m/cn` y `/m/ve`.

| Punto | Estado | Evidencia |
|---|---|---|
| Minimización: el PIN en claro solo existe en la action, la respuesta y el estado del cajón | CORRECTO | `actions.ts` (`generateOperarioPinAction`), `ResetPinDrawer.tsx` (`PinReveal`); suites de actions y UI |
| No persistencia del PIN en claro (logs, tablas, URL, almacenamiento del navegador) | CORRECTO en el código revisado | espías en `reset-pin-actions.test.ts` y `ResetPinDrawer.test.tsx`; Sentry no está en `package.json` |
| El PIN se guarda solo como hash bcrypt | CORRECTO | `0351_operario_rpc_exige_rol.sql` (`crypt(p_pin, gen_salt('bf'))`) |
| Portapapeles | NO VERIFICABLE | «Copiar PIN» lo deja en el portapapeles del equipo del admin a pedido suyo; su vida ahí depende del sistema operativo |
| `pin_hash` legible por cualquier rol del tenant | ENCONTRADO (fuera de alcance) | `0021_operario_admin_rpcs.sql:178-184` y `0023_operario_region.sql:38`: `grant select` de tabla a `authenticated` con policy solo por tenant. Un bcrypt de 4 dígitos se revierte probando 10.000 valores; NO VERIFICADO contra producción |
| Auditoría del cambio de credencial | ENCONTRADO (criterio 5) | ningún evento hoy; ver arriba |

Marco citado desde `references/`: Ley Especial contra los Delitos Informáticos,
arts. 20-22 (obtención y revelación indebida, responsabilidad penal); PIPL art. 51
(control de permisos) por el equipo de Yiwu. Esto no es asesoría legal.

## Gobernanza

- **AUD-01:** no conformidad **preexistente** (el restablecimiento manual tampoco
  audita); esta spec no la introduce y la deja como criterio 5.
- **BTN-01:** cumplimiento — una primaria por cajón («Restablecer PIN», luego
  «Listo»), Cancelar a la izquierda, carga «Restableciendo…».
- **CMP-01:** usa componentes `canonical` (`SegmentedControl`) y el shell de cajón
  compartido; ningún consumidor nuevo de un `deprecated`.

## Riesgos

Un PIN generado que coincida con el de otro operario activo del mismo tenant y
región deja fuera a los dos, porque el login exige una sola coincidencia
(`0325`); la probabilidad por restablecimiento es k/9.976, con k los demás
operarios activos de ese tenant y región, ya existía con el PIN manual y la
corrección necesita migración.
