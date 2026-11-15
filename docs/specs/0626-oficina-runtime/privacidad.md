# SDD-0626 — Revisión de datos personales: las cuatro tablas del cable (§3.1, migración 0541)

**Cuándo y con qué:** el 2026-11-15, con [`revisar-datos-ve`](../../../.claude/skills/revisar-datos-ve/SKILL.md), sobre la rama `sdd/0626-paso1-revision`.

**Por qué:** lo pidió la revisión independiente de la #572 (hallazgo 1, severidad media). `titulo`, `meta_datos`, `actor` y `resumen` son texto libre, y en `task_events` quedan para siempre.

**Alcance:** las cuatro tablas de la 0541 y lo que el Paso 2 va a escribir en ellas. No es una auditoría del cable completo, ni de Chatwoot, ni del runtime de la oficina.

**Qué no es:** no es asesoría legal y no afirma que el proyecto cumple. Cada punto queda en uno de tres estados:
- `ENCONTRADO`: un problema que se ve en el código;
- `CORRECTO`: la implementación que lo resuelve, vista en el código;
- `NO VERIFICABLE`: no se puede comprobar leyendo el repositorio.

**Marco aplicable**, citado desde la skill y su [checklist](../../../.claude/skills/revisar-datos-ve/references/checklist-datos-ve.md), puntos 1, 2, 5 y 12:
- **Venezuela:**
  - la Constitución, arts. 28 (habeas data) y 60 (vida privada);
  - la SC 332/2001: finalidad, calidad y temporalidad;
  - la SC 759/2025: derecho al olvido.
- **PIPL (China):** `NO VERIFICABLE`. No consta en el repo dónde corren el runtime de la oficina ni el proveedor del modelo glm-5.3 (ver §4).

En este archivo, `0541` quiere decir `supabase/migrations/0541_oficina_cable_tablas.sql`.

## 1 · Resumen

| Estado | Cantidad |
|---|---|
| `CORRECTO` | 6 |
| `ENCONTRADO` | 3 |
| `NO VERIFICABLE` | 5 |

## 2 · Inventario

**De quién son los datos:**
- los clientes y contactos que escriben por Chatwoot. Muchos no son usuarios del ERP (punto 12). Sus datos llegan a la oficina solo **por referencia** (`payload_ref`, `entidad_ref`);
- el personal que pausa o despausa la oficina: los administradores de plataforma.

**Quién más lo ve:** RLS está activa y no hay policies. anon y authenticated no tienen privilegios, ni de tabla ni de columna. Solo leen service_role (el despachador futuro) y el dueño de las migraciones.

| Tabla.campo | Qué es | Finalidad | Retención | Evidencia |
|---|---|---|---|---|
| `office_tasks.titulo` | Texto libre de hasta 200 caracteres | Describir el trabajo | Sin plazo: las tareas no se pierden (SGE-AG-01 §7) | `0541:117`, `:135` |
| `office_tasks.asignado_a` | Texto libre de hasta 100 caracteres. Puede ser un agente o el nombre de una persona | A quién va la tarea | Sin plazo | `0541:121`, `:137` |
| `office_tasks.entidad_ref` | Referencia sin espacios, de hasta 300 caracteres | Señalar la entidad del ERP sin copiarla (R5) | Sin plazo | `0541:124`, `:143` |
| `office_tasks.meta_datos` | Objeto jsonb de hasta 8 KB, con claves libres | **Finalidad no evidente en el código** | Sin plazo | `0541:126`, `:145` |
| `task_events.actor` | Texto libre de hasta 100 caracteres | Quién hizo el paso | **Para siempre** (solo agregar) | `0541:159`, `:167` |
| `task_events.resumen` | Texto libre de hasta 1.000 caracteres | Qué hizo el paso | **Para siempre** (solo agregar) | `0541:160`, `:169` |
| `event_inbox.clave_dedupe` | Texto sin espacios, de hasta 200 caracteres, único | Que un evento se procese una sola vez (AC-4) | Sin plazo | `0541:189`, `:203` |
| `event_inbox.payload_ref` | Referencia `origen:ruta` | Señalar el mensaje en Chatwoot, sin copiarlo | Sin plazo | `0541:210` |
| `office_paused.cambiado_por` | uuid del administrador que cambió la bandera | Dejar registrada la autorización (SGE-AG-01 §7) | Para siempre (solo agregar) | `0541:223`, `:342` |
| `office_paused.motivo` | Texto del administrador, de hasta 500 caracteres | Por qué se pausó o despausó | Para siempre (solo agregar) | `0541:225` |

No hay datos sensibles por columna: ni salud, ni biométricos, ni geolocalización. El riesgo está en los cuatro textos libres, que pueden copiar lo que dijo el cliente.

## 3 · Hallazgos

### `ENCONTRADO` 1 · La bitácora guarda texto libre para siempre (media)

