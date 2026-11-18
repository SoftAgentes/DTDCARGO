# Handoff · SDD-0637 Faro · fase 2 (migración del registro)

- **Fecha:** 2026-11-16
- **Sesión:** Lumi (Worker). Director: Director General.
- **Rama:** `claude/0637-faro-fase2-migracion`, desde `origin/main` 2e35e607f.
- **Spec:** `docs/specs/0637-faro-asistente-ayuda/spec.md` (§6.4, §9, §11) y `privacidad.md` (§2, E-1, E-3).
- **Autorización:** Sam, 2026-11-16: «Avancemos con la fase 2 de Faro». **No autoriza aplicar.** La 0550 se
  aplica solo con OK nominal de Sam para este archivo y el runbook de producción, con el DG.

## Qué se hizo

| Archivo | Contenido |
|---|---|
| `supabase/migrations/0550_faro_registro.sql` | Siete tablas, trigger de solo inserción, privilegios, seis funciones y el valor `asistente_alerta` del enum `bug_notif_type`. Cabecera «NO APLICADA» |
| `supabase/tests/0550_faro_registro.test.sql` | Contrato: arma lo mínimo de la tenencia, aplica la 0550 dos veces y prueba las secciones A a I |
| `lib/studio/asistente/__tests__/faro-0550.migration.test.ts` | Corre el contrato en PGlite, el control rojo, los mutantes y el ensayo del desarme |
| `supabase/desarmes/0550_desarme.sql` | Desarme sin número: quita funciones y tablas; el valor del enum queda |
| `supabase/migrations-baseline.json` | Espera `0550_faro_registro` en `pendingBelowCutoff` |

### Las tablas

| Tabla | Para qué | Plazo (D-6) |
|---|---|---|
| `asistente_conversaciones` | Una por conversación: tenant, persona, fecha | 180 días |
| `asistente_mensajes` | Pregunta depurada y respuesta, resultado, pantalla, versiones del contenido | Con su conversación |
| `asistente_eventos` | Feedback, rectificación, fallo, alerta y alerta revisada. Códigos cortos, sin texto libre | 180 días; alertas 2 años |
| `asistente_lecturas` | Cada vez que el administrador abre una conversación | 2 años |
| `asistente_llamadas` | Un intento a la IA: motor, modelo, estado, tokens, costo, milisegundos. Sin texto ni persona | 13 meses |
| `asistente_cuotas` | Preguntas por persona y ventana de una hora | 7 días |
| `asistente_purgas` | Constancia de cada purga, con conteos | Se conserva |

### Reglas que la base hace cumplir

- **Solo inserción.** El trigger `asistente_solo_insercion` rechaza `UPDATE` siempre, y `DELETE`/`TRUNCATE`
  salvo dentro de una purga, que enciende la bandera de transacción `asistente.purga`.
- **Purga de filas completas** (`privacidad.md` E-1), no un vaciado del identificador como la 0546.
- **RLS encendida sin policies.** `anon` y `authenticated` no tocan las tablas. `service_role` tiene solo
  `SELECT` e `INSERT` (en lecturas, purgas y cuotas, solo `SELECT`). Nadie tiene `DELETE` ni `UPDATE`.
- **Funciones** (todas `security definer`, `search_path ''`):
  - `asistente_reservar_pregunta(tenant, usuario, tope)`: reserva atómica; devuelve falso al pasar el tope.
    El tope lo pasa el servidor (D-5 como parámetro). Solo `service_role`.
  - `asistente_gasto_del_mes(tenant)`: suma `costo_usd` del mes UTC en curso (D-8). Solo `service_role`.
  - `asistente_purgar_vencidos()` y `asistente_purgar_usuario(tenant, usuario, actor, motivo_codigo)`: solo
    `service_role`. La segunda atiende un pedido de supresión: exige que el actor sea admin activo del tenant y
    un motivo de la lista cerrada (`pedido_titular`, `baja_personal`, `orden_legal`, `registro_erroneo`). Borra
    en ese tenant sus conversaciones, sus eventos no-alerta (de esas conversaciones o a su nombre) y sus cuotas;
    las alertas quedan. La constancia no guarda quién ni texto.
  - `asistente_listar_conversaciones(limite, antes)`: solo el administrador del tenant (D-4). Sin texto.
  - `asistente_leer_conversacion(id)`: solo el administrador del tenant. Deja una fila en `asistente_lecturas`.
- Las FK hacia `tenants` no tienen `on delete cascade` a propósito: una cascada chocaría con el trigger. Borrar
  un tenant con registro de Faro exige purgar antes.

## Decisiones tomadas en esta fase

- **D-4 y D-5, aprobadas por Sam el 2026-11-16** en el chat del DG. A la pregunta «¿Apruebas las dos
  recomendaciones? D-4: solo el administrador lee las preguntas del equipo, con cada lectura registrada. D-5: 30
  preguntas por hora por persona, configurable» respondió «Sí, D-4 y D-5». La 0550 implementa D-4; D-5 queda como
  parámetro que pasa el servidor (fase 3), sin número fijo en la base.
- **Número 0550:** la 0549 está en `origin/sdd/0626-paso3b-revision-envio`. Medido sobre todas las refs remotas.

## Evidencia

| Comprobación | Resultado |
|---|---|
| `node scripts/migrations-lock.mjs verificar` | PASÓ: 1 espera sin sellar (0550), 0 nuevas sin sellar |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO, 0 AMARILLO (ningún código usa los símbolos) |
| `node scripts/check-migrations-applied.mjs` | NO DISPONIBLE: worktree sin credenciales (SKIP) |
| Vitest `faro-0550.migration.test.ts` (turno del DG) | PASÓ: 24/24 sobre 4eb4becf9 (contrato, control rojo, mutantes, desarme) |
| Contrato `.test.sql` con Docker (`scripts/run-sql-tests.mjs`) | NO EJECUTADO local; lo corre el CI |
| `pnpm verify` | NO EJECUTADO: se corre al cierre de Faro (fase 6), con turno |

## Corrida

La primera corrida dio 14 rojos. Ninguno venía de la migración:

- el caso «mensaje de T2 en una conversación de T1» repetía `orden 1`, y la unicidad saltaba antes que la FK;
- el ensayo del desarme cortaba el contrato después de inlinearlo y arrastraba los inserts;
- el mutante «el trigger deja editar» pasaba. Era un hueco real del contrato: la bandera de la purga seguía
  frenando el UPDATE, pero solo fuera de la purga. Se agregó el caso «UPDATE con la bandera encendida».

## Pendientes de esta tarea

- Aplicar la 0550: solo con OK nominal de Sam y el runbook; al aplicarla, retirar la espera con
  `infra/ops/migraciones/retirar-espera.mjs`.
- Fase 3 (servidor): usar estas funciones y declarar los símbolos en
  `supabase/pending-migration-symbol-declarations.json` si la 0550 sigue sin aplicar.

## FUERA DE ALCANCE DETECTADO

- Ninguno nuevo en esta fase.
