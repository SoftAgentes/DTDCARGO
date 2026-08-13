# Handoff · CRM (Kommo) — lo que quedó vivo y lo que falta

> **Para retomar en UNA ventana nueva, con un solo objetivo hasta el final.**
> Todo lo de abajo está **medido contra producción el 2026-08-11**, no inferido.
> Verifica antes de cambiar, pero no vuelvas a descubrirlo desde cero.

## Lo que YA está en producción (no rehacer)

| | Estado |
|---|---|
| Módulo renombrado a **CRM**, ruta `/studio/crm`, 308 desde `/studio/kommo` y `/studio/leads` | ✅ |
| `CRM · Leads` (placeholder vacío) eliminado, con su entrada de RBAC | ✅ |
| Tablero deja de calcular sobre 1.000 de 3.152 leads (`fetchAllRows` pagina) | ✅ |
| Reportes › desempeño por asesor — mismo bug, mismo arreglo | ✅ |
| Poda de embudos fantasma en el sync: **12 → 1 embudo, 75 → 7 etapas**, 0 huérfanos | ✅ |
| 6 tokens `--cat-N-bg` (BRAND-CHECK autorizado) | ✅ |
| migr **0362** `kommo_lead_contacts` + RPC con guarda de orden | ✅ aplicada |
| migr **0363** `kommo_contacts.email/phone/phone_last10` + backfill | ✅ aplicada |
| Edge functions `kommo-sync` **v10** y `kommo-webhook` **v7** | ✅ desplegadas |
| **1.666 leads con teléfono a la vista** (eran 0) · 3.141 de 3.152 con vínculo | ✅ |

Vista previa del diseño aprobado (tokens reales, claro/oscuro):
<https://claude.ai/code/artifact/9755a035-4b6d-4c72-bc67-c435ee802b95>

## ⭐ El objetivo de la próxima ventana

**Fase 4 — que el asesor pueda MOVER el embudo desde el ERP.** Es lo que convierte
la pantalla de "tablero que se mira" en "herramienta que se usa", y es la razón por
la que el founder quiere que el equipo abandone Kommo.

Antes de eso, un pendiente chico que ya tiene el dato listo:

### 0. La columna **Contacto** en la pantalla (medio día)
La tubería está completa y con 1.666 teléfonos, pero **la UI todavía no los muestra**.
- `getLeadContactInfo` (`lib/studio/kommo-queries.ts`) ya devuelve
  `leadId → {contactId, name, phone, email}`. Falta llamarla desde
  `app/studio/(app)/crm/page.tsx` y pintar la columna en `LeadsTable`
  (`_components/KommoClient.tsx`) y en la tarjeta de `KommoBoardView.tsx`.
- El diseño exacto está en el artifact de arriba: nombre arriba, teléfono debajo en
  mono con link `wa.me`, "sin teléfono" en `--ink-mute` itálica.
- ⚠️ `url-filter-state-contract.test.ts` exige literales dentro de `KommoClient.tsx`
  (`useEffectEvent`, `filtersKey !== paramsKey`, `{ ...convertedLeads, ...prev }`).
  Si extraes la tabla a otro archivo, ese test se pone rojo — entra en la allowlist.

### 1. Fase 4 · los verbos PATCH
Mover de etapa · reasignar asesor · etiquetar. **La outbox ya existe y está LIVE**
(`writeback_enabled=true`, `dry_run=false`, cron `*/15` verificado). Sólo hay que
ampliar el `CHECK` de `op`. Pero tres cosas no son opcionales:

- **Claim con `FOR UPDATE SKIP LOCKED`** + estado `processing`. Hoy el drain
  selecciona sin reservar; con un solo cron nunca se solapa, pero en cuanto exista
  el *nudge* dos drains toman las mismas filas. Con PATCH es inocuo; con `add_note`
  **crea notas duplicadas**.
- **El nudge**: `after(() => admin.functions.invoke("kommo-writeback"))`, patrón de
  `app/registro/actions.ts:437`. Sin él la latencia medida es **14 min 38 s** y el
  asesor deja de usar la pantalla.
- **Chip "en camino"**: por el guardrail 0107 el ERP nunca escribe el espejo, así que
  entre el clic y el webhook de vuelta la pantalla muestra lo viejo. Si no se dice,
  el operador cree que no pasó nada y vuelve a clickear.
  ⚠️ **No hay Realtime en el módulo** (cero `postgres_changes`): o se suscribe a
  `kommo_writeback_outbox`, o el chip queda hasta que recargue. Decirlo, no prometerlo.

⭐ La API tiene **`tags_to_add` / `tags_to_delete` incrementales** — SDD-0244 creía
que había que reemplazar `_embedded.tags`, lo cual borraría las etiquetas del asesor.

### 2. 🔴 El bug latente de la cola — arreglar ANTES de que muerda
`enqueue_kommo_writeback` usa la clave `<leadId>:<op>` y al re-encolar hace
`payload = excluded.payload` — **reemplaza, no fusiona** (`0136:89-92`). Encolar el
Shipping Mark y **después** el nombre, antes de que drene, hace que el segundo pise
al primero y **el Shipping Mark nunca se escriba**: la fila sale `sent`, sin error.

