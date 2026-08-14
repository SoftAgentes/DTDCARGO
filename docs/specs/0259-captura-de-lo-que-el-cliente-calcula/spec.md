---
sdd: 0259
title: Registrar lo que el cliente calcula en la calculadora pública
status: in-progress
author: Claude (ventana 2026-08-13)
created: 2026-08-13
updated: 2026-08-13
supersedes: null
superseded_by: null
related: [0061, 0153, 0155, 0257]
confidencialidad: interna
---

# SDD-0259 · Registrar lo que el cliente calcula en la calculadora pública

## Problema

El sitio público tiene un lugar donde desconocidos declaran, gratis y sin que
nadie se los pida, **cuánto volumen y cuánto peso** traen de China: la
calculadora de `/tarifas`. **No se guarda nada de eso.**

Medido el 2026-08-13:

| Eslabón | Estado |
|---|---|
| `/tarifas` (única calculadora LCL viva, 2 pestañas) | usa `directWhatsApp` → **no hace POST**, va directo a `wa.me` |
| `EstimadoModal` (el que sí postea) | sólo se monta cuando **NO** es `directWhatsApp` → **inalcanzable** |
| `EstimacionForm` | **ningún `page.tsx` lo importa** — componente huérfano |
| `POST /api/public/estimacion` | vivo, escribe en `public.quotes`… pero **nadie lo llama** |

Resultado en la DB: `quotes` tiene **12 filas** con CBM y peso, en 7 días.

### Lo que eso cuesta

No es un problema de la calculadora: es que **la empresa no puede calibrar nada
con datos propios.** El barrido completo de producción (SDD-0257, sección
"Presets: por qué no") encontró **~41 datos reales** de CBM+peso repartidos en 5
tablas cuyas medianas van de 6 a 260 kg/m³ — 45× de diferencia.

Con eso ya se cayó una funcionalidad concreta: los **presets de peso por rubro**
de SDD-0257 se descartaron porque cualquier densidad habría sido inventada. Y
todo lo que venga después choca con la misma pared: validaciones de "esto pesa
raro", tarifas por densidad, estudios de mix de carga.

Es la cara pública de lo que SDD-0153/0155 ya decía de la operación interna: los
módulos de captura existen y no se usan. Acá ni siquiera hay que convencer a
nadie de tipear — el cliente ya lo escribió.

## Decisión

Registrar un **evento anónimo de cálculo**. No es un lead, no es un estimado, no
crea `EST-`, no toca `quotes`.

### Las tres reglas que definen el alcance

1. **Cero datos personales.** Se guardan sólo: `cbm`, `weight_kg` (nullable),
   `modo` (ddp/consolidado), `ciudad_id`, banderas de embalaje/baterías, el
   total calculado y la fecha. **Nada de** nombre, teléfono, correo, IP,
   cookie, ni identificador de sesión o de usuario.

   Esto no es un detalle de implementación: es lo que mantiene el evento
   **fuera del régimen de datos personales** (CRBV arts. 28 y 60, Ley Especial
   contra los Delitos Informáticos; PIPL si algún día lo mira el equipo de
   Yiwu). ⚠️ **El día que alguien le cuelgue un identificador, deja de ser
   anónimo** y el cambio pasa obligatoriamente por `/revisar-datos-ve`.

2. **Cero fricción.** Sin modal, sin campo extra, sin un clic más. Lo que hoy
   convierte no se toca.

3. **Tabla propia, no `quotes`.** `quotes` es una entidad de negocio con código
   `EST-` y dueño; esto es telemetría. Mezclarlas ensucia el CRM con filas que
   no son de nadie.

### Cuándo se dispara

**Al tocar el CTA de WhatsApp**, no mientras se tipea. Un evento por
keystroke-con-debounce guarda estados a medias (`cbm=1`, `cbm=12`) y hay que
limpiarlos después; el clic es el momento en que el cliente ya se decidió, y da
el valor final y comprometido. Menos volumen y más señal.

### Lo que se aprende, que son dos cosas

1. **La distribución de densidad de lo que la gente trae** → es lo que
   desbloquea los presets de SDD-0257.
2. **Cada cuánto el cliente NO sabe el peso** → mide si SDD-0257 valió la pena.
   Hoy eso no se puede responder: el `weight_kg` nullable ES la métrica.

## Alcance

