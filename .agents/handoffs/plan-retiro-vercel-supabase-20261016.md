# Plan de retiro de Vercel y Supabase Cloud (Director, 2026-10-16)

| Campo | Valor |
|---|---|
| Fecha | 2026-10-16, ~03:30 de Caracas (07:30Z) |
| Autor | Director (Claude Code), a pedido de Sam |
| Pedido de Sam (literal) | «Organiza que un worker arme una predicción automática y coordina la sesión de contado. También organiza las fechas para las tareas programadas del 28 al 30 de octubre y lo que tengamos que hacer esta semana.» Es una transcripción de voz: «predicción automática» quiere decir publicación automática y «sesión de contado» quiere decir sesión de Contabo. |
| Fuente normativa | `docs/runbooks/servidor-contabo.md` §3.5 y §4 (Fase 4), y `docs/runbooks/backup-restore-servidor.md` §2 y §3 |
| Estado | plan; cada paso con producción o pago pide el OK de Sam en su momento |

## Dónde estamos (medido el 2026-10-16 a las 07:20Z)

| Pieza | Dónde vive | Evidencia |
|---|---|---|
| Base de datos, Auth, Storage y funciones de Kommo | Servidor propio desde el 2026-10-14 | ledger en 494 filas; `functions_base_url` y `kommo_cron_key` en el Vault del servidor, sin apuntar a Cloud |
| Tareas programadas de la base (pg_cron) | Servidor: `kommo-sync-dtd`, `kommo-writeback-drain-dtd` y `tarifas-programadas-relevo` activas | lectura READ ONLY de `cron.job` |
| pg_cron de Supabase Cloud | Las tres apagadas (`active = false`) | lectura READ ONLY de `cron.job` en Cloud; el proyecto está `ACTIVE_HEALTHY` |
| Web | Servidor desde las 07:05Z del 2026-10-16. El DNS todavía se propaga | `corte-paso2-router-20261016T070502Z.txt` (14 PASÓ · 0 FALLÓ) y la comprobación externa del Director: certificado de Let's Encrypt hasta el 2027-01-14 |
| Crons de la web (`vercel.json`) | Vercel hasta su pausa. El contenedor `cron` del servidor tiene las 19 rutas de `vercel.json`, más `searates-refresh` | `infra/dtd-cargo/cron/crontab` |

**Dos hallazgos para el orden del retiro:**
1. **El proyecto de Supabase Cloud está dentro de una organización creada por la integración de Vercel** (`organization_id` empieza con `vercel_icfg_`). El pago va por Vercel. Cancelar Vercel o quitar la integración antes podría borrar el proyecto de Supabase. Por eso, antes de tocar el plan o la integración de Vercel, va primero el dump final de Cloud cifrado y fuera del servidor, y después la pausa de Cloud.
2. **Después del corte, un merge a main ya no publica solo.** GitHub construye la imagen `sha-*`, pero el servidor no la instala. Hasta que exista la publicación automática (SDD-0541), cada merge con código lo publica a mano la sesión de Contabo. Esto deja sin efecto, para la web, la regla de que un merge despliega a producción.

## Calendario

### Esta noche (viernes 16, madrugada)
| Qué | Quién | Condición |
|---|---|---|
| Esperar que Google y Cloudflare den 217.216.54.70 cuatro veces seguidas, más 5 min de TTL | Sesión de Contabo (vigilante) | — |
| Pausar el proyecto en Vercel (pausar, **no** borrar) | Sam | cuando Contabo lo pida |
| Desconectar la integración de Git de Vercel (proyecto `dtdcargo` → Settings → Git → Disconnect). Sam decidió hacerlo hoy: «vamos a desconectar Vercel de GitHub ya que no tiene sentido esperar hasta el 20». No frena los merges (el ruleset solo exige «Calidad local sin secretos») ni toca la integración que paga Supabase. Con esto un Preview deja de escribir en la base del servidor | Sam | justo después de la pausa |
| Encender el contenedor `cron` del servidor (`corte-paso2.sh cron`) y comprobar los drenajes | Sesión de Contabo | después de la pausa de Vercel, para que nada corra dos veces |
| Cierre del corte y fin de la congelación de main | Contabo confirma, el Director levanta la congelación | — |

### Esta semana
| Día | Qué | Quién |
|---|---|---|
| Viernes 16 | Publicación automática: SDD-0541, scripts y pruebas en el repo, PR en borrador | Worker (lanzado a las 07:27Z), coordinado con la sesión de Contabo |
| Viernes 16 | Entorno de prueba: SDD-0540, diseño y decisiones para Sam | Worker (en curso) |
| Viernes 16 – sábado 17 | Pendientes del tarifario: SDD-0539, con migración 0491 si hace falta | Sesión de Sam (en curso) |
| Sábado 17 | Revisar e integrar la 0541. Instalarla en el servidor y encenderla | Director integra; Contabo instala con el OK de Sam |
| Sábado 17 | Smokes de Sam pendientes: calculadora, borrar embarque, bandeja de avisos, «Zarpado», operarios de Venezuela, nombres ocultos a China, una de las siete acciones R3 y `/studio/debug` | Sam |
| Sábado 17 | Regla «Recibido en bodega China» → «Correo + push» | Sam (Admin → Notificaciones) |
| Domingo 18 – lunes 19 | Reescribir `docs/runbooks/aplicar-migraciones-prod.md` para el servidor propio (psql en `dtd-cargo-db-1` y fila del ledger en la misma transacción). Es condición de la Fase 4 | Director o Worker, con PR |
| Martes 20 | Revisión semanal de respaldos: `rclone lsl … db/daily/ | tail -7` tiene que mostrar 7 dumps diarios seguidos (el respaldo diario se encendió el 2026-10-13) | Sesión de Contabo |
| Miércoles 21 – jueves 22 | Restore de prueba mensual (`infra/ops/backup/restore-test.sh`) sobre un dump tomado en el servidor. Es condición de la Fase 4 | Sesión de Contabo |
| Esta semana | Ajustar el panel de publicaciones y el estado del Studio, que leen Vercel (`deployActions.ts`, `vercel-deploys.ts`, `env-status.ts`) | Worker, con su SDD (sale del handoff de la 0541) |

