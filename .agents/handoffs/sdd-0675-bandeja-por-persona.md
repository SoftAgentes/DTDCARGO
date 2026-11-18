# Handoff · SDD-0675 — Bandeja como acceso adicional por persona

Fecha: 2026-11-18 · Rama `claude/sdd-0675-bandeja-por-persona` · PR #686 · Reserva `refs/dtd/reservations/0675` ·
Migración asignada: 0565 (en espera; `pendingBelowCutoff`).

## Hecho

- Decisiones de Sam registradas literal (spec §0 y §5): «Leads y Clientes» (opción D de la SDD-0671) y
  «Sí, siempre las dos». La pregunta 2 («ver y editar») sigue sin respuesta; se aplica la recomendación: el
  administrador elige el nivel al conceder.
- F0: `supabase/migrations/0565_bandeja_concedible_por_persona.sql` suma `bandeja` a los 8 módulos de la 0538.
  - El preflight aborta si falta la 0538 o si se reaplica.
  - El postflight exige los 8 módulos de la 0538, uno por uno, más `bandeja`, con `admin` y `users` fuera y
    los privilegios iguales.
  - El desarme está en `supabase/desarmes/0565_desarme.sql`.
- F1: `bandeja` en `COVERED` (`lib/studio/user-module-grants.ts`).
- F2: el ciclo de agentes lee los accesos de `bandeja`. Si esa lectura falla, el ciclo se omite y no da de baja
  a nadie.
- F3: la matriz da Leads y Clientes a quien entra por acceso (`destinosDe(..., porAcceso)`). `porAcceso` solo
  viaja cuando es verdadero.
- F4: «Agentes vinculados» y `altaAgente` cuentan el acceso.
- F5: conceder o revocar `bandeja` en Usuarios sincroniza a esa persona con Chatwoot.

## Evidencia (2026-11-18, turno de PC del DG)

- Vitest acotado, `--pool=forks`: **PASÓ**, 8 de 8 archivos y 173 de 173 pruebas.
  - `matriz`, `agentes-ciclo`, `alta-agente`, `acceso-bandeja-chatwoot`, `user-module-grants-bandeja`,
    `user-module-grants.migration`, `bandeja-concedible.migration` y `crm-acceso`.
  - La primera corrida falló en 3 pruebas. Dos esperaban agentes sin `porAcceso`; se corrigió el código, no las
    pruebas. La tercera era el mutante «pierde un módulo de la 0538», que no caía porque el postflight solo
    revisaba `kommo`: se endureció el postflight.
- ESLint de los 15 archivos `.ts`/`.tsx` del diff: **PASÓ**.
- Gate `pending-migration-symbols`: **PASÓ** (0 rojo, 0 amarillo).
- `pnpm verify`: **NO EJECUTADO** (sin turno; el portón es la CI de GitHub).
- No se leyeron ni escribieron datos de producción.

## Pendiente de esta tarea

- CI de GitHub y revisión independiente de la #686.
- Respuesta de Sam a la pregunta 2 de la spec §5.
- Aplicar la 0565 en producción solo con el OK nominal de Sam para ese archivo y el runbook, a través del DG.

## FUERA DE ALCANCE DETECTADO

- Un desvío por rol que da `bandeja` a un rol sin bandejas en la matriz deja a esas personas en Chatwoot sin
  bandejas (spec §3, última fila).
- Un comercial que necesita también Clientes no se resuelve con «siempre las dos»: hace falta la elección por
  persona.