- `supabase/migrations/0368_public_calc_events.sql` — la tabla y su cerradura.
- `lib/public/calc-event.ts` — lista blanca + validación (puro).
- `lib/public/calc-event-report.ts` — el disparo desde el navegador.
- `app/api/public/calc-event/route.ts` — throttle + insert.
- `components/CalculadoraForm.tsx` — la llamada, en el CTA.

### ⚠️ Lo que cambió del plan al construirlo

**No hay RPC para `anon`.** La spec proponía una RPC acotada; sobra, y quitarla
es más seguro. El sitio público **no puede importar `@supabase/*`** (frontera
dura forzada por ESLint), así que el navegador nunca podría llamarla: la
escritura la hace el endpoint **server-side con `service_role`**, igual que
`/api/public/estimacion`. Resultado: `anon` no recibe **ningún** permiso nuevo.

La cerradura es **RLS activa con CERO políticas** — eso niega todo, y los
`revoke` van explícitos por si mañana alguien agrega una política sin pensar.
El contrato de 0368 lo verifica con `set role anon` e intentando leer y escribir
de verdad, no mirando el catálogo de GRANTs.

**Sobre la IP:** el throttle reusa `portal_registro_throttle` con namespace
propio (`calc:`), el mismo mecanismo de `/api/public/estimacion`. La IP queda en
ese bucket compartido —que ya existía— y **nunca** en la tabla de eventos. La
frase de arriba "no se persiste" era imprecisa: se persiste en el bucket
anti-abuso, como en el resto de los endpoints públicos; lo que no ocurre es que
toque la telemetría.

**Disparo:** `fetch` con `keepalive: true`, sin `await`, dentro de try/catch. El
`keepalive` no es adorno: sin él el navegador cancela la request al navegar a
wa.me y se pierde justo el evento del que **sí** convirtió.

**Tenant memorizado** en el módulo: es constante en la práctica y ahorraba un
viaje a la base por evento (medido: la ruta pasó de ~3,7 s a ~1,2 s desde local
contra la Supabase de producción; en Vercel, misma región, es mucho menos).

### Lo que NO entra

- **Revivir `EstimadoModal` en `/tarifas`.** Fue decisión explícita que la
  calculadora no capture datos ahí (Fase 3): mete fricción justo donde el
  cliente está por escribir. Este evento existe **precisamente para** medir sin
  pedirle nada.
- **GA4.** Podría contar los eventos, pero el dato quedaría en Google y hay que
  poder cruzarlo con SQL para calibrar precio. Además el sitio público tiene
  regla de mantener GA lejos de datos sensibles.
- **Limpiar `EstimacionForm` huérfano ni el `/api/public/estimacion` sin
  llamadores.** Son hallazgos de esta medición, pero son poda: van aparte para
  no mezclar borrado con feature nueva.

## Verificación

Todo corrido, y **las dos guardias validadas con mutación** — un contrato que no
se pone rojo al romper lo que vigila es decoración:

| Qué | Resultado |
|---|---|
| `supabase/tests/0368_public_calc_events.test.sql` · 9 casos | ✅ dentro de los 96 contratos |
| ↳ mutación: abrirle `grant`+política a `anon` | ✅ **rojo** — "tiene 1 política(s)" |
| ↳ mutación: agregar una columna `ip` | ✅ **rojo** — "columna(s) que pueden ser dato personal: ip" |
| `lib/public/__tests__/calc-event.test.ts` · 10 casos | ✅ |
| ↳ mutación: copiar el payload entero (`...payload`) | ✅ **rojo** — 14 claves donde debían ser 9 |
| `e2e/calc-event.spec.ts` · 2 casos | ✅ incluye el caso sin peso → `weightKg: null` |
| `pnpm typecheck` · `pnpm lint` (frontera pública↔ERP) | ✅ |
| Suite completa | ✅ 5.186 tests en 443 archivos |
| `schema-rebuild` | ✅ 349 migraciones desde cero + aislamiento multi-tenant |
| En vivo: `POST /api/public/calc-event` | ✅ 204 y cuerpo vacío **aun sin la tabla** — el camino silencioso funciona |

⏳ **`migrations-applied` en rojo a propósito:** el gate marca `0368` como no
aplicada a producción, que es correcto y es la puerta del runbook — aplicar
exige OK del founder nombrando la migración, de a una.

## Cómo se cierra el ciclo

A las pocas semanas, volver a correr el barrido de densidad de SDD-0257 sobre la
tabla nueva. Si la distribución es coherente —y no 45× de dispersión entre
fuentes— se reabre la sección "Presets: por qué no" de SDD-0257 y se calibran
con datos propios. **Mientras tanto, los presets siguen descartados.**
