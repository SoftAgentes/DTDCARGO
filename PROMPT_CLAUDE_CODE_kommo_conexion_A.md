# Prompt para Claude Code — Conexión Kommo → ERP (Fase 1, alcance A: mínima read-only)

> Pega TODO el bloque de abajo en Claude Code, dentro de tu repo del ERP
> (donde está `KOMMO_API_REFERENCE.md`).
> Alcance A = SOLO poner la API de Kommo hacia el ERP: traer datos y guardarlos.
> Sin webhooks todavía (eso es la fase B, se monta encima sin reescribir nada).

---

```
<rol>
Eres un Senior Backend Engineer especializado en Supabase (PostgreSQL + Edge Functions
en Deno/TypeScript) e integraciones de APIs REST. Trabajas en pasos pequeños y
verificables, y muestras el plan antes de escribir código.
</rol>

<contexto_proyecto>
- Negocio: DTDCARGO, logística internacional China↔Venezuela (carga consolidada, puerta a puerta).
- Construyo un ERP propio. Este módulo conecta Kommo CRM como FUENTE DE DATOS externa.
  NO es el CRM de producción; el CRM propio es una fase posterior.
- Backend: Supabase (PostgreSQL + Edge Functions + Vault + pg_cron).
- En el repo está KOMMO_API_REFERENCE.md con la API de Kommo ya documentada.
  ÚSALO como referencia única de la API (endpoints, auth, formato HAL); consúltalo, no lo repitas.
- Multi-tenant a futuro (plan SaaS): por eso las tablas llevan tenant_id + RLS desde ahora,
  aunque por ahora haya UNA sola cuenta (la mía).
</contexto_proyecto>

<objetivo_de_esta_fase>
ALCANCE A — conexión mínima READ-ONLY. Lo único a lograr:
1. Guardar de forma segura las credenciales de Kommo.
2. Una Edge Function que se autentica con Kommo, trae datos (leads, pipelines, statuses,
   contacts, custom_fields) paginando, y los GUARDA en tablas espejo de Supabase.
3. Poder ejecutar ese sync y ver datos reales de Kommo dentro de Supabase.
NADA más. Sin webhooks, sin escribir en Kommo, sin dashboard, sin mapeo a entidades de negocio.
</objetivo_de_esta_fase>

<autenticacion>
- Método: LONG-LIVED TOKEN de Kommo (una sola cuenta; sin refresh, sin OAuth en esta fase).
- El token se guarda en SUPABASE VAULT (cifrado), referenciado desde la tabla de conexión.
- NUNCA en el repo, ni en .env versionado, ni en columna de texto plano, ni en el frontend.
  (Esto corrige un error real visto en proyectos de referencia: token hardcodeado en el código.)
- La Edge Function lee el token desde Vault en tiempo de ejecución.
</autenticacion>

<tablas_a_crear>
Migrations en SQL (aplicables con el CLI de Supabase). TODA tabla con tenant_id uuid + RLS
(un tenant nunca ve filas de otro).

1. tenants — empresas cliente del SaaS (por ahora una fila: la mía).
2. kommo_connections — vincula tenant ↔ cuenta Kommo: subdomain, account_id, referencia al
   secreto en Vault (no el token en claro), estado, last_sync_at.
3. kommo_pipelines — espejo de embudos (id de Kommo, name, sort, is_main).
4. kommo_statuses — espejo de etapas (id, pipeline_id, name, sort, color).
5. kommo_leads — espejo de leads: id, name, status_id, pipeline_id, price,
   responsible_user_id, created_at, updated_at (de Kommo, como timestamp), closed_at,
   custom_fields jsonb (el array crudo tal cual viene de Kommo).
6. kommo_contacts — espejo de contactos: id, name, responsible_user_id, created_at,
   updated_at, custom_fields jsonb (teléfonos/emails viven aquí, con code PHONE/EMAIL).
7. kommo_custom_fields — definición de campos personalizados (id, name, type, entity_type,
   enums jsonb) para poder interpretar los custom_fields de leads/contactos.
8. sync_logs — registro de cada corrida: tenant_id, entity, started_at, finished_at,
   records_fetched, records_upserted, status ('ok'|'error'), error_detail.

Son tablas ESPEJO de Kommo. El mapeo a entidades de negocio del ERP (cliente/envío/contenedor)
es una capa POSTERIOR; NO la hagas ahora.
</tablas_a_crear>

<edge_function_de_sync>
UNA Edge Function (ej. `kommo-sync`) que, recibiendo el tenant_id:
1. Lee subdomain + token (desde Vault) de kommo_connections.
2. Trae de Kommo, vía REST, y hace UPSERT a las tablas espejo:
   pipelines + statuses, custom_fields (definiciones), contacts, leads.
3. Registra el resultado en sync_logs.
La invoco manualmente en esta fase (después, en fase B, pg_cron la programa para reconciliación).

Implementa un helper kommoFetch(subdomain, token, path) reutilizable, con estas MEJORAS
(extraídas de proyectos de referencia, son las que dan robustez sin complejidad):

  M1 — Helper getFieldValue(entity, ...keywords): lee custom_fields_values de Kommo y
       devuelve el valor cuyo field_name contiene esas keywords. Los datos útiles de
       leads/contactos viven en custom_fields; sin esto no se extrae nada aprovechable.
       (Guarda igual el array jsonb crudo; getFieldValue es para lectura/normalización.)

  M2 — Paginación de DOS PASADAS por entidad: una por order[updated_at]=desc y otra por
       order[created_at]=desc, deduplicando por un Set de IDs. Captura tanto lo recién
       modificado como lo recién creado. Seguir páginas hasta que la página venga incompleta
       (length < limit) o status 204. limit=250, con tope de páginas (ej. 20) por seguridad.

  M3 — UPSERT IDEMPOTENTE por id de Kommo (onConflict = id). Aunque no haya webhooks aún,
       re-ejecutar el sync NO debe duplicar filas. Comparar updated_at para no pisar con
       datos más viejos.

  M4 — Manejo de status en kommoFetch: 204 (sin contenido → fin), 401 (token inválido →
       error claro), 429 (rate limit → backoff/espera y reintento), 5xx (reintento con
       backoff). Respetar el rate limit (~7 req/s): pequeño delay entre páginas.
</edge_function_de_sync>

<restricciones_de_seguridad>
Errores reales auditados en proyectos de referencia que NO debes repetir:
- NUNCA commitear .env ni secretos. El token va a Vault; el frontend nunca lo toca.
- NUNCA api_token en columna de texto plano (Vault, siempre).
- RLS REAL por tenant_id en toda tabla. Prohibido USING(true) (eso es RLS de mentira:
  deja leer todo al rol anon).
- service_role key solo dentro de la Edge Function (backend), jamás en frontend.
- anon key es público por diseño, pero NO lo hardcodees: va por variable de entorno.
</restricciones_de_seguridad>

<fuera_de_alcance>
NO hagas ahora (fases posteriores):
- Webhooks de Kommo (fase B: se monta encima de estas mismas tablas, sin reescribir).
- Escribir en Kommo (crear/editar leads, campos, etapas, pipelines).
- Mapeo Kommo → entidades de negocio del ERP (cliente/envío/contenedor).
- OAuth 2.0 (para onboarding multi-tenant de varios clientes).
- Dashboard, KPIs, snapshots, "tiempo por etapa".
</fuera_de_alcance>

<criterios_de_aceptacion>
- Las migrations aplican limpio con el CLI de Supabase.
- RLS verificable: un tenant no puede leer filas de otro.
- El token NO está en el repo ni en texto plano: vive en Vault y se lee en runtime.
- Ejecutar kommo-sync trae datos REALES de Kommo y los deja en las tablas espejo.
- Re-ejecutar kommo-sync NO duplica filas (idempotencia probada).
- sync_logs registra cada corrida con conteos y estado.
</criterios_de_aceptacion>

<forma_de_trabajo>
- PASOS PEQUEÑOS. Antes de escribir código, muéstrame el plan (archivos + migrations) y espera mi OK.
- Usa el CLI/MCP de Supabase. NO instales PostgreSQL local (uso Supabase).
- Después de cada bloque, dime QUÉ probar y CÓMO, en pasos numerados.
- Código real y testeado, no teoría. Si algo es ambiguo, pregúntame antes de asumir.
- Respuestas concisas. Español, términos técnicos en inglés.
</forma_de_trabajo>

<primer_paso>
Empieza proponiendo: (1) la estructura de carpetas del módulo, (2) el contenido del primer
migration (las 8 tablas + RLS por tenant_id), y (3) cómo lo aplico con el CLI de Supabase
y cómo cargo el long-lived token en Vault de forma segura.
NO escribas la Edge Function todavía; primero acordamos el esquema de datos.
</primer_paso>
```

---

## Cómo usarlo

1. Confirma que `KOMMO_API_REFERENCE.md` esté en el repo (Claude Code lo va a leer).
2. Ten a mano: el **subdomain** de tu cuenta Kommo y un **long-lived token** generado
   (Kommo → integración privada → Keys and scopes → Generate long-lived token).
   NO lo pegues en el chat con Claude Code; lo cargas en Vault como te indique.
3. Abre Claude Code en la carpeta del repo y pega el bloque.
4. Te responderá con el plan del primer migration. Revísalo, dale OK, y avanza.
5. Cuando tengas el plan o dudas de arquitectura, vuelve conmigo.

## Qué deja listo el alcance A

La API de Kommo conectada al ERP: credenciales seguras en Vault + tablas espejo en Supabase
+ una Edge Function que trae datos reales y los guarda sin duplicar. Esa es tu primera
victoria tangible: datos de Kommo dentro de tu ERP.

## Lo que viene después (no ahora)

- Fase B: webhooks (Kommo te avisa de cambios en tiempo real) sobre estas mismas tablas.
- Mapeo a tu entidad "Envío/Contenedor".
- Dashboard + KPIs logísticos + tiempo por etapa.
