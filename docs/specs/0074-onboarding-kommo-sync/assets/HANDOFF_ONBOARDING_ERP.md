# HANDOFF — Onboarding de Clientes (ERP) · DTD Cargo

> Documento de especificación para **Claude Code**. Es un **módulo del ERP**, no del curso.
> La guía `/guia` (ver `HANDOFF_GUIA_ALIBABA.md`) **consume** este módulo; no construye auth propia.
> Asignar `SDD-00XX` y registrar la decisión en `AGENTS.md` vía `/in`.

---

## 0. Para Claude Code (cómo usar este documento)

- Esto es el **modelo de cliente del ERP**: registro, niveles, Shipping Mark y verificación de identidad.
- Usa lo que YA existe en el repo: cliente Supabase, **Supabase Auth**, design tokens, **Vault**, numeración SDD, `AGENTS.md`, regla de `.claude/` en `.gitignore`.
- **Orden de construcción (hay dependencia):**
  1. Auth + tabla `clientes` + emisión de Shipping Mark (registro simple).
  2. Verificación avanzada (cédula → RIF) + activación de Shipping Mark.
  3. La guía `/guia` gatea sobre esto (auth + tier).
  4. Sync a Kommo.
- Worktree **`feat/onboarding-erp`**. Al cerrar, `/in` a `AGENTS.md`.

---

## 1. Objetivo

Onboarding de clientes con **2 niveles** (simple / verificado), **emisión de Shipping Mark** y **verificación de identidad** (cédula → RIF vía CNE). Filtra para los perfiles que SÍ queremos (mayoristas recurrentes y revendedores), no compradores de una vez. Cada registro y cada Shipping Mark verificado **ya es ERP funcionando**.

---

## 2. Autenticación

- **Supabase Auth.** Método recomendado: **WhatsApp OTP** (la realidad del cliente VE). Fallback para MVP: email magic-link. *(Config de Sam; no bloquea el desarrollo.)*
- Una cuenta = un cliente.

---

## 3. Modelo de datos (Supabase)

Tabla `clientes` (o extender `leads` si encaja con el schema existente):

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `auth_user_id` | uuid | |
| `nombre`, `whatsapp`, `email`, `ciudad`, `producto_interes` | text | Registro simple |
| `tier` | enum | `simple` \| `verificado` |
| `tiene_carga`, `tiene_curso` | bool | Entitlements de servicio → qué módulos ve en el portal |
| `shipping_mark` | text | **único, inmutable** |
| `shipping_mark_status` | enum | `asignado` \| `activo` |
| `cedula`, `rif`, `nombre_verificado`, `empresa`, `direccion` | text | **PII** — solo verificado |
| `verificado_at` | timestamptz | |
| `verificacion_fuente` | enum | `cne_api` \| `manual` |
| `verificacion_payload` | jsonb | **server-only**, respuesta de la API |
| `utm`, `created_at`, `updated_at` | | |

- `curso_progreso` (de la guía) referencia `cliente_id`.
- **RLS:** cada cliente ve solo lo suyo. PII (`cedula`, `verificacion_payload`) **solo** accesible server-side / rol admin.

---

## 3.1 Capas de acceso y módulos por servicio

El material y los servicios se sirven en **3 capas por nivel de acceso**. **No se "activa material por cliente"** — se controla qué capa ve cada quien con **flags automáticos**:

| Capa | Quién | Qué ve | Activación |
|---|---|---|---|
| 1. Público | Sin cuenta | **Preview del curso** (etapas 0–2 de `/guia`) | Ninguna — siempre visible |
| 2. Registrado | Cuenta simple/verificada | **Guía completa (gratis, lead magnet)** + Shipping Mark + progreso | Automática al registrarse |
| 3. Portal por servicio | Cliente con flag | Módulo **Carga** (si `tiene_carga`) y/o **Curso premium** (si `tiene_curso`: facilitador, certificado, extras) | **Flag automático al contratar** — nunca manual |

**Reglas:**
- `tiene_carga` y `tiene_curso` son **independientes**: un cliente puede tener uno, ambos o ninguno.
- El portal **renderiza módulos según los flags** del cliente. **Sin activación manual por persona.**
- Un cliente que no usa el portal **no genera costo ni setup** — el acceso es por flag.
- El preview público (capa 1) no requiere cuenta — es el gancho para el que "pregunta por un curso".

---

## 4. Registro Simple (flujo)

1. Form: nombre, WhatsApp, email (+ producto opcional).
2. Crea auth user + registro `cliente` (`tier='simple'`).
3. **Emite Shipping Mark** `DTD-XXXXX` (ver §6) → `status='asignado'`.
4. Pantalla premio (gamificada): *"¡Felicidades! Tu Shipping Mark es DTD-XXXXX"*.
5. Sync Kommo (upsert; dedup por phone/email; tag `tier=simple`).

**Desbloquea:** guardar progreso, calculadoras, seguir la guía, cotizar.

---

