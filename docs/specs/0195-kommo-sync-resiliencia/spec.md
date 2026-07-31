---
sdd: "0195"
title: "Resiliencia del sync de Kommo — un hipo de red no apaga la integración"
status: proposed
author: "Sam (founder) + Claude"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0043", "0191"]
confidencialidad: interno
---

# SDD-0195 — Resiliencia del sync de Kommo

## 1. Qué pasó

El **18 de julio de 2026 a las 07:00 UTC** el sync corrió y **cinco de seis
entidades funcionaron**: usuarios (5), leads (2 874), campos (25), estados (56) y
pipelines (9). Sólo falló `contacts`, con un error de red transitorio bajando la
página 12 desde Kommo:

```
error sending request … /api/v4/contacts?limit=250&page=12
http2 error: connection error received: not a result of an error
```

**El sync quedó muerto desde ese día**, y nadie se enteró durante 13 días. El
último `sync_logs` es del 18-jul; el último `last_sync_at`, también.

Se descubrió de rebote, levantando el mapa de borrado de
[SDD-0191](../0191-integridad-documental-derechos-titular/spec.md) Slice B, al
notar que el espejo estaba desactualizado.

## 2. Causa raíz — tres defectos que se potencian

### 2.1 · `status` mezcla configuración con resultado

`kommo_connections.status` responde a la vez dos preguntas distintas: *¿está
habilitada esta conexión?* (configuración, la decide una persona) y *¿funcionó la
última corrida?* (resultado, lo decide la red). La edge function escribe:

```ts
status: ok ? "active" : "error"   // supabase/functions/kommo-sync/index.ts:83
```

Un hipo de red apaga la configuración.

### 2.2 · La guarda se auto-traba — el defecto que convierte el incidente en outage

```ts
if (conn.status !== "active") {
  return json({ error: `Conexión en estado "${conn.status}"` }, 409);
}                                  // index.ts:63
```

Lo único que repone `active` es una corrida exitosa… que esta misma guarda
impide. **Deadlock.** Verificado que ninguna parte de la aplicación repone ese
estado: el único escritor es la función bloqueada. Sin intervención manual en la
base, no vuelve nunca.

### 2.3 · El cron no puede ver el fracaso

`public.kommo_run_sync()` (migración `0084`) invoca la edge function con
`net.http_post()`, que es **fire-and-forget**: devuelve el id de la petición
apenas la encola, sin esperar respuesta.

Resultado: `cron.job_run_details` registró **`succeeded` todos los días** del 19
al 30 de julio. **Doce corridas verdes seguidas sobre una integración muerta.**

> Ese tercer defecto es el que transforma un bug en un problema. Los otros dos se
> habrían notado el día 2 si algo hubiera mirado el resultado real.

## 3. Ya hecho — desbloqueo manual

El 2026-07-31, con OK del founder, se corrió en prod:

```sql
update public.kommo_connections
   set status = 'active', last_error = null, updated_at = now()
 where status = 'error';
```

1 fila. **`last_sync_at` se dejó intacto en el 18-jul a propósito**: no se
falsifica una sincronización que no ocurrió. La próxima corrida del cron
recupera el atraso.

Es un parche: vuelve a pasar en el próximo hipo de red. Esta spec es el arreglo.

## 4. Slices

### Slice A · Separar configuración de resultado (⭐ primero)

Dos campos en vez de uno:

| Campo | Qué responde | Quién lo escribe |
|---|---|---|
| `enabled boolean` | ¿La integración está habilitada? | Una persona |
| `last_run_status` | ¿Cómo salió la última corrida? | La edge function |

La guarda pasa a mirar **`enabled`**. Un fallo de red deja de apagar nada.

Migración aditiva: `enabled` arranca en `true` donde `status <> 'disabled'`, y
`status` queda por compatibilidad hasta que no lo lea nadie.

### Slice B · Un fallo parcial no es un apagón

El 18-jul salieron bien 5 de 6 entidades. Eso es un **207**, no un incendio. La
función ya devuelve 207 en ese caso (`index.ts:94`) pero igual marca la conexión
como rota.

Regla: `last_run_status = 'error'` sólo si **todas** las entidades fallan o si
falla la autenticación. Un fallo parcial es `'partial'`, se registra en
`sync_logs` —que ya lo hace bien, por entidad— y la corrida siguiente reintenta
lo que faltó.

### Slice C · Que el fracaso sea visible

Con `pg_net`, `net.http_post()` guarda la respuesta en `net._http_response`. Dos
opciones, a elegir al implementar:

1. **La función consulta la respuesta**: guarda el `request_id`, y una segunda
   corrida de cron (o un `perform pg_sleep`) lee el status HTTP y lo registra.
2. ⭐ **La edge function escribe su propio resultado**, que ya hace, y se agrega
   un **chequeo de frescura**: si `last_sync_at` tiene más de 48 h, se avisa por
   el canal de Telegram que ya existe (`lib/studio/telegram/send-message.ts`).

La segunda es más simple y ataca el problema real: **lo que faltaba no era un log,
era que alguien mirara.** Un cron verde sobre una integración muerta es peor que
un cron rojo.

### Slice D · Que se note en el tablero

El dashboard muestra KPIs comerciales que salen de este espejo. Estuvieron **13
días congelados sin ninguna indicación**. Agregar la marca de última
actualización junto a esos números, y que se destaque si tiene más de 48 h.

Fuera del alcance de la resiliencia, pero es el lugar donde esto se habría visto.

## 5. Allowlist

- `docs/specs/0195-kommo-sync-resiliencia/spec.md`
- `supabase/migrations/0301_kommo_connection_enabled.sql` *(número a confirmar contra todas las ramas al crear)*
- `supabase/tests/0301_kommo_connection_enabled.test.sql`
- `supabase/functions/kommo-sync/index.ts`
- `lib/studio/kommo-queries.ts`
- `app/studio/(app)/kommo/**`

No incluye: datos de negocio, Kommo (sigue read-only, nunca se escribe allá) ni
la reconciliación de borrados —eso es SDD-0191 Slice B y va por su rama—.

## 6. Aceptación

- [ ] Un fallo de una sola entidad **no** deja la conexión inutilizable: la
      corrida siguiente arranca igual.
- [ ] Test contractual con **mutación**: si la guarda vuelve a mirar el resultado
      en vez de la configuración, el test cae.
- [ ] Deshabilitar a mano (`enabled = false`) **sí** detiene el sync.
- [ ] Con `last_sync_at` a más de 48 h, sale el aviso.
- [ ] `node scripts/verify.mjs` en verde.

## 7. Lo que esta spec NO toca

- **No escribe en Kommo.** El espejo sigue siendo read-only (SDD-0043 Alcance A).
- **No arregla que el sync nunca borre.** Que un contacto eliminado en Kommo
  sobreviva acá para siempre es un hallazgo de privacidad, está documentado en
  [`docs/legal/privacidad/mapa-de-borrado.md`](../../legal/privacidad/mapa-de-borrado.md)
  §D y se resuelve en SDD-0191. Son dos problemas distintos en el mismo archivo:
  éste es que el sync **se cae**; aquél es que el sync **no borra**.
