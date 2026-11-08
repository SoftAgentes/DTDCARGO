# Handoff · SDD-0586 §10.5.10 — el runbook único de las puertas de P4 y del encendido

- **Owner:** Claude Worker «10.5», en la sesión que inició el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`).
- **Claim:** `worker-10.5-runbook`.
- **Ruta y rama:** `DTD-worktrees/0586-p4-runbook-puertas`, rama `codex/0586-p4-runbook-puertas`, desde `main` en `33c286e01`, después del tren 6.
- **SDD:** [0586](../../docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md), §10.5.10.

## Lo hecho

- **[`docs/runbooks/chatwoot-portal-p4-puertas.md`](../../docs/runbooks/chatwoot-portal-p4-puertas.md):**
  - **El anexo «Encender sin el historial»** (E.1 a E.6), al final. Sam eligió, literal, «Esperar la carga», así que quedó como referencia.
  - **Las cinco puertas, en el orden del DG:**
    1. la copia de producción para el ensayo, con dos OK: Chatwoot y Studio;
    2. la bandeja;
    3. el ensayo;
    4. producción, de 4.1 a 4.10, con los sub-pasos 4.6b y 4.10a;
    5. el encendido.
  - **Cada paso lleva seis cosas:** qué lee o escribe, el comando, la condición para seguir, la evidencia, la vuelta atrás y el OK nominal.
  - **Los sub-pasos con OK propio:** 2a, 2b, 3.0, 4.6b, 4.10a y 5a.
  - **La revisión `revisar-datos-ve`.**
- **Las partes de E5,** que son `cargar.sh`, la copia y el ensayo, salen de sus textos en las notas compartidas. **E5 revisa las puertas 3 y 4.5 a 4.7 antes de publicar.**
- **El README de `infra/ops/portal-historial/`** (§Puertas), **la spec 0586** (§10.5.10, el guion de la puerta 4) y **`chatwoot-portal-encendido.md`** apuntan al runbook, en vez de repetir el guion.

## Hallazgo: encender sin el historial cambia la carga P4 de después

Va en el anexo del runbook. Sam ya eligió esperar la carga, así que hoy no aplica:
- **La puerta 4 se negaría:** al encender, la cola corre. La 4.3 exige que la cola nunca haya corrido y que el flag nunca se haya encendido.
- **El historial de esos hilos queda fuera:** los hilos que la cola vincula ya no los carga `chatwoot_portal_carga_hilos`, así que su historial anterior al corte no llega a Chatwoot.
- **Una carga posterior pide un rediseño,** y lo decide el DG.

## Lo que viene del DG y lo medido

- **Medido en el VPS por el DG:**
  - los contenedores `dtd-cargo-db-1`, `dtd-cargo-web-1`, `dtd-cargo-cron-1`, `chatwoot-rails-1` y `chatwoot-postgres-1`;
  - el comando de la web, el de `publicar-web.sh`, sin `--force-recreate`;
  - el `ExecStart` de `chatwoot-respaldo.service`;
  - `/srv/dtd-cargo/backup.sh`;
  - que `/srv/ops/portal-historial` no existe.
- **La auditoría del flag** está en `entity_audit_log` (`0289:890-910`, `0267:306`), no en `audit_d1_operations` (`0289:654`).
- **No hay RPC para fijar el corte sin la carga.** E.4 es SQL por superusuario, con su OK.

## Validación

| Comprobación | Estado |
|---|---|
| `docs:check` y `sdd:check` | PASÓ |
| Los vínculos relativos del runbook, del README y de la spec | `docs:check` PASÓ ‹y revisión a mano› |
| Pruebas de producto | No aplica: la PR es solo de docs |
| Revisión de E5 de su parte | Pendiente: antes de publicar |

## Pendientes de esta tarea

- **Lo marcado ‹por confirmar›** en el runbook:
  - las listas de columnas de la 2b;
  - los comandos de 4.6b, que salen del desarme de Studio y de la pieza de E5;
  - la prevención del log en 4.10;
  - los argumentos del respaldo externo a S3.
- **Cuando entre la 2b de E5,** actualizar la puerta 1 y la 3 con sus opciones y sus nombres reales.

## FUERA DE ALCANCE DETECTADO

- **La carga P4 después de encender sin el historial** necesita un rediseño (el hallazgo de arriba). Lo decide el DG.