## 5. Registro Avanzado / Verificación (flujo)

1. Form: cédula (`V-XXXXXXXX`) + dirección/empresa. **Consentimiento explícito** (ver §9).
2. **Edge Function (server-side)** consulta **cedula.com.ve** → nombre completo + RIF.
   - Si la API requiere key → **Supabase Vault**.
   - **Confirmar endpoint y términos de la API al implementar** (puede cambiar; hay fallback).
3. Guarda `nombre_verificado` + `rif`; `tier='verificado'`; `verificacion_fuente='cne_api'`.
4. **Activa** el Shipping Mark (`status='activo'`).
5. **Fallback:** API caída o dato no encontrado (ej. nacidos post-2006) → encola **verificación manual** (Luis/María) en el panel admin (`verificacion_fuente='manual'`).
6. Sync Kommo: tag `verificado` + campo `RIF`.

**Desbloquea:** importar de verdad, **precio por cadencia**, prioridad, white-label (Fase 2).

**Cuidados:** rate limit **200/hora** (cachear/encolar si escala); PII **nunca** en cliente, URL ni logs.

---

## 6. Shipping Mark

- **Formato:** `DTD-` + secuencial con padding (ej. `DTD-00427`). Único, inmutable, legible.
- `asignado` (simple) = llave del curso. `activo` (verificado) = operativo para envíos.
- Es el identificador que el proveedor marca en cada bulto → ruteo correcto en el almacén DTD (Yiwu).

---

## 7. Integración con la guía `/guia`

- **Gating:** etapas 0–2 abiertas (prueba/enganche); para obtener Shipping Mark + guardar progreso + seguir → **requiere registro simple** (login). *(Palanca ajustable: Sam puede endurecerlo a registro desde etapa 1.)*
- `curso_progreso` se asocia al `cliente_id`.
- Actualizar `HANDOFF_GUIA_ALIBABA.md` §5: la guía **consume** este módulo; no crea auth propia. *(Ya anotado allí.)*

---

## 8. Kommo

- **Upsert** del cliente como lead/contacto, **dedup contra los ~2.678 contactos existentes** por phone/email.
- Campos/tags: `tier` (simple/verificado), `shipping_mark`, `RIF` (verificado), `perfil` (agente/emprendedor desde la guía), `etapa_max`, UTM.
- **Token Kommo en Vault**; llamada server-side (nunca en cliente).

---

## 9. Privacidad y seguridad (obligatorio)

- **Cédula / RIF / payload:** server-side only, **RLS estricta**, nunca en cliente, URL ni logs.
- **Consentimiento explícito** en el form avanzado: *"Verificamos tu cédula ante el CNE para confirmar tu identidad y generar tu RIF, necesario para tu importación. No compartimos tus datos."*
- **Minimización:** pedir solo lo necesario. **Audit log** de cada verificación.
- **Vault** para todas las llaves. `.claude/` en `.gitignore` (regla del proyecto).

---

## 10. Criterios de aceptación

- [ ] Registro simple crea cliente + emite Shipping Mark + sync Kommo.
- [ ] Registro avanzado verifica cédula (o cae a fallback manual), guarda RIF, activa el Shipping Mark y marca `verificado`.
- [ ] RLS impide ver PII ajena; la PII nunca llega al cliente.
- [ ] La guía `/guia` gatea sobre auth/tier y asocia el progreso al cliente.
- [ ] **Cero menciones a Canopy** en texto de cliente. `AGENTS.md` actualizado vía `/in`.

---

## 11. Fuera de alcance (sin scope creep)

- Dashboards completos del ERP, pagos, white-label → **Fase 2**.
- **Proveedores no acceden al sistema** (nunca).
- Mantener el MVP de onboarding **acotado**: registro + Shipping Mark + verificación. Nada más por ahora.

---

## Anexo A — Rol Facilitador (fast-follow, reusa el sistema de acceso)

> **No es parte del MVP de onboarding de clientes** ni prioritario sobre el core del ERP de carga. Es una **extensión del mismo sistema de roles**, a construir DESPUÉS de la base.
> **No bloqueante:** un facilitador puede dictar el curso YA con `PLAYBOOK_FACILITADOR_ALIBABA.md` + la guía pública + los PDFs. El portal solo ordena la entrega de recursos.

Cuando se construya, rol `facilitador` sobre el mismo sistema de acceso:

- **Portal con el material por fases** (Fase 1–4 del playbook) + recursos descargables (PDFs, links de YouTube, plantillas).
- **Acceso temporal**: vigencia con fecha de expiración (la semana / los 3 meses del trato). Admin (DTD) crea, asigna y expira facilitadores.
- **NO ve datos ni PII de clientes.** Solo material del curso.
- Opcional: ver cuántos asistentes se registraron con su **código de facilitador** (atribución), sin PII.
- **Fuera de alcance del rol:** edición de contenido por el facilitador, pagos/comisiones automáticas → Fase 2 si aplica.
