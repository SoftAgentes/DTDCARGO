---
sdd: 0253
title: Enlace de acceso al portal corto y con marca propia
status: in-progress
author: Claude (ventana 2026-08-09)
created: 2026-08-09
updated: 2026-08-09
supersedes: null
superseded_by: null
related: [0042, 0248, 0249]
confidencialidad: interna
---

# SDD-0253 · Enlace de acceso al portal corto y con marca propia

## Problema

Hoy, cuando un asesor comparte el acceso al portal por WhatsApp (tarjeta del
cliente → **Compartir por WhatsApp**, o Administración → invitación WA), el
mensaje lleva **el magic-link crudo de Supabase**:

```
https://xpfuzqombmjmxvprjgmi.supabase.co/auth/v1/verify?token=d69168a55fd030ede78b6227fc1ac8f21d6cbb4cecfbbb1a2613bac7&type=magiclink&redirect_to=https://dtdcargo.com/portal/callback
```

Tres problemas, en orden de gravedad:

### 1. 🔴 El robot de WhatsApp quema el enlace antes que el cliente

Medido el 2026-08-09 con **DTD-9017 (Alain de Cardenas)**: el mensaje salió
10:58 y la tarjeta de previsualización de WhatsApp mostró el título y la
descripción de **dtdcargo.com** (*"DTD Cargo — Con Confianza, de China a tu
puerta"*), con `xpfuzqombmjmxvprjgmi.supabase.co` como dominio de origen.

Esa metadata **no existe** en `/auth/v1/verify`: ese endpoint devuelve un 302,
no HTML. Para haberla obtenido, el crawler recorrió la cadena completa —
incluido el paso que **consume el OTP**. `client_users` de DTD-9017 quedó en
`status='invited'` con `bound_at = null`: el cliente nunca entró.

Corolario de seguridad, independiente del bug: en el momento del fetch esa URL
**era una credencial de sesión válida** para ese cliente, y viajó por la
infraestructura de un tercero.

### 2. El TTL de 30 minutos obliga a coordinar en vivo

`generatePortalAccessLink` acuña el token **cuando el asesor aprieta el botón**,
no cuando el cliente lee. Si el cliente contesta a las dos horas, el enlace ya
murió. El comentario de `portal-invite-email.ts` lo asume como un hecho de la
vida ("coordinación en vivo"); no tiene por qué serlo.

### 3. El enlace no se parece a DTD Cargo

Un dominio ajeno (`supabase.co`) y sesenta caracteres de token. Para un cliente
venezolano que recibe un enlace por WhatsApp, eso se lee como estafa.

## Decisión

Un **enlace corto propio** con una **página de por medio**:

```
https://dtdcargo.com/entrar/K7M2QX4P
```

1. `GET /entrar/<código>` **no consume nada**. Valida el código y renderiza una
   página con la marca DTD: saludo + un botón **"Entrar a mi portal"**.
2. El magic-link de Supabase se acuña **en el POST del botón**, y ahí se marca
   el código como usado.

Por qué esto arregla los tres problemas de una:

| Problema | Cómo queda |
|---|---|
| El crawler quema el enlace | Los crawlers hacen `GET`, no aprietan botones. Ven la página, sacan un preview con la marca DTD, y el código queda intacto. |
| TTL de 30 min | El token nace en el clic del cliente. El **código corto** dura 72 h. |
| Dominio ajeno + chorizo | `dtdcargo.com/entrar/K7M2QX4P`. |

### Lo que NO se puede, y hay que decirlo

WhatsApp **no permite texto con enlace escondido detrás** (no hay markup de
anclaje). La URL siempre se ve. El objetivo alcanzable es que sea corta y diga
`dtdcargo.com` — no que diga "aquí para avanzar".

## Alcance (allowlist exacta)

```
supabase/migrations/0360_portal_access_links.sql        (nuevo)
lib/studio/portal/access-link.ts                        (nuevo)
lib/studio/portal/__tests__/access-link.test.ts         (nuevo)
app/entrar/[code]/page.tsx                              (nuevo)
app/entrar/[code]/actions.ts                            (nuevo)
app/entrar/[code]/_components/EntrarButton.tsx          (nuevo)
app/studio/(app)/clientes/actions.ts                    (portalAccessLinkAction)
app/studio/(app)/clientes/_components/PortalAccessCard.tsx  (copy del wa.me)
app/studio/(app)/admin/portal-backfill-actions.ts       (WA 1×1 + lote)
```

## Modelo de datos

`portal_access_links` — un código corto por invitación WhatsApp.

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `tenant_id` | uuid not null | RLS |
| `client_id` | uuid not null → `clients(id)` on delete cascade | |
| `code` | text **unique** | 10 chars, alfabeto sin ambigüedad |
| `expires_at` | timestamptz not null | +72 h |
| `used_at` | timestamptz | un solo uso |
| `revoked_at` | timestamptz | apagado manual |
| `created_by` | uuid | `auth.uid()` del asesor |
| `created_at` | timestamptz default now() | |

**RLS:** el equipo ve los de su tenant (`select`). Nadie inserta ni actualiza
por PostgREST: el `insert` va por RPC `SECURITY DEFINER` con chequeo de tenant
adentro, y el `update` (marcar usado) lo hace el `service_role` desde la ruta
pública. `anon` no tiene nada.

### El código

10 caracteres del alfabeto **Crockford sin ambigüedad** (`23456789ABCDEFGHJKMN
PQRSTVWXYZ`, 32 símbolos) → **50 bits**. Sin `0/O/1/I/L/U`, que es lo que se
copia mal cuando alguien lo dicta por teléfono.

Sigue siendo **una llave al portador**: quien lo tenga entra como el cliente.
Por eso: un solo uso, 72 h, revocable, y **la ruta devuelve el mismo error
genérico para todos los casos de fallo** (no existe / vencido / usado /
revocado) — no se le regala a un enumerador la diferencia entre "no existe" y
"existe pero está usado".

## Riesgo y mitigación

| Riesgo | Mitigación |
|---|---|
| El código vive 72 h en un chat de WhatsApp | Un solo uso + revocable. El daño máximo es el mismo que hoy, con más ventana; a cambio se elimina el caso —hoy real— de que el enlace llegue ya quemado. |
| Fuerza bruta sobre `/entrar/<código>` | 50 bits. A 1.000 intentos/s son ~35.000 años para el 1 %. No se agrega rate-limit propio en este slice. |
| El crawler aprieta el botón | No lo hace: es un `POST` de server action. Si algún día lo hiciera, el código ya está marcado y el cliente ve el error genérico — el mismo suelo que hoy, no peor. |
| Alguien reenvía el mensaje | Igual que hoy. La copia del wa.me lo dice explícito. |

## Fuera de alcance

- Rate-limit por IP en `/entrar` (50 bits lo hacen innecesario en este slice).
- Sacar `supabase.co` del correo de invitación (`sendPortalInviteEmail`): ahí el
  enlace va **dentro de un `<a>`**, así que el cliente nunca ve la URL. Mismo
  camino cuando se toque, pero no es este problema.
- Dominio de auth propio (`auth.dtdcargo.com`): resuelve el cosmético y **no**
  el bug del crawler. No se compra.

## Verificación

- Vitest sobre la lógica pura (generación de código, clasificación de estado).
- `GET` a `/entrar/<código>` deja `used_at` en null (es lo que prueba que el
  crawler no lo quema).
- Gate canónico `pnpm verify`.