### Miércoles 28 de octubre — base de datos: 14 días desde su corte (14-oct)
Revisar las condiciones de `servidor-contabo.md` §4 y anotarlas en este handoff:
1. 14 días sin incidente abierto.
2. Restore de prueba PASÓ sobre un dump del servidor.
3. Los últimos 7 dumps comprobados en el bucket fuera de Contabo.
4. `aplicar-migraciones-prod.md` reescrito y fusionado.

Si las cuatro se cumplen, con el OK de Sam, en este orden:
1. Dump final de Cloud (`supabase db dump`), cifrado con `age` y guardado fuera del servidor.
2. **Pausar** Supabase Cloud (`xpfuzqombmjmxvprjgmi`), sin borrarlo.

### Viernes 30 de octubre — web: 14 días desde su corte (16-oct)
Con Cloud ya pausado y su dump guardado, y con el OK de Sam:
1. Quitar el dominio del proyecto en Vercel. Revocar `VERCEL_API_TOKEN`. Comprobar que la integración de Git ya esté desconectada.
2. Antes de cancelar el plan de Vercel, confirmar qué pasa con la organización de Supabase creada por la integración (hallazgo 1).
3. Docs: `setup-portal-auth.md`, `setup-resend.md`, `setup-web-push.md`, `setup-kommo-webhook.md` y `e2e-supabase-efimero.md` reciben su nota «desde <fecha> esto vive en el servidor» (Fase 4, paso 4).

### Viernes 27 de noviembre (30 días después de pausar Cloud)
- Borrar Supabase Cloud, con otro OK de Sam y el dump final ya verificado.
- Cancelar los planes de pago de Vercel y Supabase.

## ⚠️ Loop3D comparte los dos planes (medido el 2026-10-16 ~07:55Z, solo lectura en el Chrome de Sam)

- **Vercel (equipo `hailu-wey`, plan Pro, US$20/mes, ciclo del 22-sep al 22-oct):** tiene dos proyectos, `dtdcargo` (pausado) y **`loop-3d`**. Bajar el plan con «Downgrade» afectaría la web de Loop3D.
- **Supabase (organización `DTDCARGO`, `vercel_icfg_…`, plan Pro, cobrado por Vercel):** tiene dos proyectos activos, DTD Cargo (`xpfuzqombmjmxvprjgmi`) y **Loop3D** (`vkyghjioazdmknkrdufr`). La integración de Vercel lista además «ERP-BOREAL», «Loop3D Restore Drill 2026-08-06» y «DTD-CARGO», que no aparecen como proyectos activos. Quitar la integración o cancelar Vercel podría tumbar la base de Loop3D.
- **Consecuencia para el calendario:** el 28-oct y el 30-oct se pausa o se borra **solo el proyecto DTD Cargo** en Supabase y se quita el dominio del proyecto `dtdcargo` en Vercel. **No** se cancela ningún plan ni se quita ninguna integración. Cancelar los dos planes del 27-nov queda condicionado a que Loop3D también se haya mudado: web y base. Coordinar con su sesión («Prompt traslado loop3d»).
## Restos que se quedan a propósito
- El nombre de la cookie de sesión fijado al ref de Cloud (`lib/db/session-cookie.ts`), para que nadie tenga que volver a entrar.
- Las llaves públicas viejas de Cloud en `GOTRUE_JWT_KEYS` y `JWT_JWKS`, para validar las sesiones abiertas.
- La URL de Cloud en el texto de 0084 y 0136: una migración aplicada no se edita, y desde la 0472 la URL sale del Vault.
- Las variables `VERCEL_*` en `lib/runtime/app-env.ts`, como respaldo histórico (Fase 4, paso 5).

## Seguimiento del 2026-10-17 (Director)

- **Días de la semana corregidos.** El plan nombraba el 2026-10-16 como jueves; fue viernes (`date -d 2026-10-16 +%A`). Se corrigieron los nombres y se conservaron las fechas: el 20 es martes, el 28 miércoles, el 30 viernes y el 27 de noviembre viernes.
- **Hecho desde el plan:**
  - Vercel en pausa y con la integración de Git desconectada.
  - Contenedor `cron` del servidor encendido.
  - SDD-0541 integrada, con la publicación automática encendida a las 14:29Z del 16. La #249 y la #260 se publicaron solas: lo medí en el journal del servidor (14/0 en la prueba rápida). Las demás no las comprobé una por una.
  - Entorno de prueba arriba (SDD-0540 §10).
  - Pendientes del tarifario (0491) aplicados.
- **Sigue pendiente, con las fechas del calendario:**
  - reescribir `docs/runbooks/aplicar-migraciones-prod.md` para el servidor propio (condición de la Fase 4);
  - revisión semanal de respaldos el martes 20;
  - restore de prueba del 21 al 22;
  - ajustar el panel de publicaciones del Studio, que lee Vercel (`lib/studio/vercel-deploys.ts`, `app/studio/(app)/debug/`);
  - los pasos con pago o producción del 28, del 30 y del 27 de noviembre, cada uno con el OK de Sam en su momento.
- **Agregado:** Sam pidió esperar al lunes 19 para los contenedores 60 al 64 en prueba (SDD-0543, PR #262), porque no le llegaron los archivos. Hay un recordatorio local agendado para ese día a las 9:00 de Caracas.