⭐ **La regla del founder que lo resuelve: el ERP da la orden, así que el payload es
el ESTADO DESEADO COMPLETO, no un delta.** Hoy no se manifiesta porque `patch_lead`
sólo lleva el Shipping Mark; explota apenas se agregue el nombre.

### 3. Fase 5 · notas, tareas y el contexto del ERP en Kommo
- `POST /{leads}/notes` y `POST /tasks` → **la outbox sólo hace PATCH**; hay que
  enseñarle el método (derivarlo de la `op`, sin columna `http_method`).
- **Idempotencia distinta para POST**: `<leadId>:<op>` colapsaría dos notas distintas
  en una. Clave `<leadId>:<op>:<token>`, token generado en el drawer al abrirse.
- ⭐ **Lo que más quiere el founder**: empujar **saldo pendiente** y **carga en
  tránsito** al **CONTACTO** de Kommo (no al lead: el lead se cierra y se lo lleva),
  para que al escribir el cliente el asesor —y el agente de IA— sepan con quién hablan.
  **Decisión tomada**: el agente ve *sí/no*, no el monto exacto. El monto es del asesor.

### 4. Fase V · el rediseño visual
Los tokens ya están. Falta aplicarlos. El veredicto: **densidad como base** (fila de
40 px, 19 leads visibles a 1080p), carril de color en la **antigüedad** (lo accionable)
y no en la etapa, chip de etapa con **el nombre siempre escrito**.
⛔ **El categórico es punto y barra, NUNCA letra**: como texto da 4,36:1 en oscuro y no
llega a AA. Medido sobre los hex reales, está en el comentario del token.

### 5. Fase 0 · ¿se puede conversar desde el ERP?
Sin medir. Enviar exige el scope OAuth *"Sending to external chats"* y DTD usa **token
de larga duración, no OAuth** → probable 403. Hace falta una función de diagnóstico
**sólo-GET** que devuelva códigos de estado. Si da 403, se cierra por escrito y se va
con el deep link `wa.me`, que ya funciona.

## Deuda que encontré y no cerré

- ~~**20 e2e en rojo** (`mobile-safari`). Preexistente.~~ **FALSO, y la corrección importa
  más que el dato:** los causé yo en ese worktree al correr
  `deno check --node-modules-dir=auto`. Con `auto`, Deno ve el `package.json` de la raíz,
  se cree dueño del árbol y **rehace `node_modules` desde los RANGOS**, no desde el
  lockfile: quedó Playwright 1.62.1 donde el lockfile pinea 1.60.0, y ése pedía un WebKit
  que no estaba instalado. No es deuda del repo — **no salgas a cazar ese fantasma**.
  Cura: `pnpm install`. ⭐ Usar siempre `--node-modules-dir=none` (además es 6× más rápido).
- **`docs/marketing/checklist-kommo.md` desactualizado** — sigue diciendo que el cron
  del drenaje es "el bloqueo real", y se cerró el 11-ago.
- **Rama `docs/kommo-instagram-diagnostico` sin mergear** — tiene toda la foto del CRM
  del 10-11 de agosto sin respaldo en `main`.
- **~30 archivos con `.limit(5000)`** en el resto del ERP, mismo patrón que hacía mentir
  al tablero. Sólo se arreglaron los tres del CRM. Merece spec propia.
- ⏰ **Créditos de IA de Kommo se agotan ~18-ago** (renueva el 29). Si el agente se
  apaga, dejan de entrar leads.

## Trampas que ya costaron tiempo hoy

1. 🔴 **`| tail` devuelve SU exit code, no el del comando.** Un typecheck salió "verde"
   estando rojo y **rompió `main`**. Correr los gates redirigiendo a archivo y leer `$?`.
2. 🔴 **Un reemplazo global de `/studio/kommo` pisa los imports** `@/lib/studio/kommo-*`.
3. 🔴 **`pg_catalog.coalesce(...)` no existe** — `coalesce` es sintaxis, no función.
   Costó un intento fallido de aplicar la 0363.
4. ⭐ **La bandera del CLI es `--workdir`, NO `--cwd`**; con `--cwd` **no sube nada** y
   parece que funcionó. Agregar `--use-api` (no necesita Docker).
5. 🔴 **Un fallo en CUALQUIER entidad del sync pone la conexión en `error`**, y con eso
   se caen también el drenaje del write-back y el push de altas. Por eso la poda usa
   `loggedJanitorial`. Cualquier trabajo de limpieza nuevo debe hacer lo mismo.
6. ⭐ **Una guarda que se puede truncar no es una guarda**: para "¿existe al menos uno?"
   usar `.limit(1)`, inmune a `db-max-rows`.

## Verificación de que sigue sano

```sql
-- Embudos podados y vínculos vivos
select (select count(*) from kommo_pipelines)                  as embudos_debe_ser_1,
       (select count(*) from kommo_statuses)                   as etapas_debe_ser_7,
       (select count(*) from kommo_lead_contacts)              as vinculos,
       (select count(*) from kommo_contacts where phone is not null) as con_telefono,
       (select status from kommo_connections)                  as conn_debe_ser_active;
```

```bash
node scripts/verify.mjs        # gate completo
pnpm edge:check                # deno check de las 4 edge functions
```

## Siguiente responsable

Ventana nueva, worktree propio bajo `DTD-worktrees/`. **No trabajar en el checkout de
`main`** — es la ventana de integración y suele estar atrasada.
