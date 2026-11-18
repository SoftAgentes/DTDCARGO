# Handoff · SDD-0675 — Bandeja como acceso adicional por persona

Fecha: 2026-11-18 · Rama `claude/sdd-0675-bandeja-por-persona` · Reserva `refs/dtd/reservations/0675` ·
Migración asignada: 0565.

## Hecho (etapa 1: spec y diseño)

- Decisión de Sam registrada literal (spec §0): «Leads y Clientes», opción D de la SDD-0671, 2026-11-18.
- Diseño en la spec §1-§3, con archivo:línea. La base ya suma los accesos por persona en `user_has_module`,
  así que la RLS de la Bandeja no cambia. Lo que falta:
  - F0: la 0565 suma `bandeja` a `studio_module_is_grantable`, que hoy solo acepta 8 módulos (0538:196-212);
  - F1: `COVERED`;
  - F2: el ciclo de agentes con los accesos;
  - F3: la matriz le da Leads y Clientes a quien tiene el acceso;
  - F4: «Agentes vinculados»;
  - F5: sincronizar Chatwoot al conceder o revocar.

## Evidencia

- Solo lectura de código y migraciones; no se leyeron datos de producción.
- 0538 sellada en `supabase/migrations.lock.json`; `pendingBelowCutoff` vacío; 0565 libre en main.
- Sin código ni pruebas en esta etapa.

## Pendiente de esta tarea

- Que Sam conteste spec §5: (1) si el acceso da siempre Leads y Clientes (recomendado) o se elige por persona;
  (2) si se permite «ver y editar» (recomendado: sí).
- Etapa de código con turno de PC del DG; la 0565 se aplica en producción solo con el OK nominal de Sam.

## FUERA DE ALCANCE DETECTADO

- Un desvío por rol que da `bandeja` a un rol sin bandejas en la matriz deja a esas personas en Chatwoot sin
  bandejas (spec §3, última fila).
- Un comercial que necesita también Clientes no se resuelve con «siempre las dos»: hace falta la elección por
  persona.