`task_events.actor` y `task_events.resumen` aceptan cualquier texto (`0541:159-160`, `:167-170`), y el disparador de solo agregar no deja borrarlo nunca.
- **Riesgo:** un resumen escrito por el modelo puede llevar el nombre, el teléfono o el mensaje del cliente.
- **Lo que falta:** no hay regla en la base ni en el código que lo impida, y no hay plazo de retención.
- **Norma:** SC 332/2001, temporalidad; AUD-01 §5 («PII se minimiza y se representa por identificador»); R5 de esta spec («redacción de PII en logs»).
- **Arreglo propuesto:** la **opción A**, que espera el OK de Sam porque cambia el alcance de §3.1:
  - `actor` pasa a ser un identificador (`agente:<perfil>`, `persona:<uuid>` o `sistema:<componente>`), exigido con un CHECK;
  - `resumen` pasa por una regla de escritura del Paso 2, con prueba;
  - `resumen` se vacía a los 90 días, el plazo del replay en N1. La fila queda, con tipo, actor, costo, modelo y hora.

### `ENCONTRADO` 2 · Textos de la tarea sin regla (media)

`office_tasks.titulo`, `asignado_a` y `meta_datos` no tienen regla de minimización (`0541:117`, `:121`, `:126`). La finalidad de `meta_datos` no se puede deducir del código.
- **Arreglo propuesto, dentro de la opción A:**
  - `asignado_a` usa el mismo formato de identificador que `actor`;
  - `titulo` y `meta_datos` los escribe una sola función del Paso 2, que rechaza los datos personales. Reusa `tieneDatosPersonales` (`lib/news/autopublicar/control.ts:174`) y tiene prueba;
  - `meta_datos` solo guarda referencias e indicadores: ids, conteos y banderas.

### `ENCONTRADO` 3 · La clave de dedupe podría armarse con un dato de contacto (baja)

`clave_dedupe` solo prohíbe los espacios (`0541:203`). Si el webhook la armara con un teléfono, el teléfono quedaría guardado.
- **Arreglo:** regla del Paso 2. La clave se arma con los ids de Chatwoot (conversación y mensaje), nunca con datos de contacto (§3.2).

### `CORRECTO` 4 · El mensaje del cliente no entra a la bandeja

`payload_ref` solo acepta una referencia `origen:ruta` sin espacios (`0541:210`). El contrato rechaza el mensaje completo y el texto después del origen: casos «mensaje completo» y «mensaje tras el origen» de `supabase/tests/0541_oficina_cable_tablas.test.sql`.

### `CORRECTO` 5 · La entidad del ERP va por referencia

`entidad_ref` es una referencia sin espacios (`0541:143`). No copia el contenido.

### `CORRECTO` 6 · Nadie de la API lee estas tablas

- RLS sin policies en las cuatro tablas (`0541:356-359`).
- `revoke all` a public, anon, authenticated y service_role (`0541:361`).
- El postflight comprueba que anon y authenticated no tienen ningún privilegio de tabla ni de columna.

### `CORRECTO` 7 · El volumen está acotado

`titulo` tiene un tope de 200 caracteres, `resumen` de 1.000 y `meta_datos` de 8 KB (`0541:135`, `:169`, `:145`). Ningún texto libre puede guardar una conversación entera.

### `CORRECTO` 8 · La hora y la identidad las pone la base

service_role escribe por columna: nunca `id`, `creado_en` ni `ts` (`0541:368` y siguientes). Lo prueba el contrato 8. No es un dato personal, pero sostiene el valor de la bitácora (AUD-01 §3: hora del servidor).

### `CORRECTO` 9 · Quién pausó queda por identificador

`office_paused.cambiado_por` es el uuid de `auth.uid()`, no un nombre (`0541:223`, `:342`). Su finalidad está escrita: SGE-AG-01 §7, «Despausar exige autorización registrada».

## 4 · No verificable

- **Lo que va a escribir el Paso 2.** Todavía no existe. Las reglas de los hallazgos 1 a 3 se comprueban en su PR.
- **Los respaldos de la base.** Un plazo de retención en la tabla no llega a los dumps (`docs/runbooks/backup-restore-servidor.md`). Hay que saber cuánto se guardan.
- **El runtime de la oficina (VPS Oficina) y el proveedor de glm-5.3:**
  - qué guardan de cada conversación y por cuánto tiempo (el replay de SGE-AG-01 §8);
  - en qué país procesan, que decide si aplica la PIPL (punto 9 del checklist).
- **Chatwoot:** guarda la conversación completa. Su retención es la de Chatwoot, no la de estas tablas.
- **Producción:** que el dueño de las tablas sea `postgres` y que service_role tenga BYPASSRLS. La revisión de la #572 lo infiere y no lo mide.

No se corrió la verificación del paso 3 de la skill (crear un valor rastreable, borrarlo y buscarlo) contra una base real. El contrato corre en PGlite y en un Postgres 17 desechable.

## 5 · Fuera de alcance

- **Necesita abogado:**
  - la base de licitud para que un agente de IA atienda las conversaciones de Chatwoot;
  - el aviso al cliente de que lo atiende un agente;
  - la política pública de tratamiento.
- **Antes de la etapa 2 de AC-1 (clientes reales):** una revisión propia del envío de conversaciones al proveedor del modelo, por transferencia internacional y terceros (puntos 8 y 9).

---

Esto no es asesoría legal: es un inventario técnico con evidencia y una lista de preguntas. Conviene una segunda opinión de otro modelo; la revisión independiente de la #572 fue la primera.
