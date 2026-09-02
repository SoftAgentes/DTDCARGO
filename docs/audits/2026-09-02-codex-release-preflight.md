---
title: "Preflight de release: catálogo alojado y compatibilidad 0423"
tipo: auditoria-operativa
autor: Codex
created: 2026-09-02
updated: 2026-09-02
review-by: 2026-09-09
confidencialidad: interno
---

# Preflight de release · sin autorización de aplicación

Estado: **PREFLIGHT PARCIAL; CORRECTIVO 0423 VERIFICADO LOCALMENTE**.
Base del incremento: `2d7671ab90fe7afa041ee24340369ecab5194f99`.
Tarea: `Audita y limpia worktrees`, worker en `codex/saneamiento-integral`.
Las consultas alojadas de esta actualización terminaron antes de las
23:34 UTC del 2026-09-02. No hubo DDL, llamadas a RPC de negocio, lectura de
clientes/pagos/comprobantes, cambios de configuración ni aplicación de migraciones.

## Estado real y alcance de las consultas

Proyecto consultado explícitamente: `xpfuzqombmjmxvprjgmi`, DTDCargo,
`ACTIVE_HEALTHY`, región `us-east-1`, PostgreSQL `17.6.1.121`.
Se usaron metadatos del proyecto, ledger, funciones y catálogos de PostgreSQL.
Cada consulta SQL fue `BEGIN READ ONLY` + `SET LOCAL statement_timeout` +
`SELECT` + `ROLLBACK`; las consultas agrupadas confirmaron
`transaction_read_only = on`. Una llamada con varios SELECT sólo devolvió
el último resultado: no se tomaron sus resultados invisibles como evidencia.

Fuera de `pg_catalog` sólo se consultaron configuraciones: metadatos de
`storage.buckets` y la existencia booleana del tipo `payment_report` en el
registro `audit_entity_types`. No se leyeron filas operativas ni Storage objects.

### Ledger y nuevas RPC

- 406 entradas alojadas; última: `20260830230243 / 0398_audit_comment_action_summary`.
- Unión de `origin/main@2a2e81bf` y checkout: 420 archivos de migraciones.
- Corte de conciliación conservado en 238: **25 pendientes, 0399–0423**, y
  **0 huérfanas posteriores al corte**. No se certificó de nuevo el pasado
  bajo ese corte ni se eliminó la excepción histórica `0017_no_olvidar`.
- No existe ninguna de las 13 funciones nuevas: las seis `get_portal_*`
  de 0401–0406, `collections_mail_context`, `studio_client_annual_billing`,
  `conversation_client_outstanding`, `sales_order_invoice_refs` y los tres
  comandos `create_portal_payment_report`, `cancel_portal_payment_report`,
  `resolve_payment_report`. Búsqueda por namespace/nombre, sin ejecutar cuerpos.
- Tampoco existe `payment_private`. La RPC antigua `confirm_payment_report`
  sigue presente, ejecutable por authenticated/service_role, no anon.

### Precondiciones contrastadas

Los resultados siguientes describen lo medido, no un permiso para aplicar.
Los preflights posteriores a una expansión deben repetirse después de ella.

| Migración | Evidencia alojada | Gate que conserva |
|---|---|---|
| 0399 | TRUNCATE efectivo: anon en 179 y authenticated en 204 de 249 tablas públicas. | GO nominal; no se ejecutó TRUNCATE ni REVOKE. |
| 0400 | Las dos RPC de verificación existen; anon/authenticated/service_role tienen EXECUTE. | Revocación nominal; no se invocaron para probar datos. |
| 0401–0406 | Las seis RPC están ausentes; relaciones principales y auxiliares consultadas presentes. | Verificación completa de columnas/tipos/ACL y aplicación individual antes de consumidores. |
| 0407 | invoices con RLS, helpers de tenant/rol presentes y policy histórica ALL. | Aplicación individual y smoke de escritura autorizado. |
| 0408 | Seis tablas presentes con RLS, cuatro policies ALL históricas y dos helpers de mailing presentes. | Aplicación individual; no equivale a haber probado todos los roles alojados. |
| 0409 | Ambas tablas bancarias con RLS y policies ALL históricas. | Aplicación individual y prueba autorizada por rol. |
| 0410–0413 | Las cuatro fachadas están ausentes; dependencias principales presentes. | Confirmar contrato completo de columnas/tipos, aplicar de una en una y desplegar consumidores. |
| 0414 | Sigue invoices by tenant; aún no existen las fachadas 0411–0413 ni invoices_team_select de 0407. | Bloqueada por esas dependencias y por versión/smoke real de la app. |
| 0415 | mail_logs_tenant_select presente, sin otra SELECT/ALL de authenticated/public; falta collections_mail_context. | 0410, consumidores y smoke antes de restringir. |
| 0416 | 3 tablas con RLS, 3 SELECT Portal y 3 ALL de equipo; cero SELECT/ALL adicionales para auth/public. | GO nominal y repetir preflight; no necesita RPC nueva. |
| 0417 | 15/15 policies: nombres, comandos, roles y permisividad exactos; tablas requeridas con RLS. | GO nominal; no certifica comportamiento de filas reales. |
| 0418 | 14/14 policies con inventario exacto; ocho tablas requeridas con RLS. | GO nominal. |
| 0419 | 4/4 policies con inventario exacto; tablas requeridas con RLS. | GO nominal. |
| 0420 | 5/5 policies con inventario exacto; tablas requeridas con RLS. | GO nominal. |
| 0421 | Siete tablas con RLS y helpers de auditoría presentes; namespace, tres columnas, tres comandos y tipo de auditoría nuevos ausentes; payment-proofs privado. | GO nominal para expansión; después consumidores y smoke. |
| 0422 | SELECT de membresías presente; aún faltan objetos 0421 y políticas Portal 0420. Huellas de equipo y service_role sí coinciden con las esperadas. | Repetir preflight íntegro después de 0420/0421 y smoke de consumidores. |
| 0423 | Owner/definer/search_path/trigger 0195 coinciden; cuerpo equivalente con otra huella exacta. | Correctivo local descrito abajo; depende de 0421/0422 y GO nominal. |

Las tres huellas Portal de payment_reports actuales son anteriores a 0420;
su diferencia con las esperadas por 0422 es una dependencia pendiente, no
evidencia por sí sola de drift. Las huellas no modificadas por 0420 coinciden:
equipo `f118dd90556c13981e880287a2b28599` y servicio
`fe2e7aa3a94b94b876d7713f1517686d`.

### Storage y Edge Functions

Los **15 buckets consultados son privados**. `payment-proofs` permite PDF y
JPEG/PNG/WebP/HEIC/HEIF, límite 10 MiB. Se conservaron íntegramente. Esta
consulta no comprueba ACL de objetos, firma de URLs, subida, borrado ni E2E.

| Función alojada | Versión | Estado | Huella de bundle informada por el proveedor |
|---|---:|---|---|
| kommo-sync | 12 | ACTIVE | c1c3b50b74cbb3cf1aaa1ff305b873d5be94f35f24036522f12b969d50aae09b |
| kommo-webhook | 14 | ACTIVE | aff54dfc2595d1b858a00c553ee6eff7c480ec1944c0cd0be43ed49116ef1aac |
| kommo-writeback | 8 | ACTIVE | 1292ab7c16c66527e30b52188ba5af21387ec89d99d39fc0f06e3ea9e3f285a9 |
| kommo-push-client | 4 | ACTIVE | 719542c81f2a567072f6bffc8fee697bd6f838aa224c19a45affee4b5109ecdb |

Las cuatro reportan `verify_jwt=false`; esto exige revisar su autenticación
propia, no demuestra por sí solo acceso anónimo indebido. No se descargó el
código alojado ni se comparó el bundle con Git; tampoco se invocaron funciones
ni se leyeron logs, tokens o datos de Kommo. ACTIVE no es un smoke funcional.

## Correctivo local del guard 0423

`payment_reports_validate_invoice()` de Cloud tiene owner postgres,
SECURITY DEFINER, retorno trigger y `search_path=public`. Su trigger conserva
tipo 23, enabled O, sin atributos, condición ni argumentos adicionales.

| Fuente del cuerpo 0195 | MD5 exacto de prosrc con LF |
|---|---|
| Archivo del repo, con comentarios/formato | 89444225ab2212c58a331ea279ca0c5a |
| Catálogo alojado, sin esos comentarios/formato | cb17928a9d5beea435eddf06ea2087bc |

La lectura completa y la revisión independiente comprobaron las mismas
condiciones, sentencias y literales. El guard anterior rechazaba la segunda
variante: **RED causal del preflight**, no error de fixture. Se añadió sólo
esa segunda huella al conjunto permitido. No se normalizan cuerpos SQL
arbitrarios, no se omiten guards, no se modifica 0195 aplicada ni cambia el
cuerpo funcional instalado por 0423.

El test original acepta un modo opt-in con el cuerpo exacto observado; el
wrapper nuevo ejecuta el contrato completo y retira su parámetro al terminar.
Una sesión ejecutó Cloud → repo y comprobó que no se filtrara ese modo.

| Verificación nueva | Resultado |
|---|---|
| Reproducción antes del fix | exit1, `0423 abortado: validador0195 ausente o con drift`. |
| Contrato con cuerpo Cloud y con cuerpo repo | Cada variante: 323 aserciones, 18 derivas rechazadas, rollback=true. |
| Suite SQL canónica | 165/165 contratos, exit0, rollback total. |
| Reconstrucción canónica | 420 archivos: 402 schema + 18 sólo-ledger; 219 tablas y 2 tenants sintéticos, exit0. |
| Revisión independiente | Aprobada, sin bloqueantes de código/fixture. |
| Docs, numeración, gobernanza y CMP | exit0: 358 specs, 420 migraciones, 28 políticas, 5 fuentes CMP. |

No se repitieron build, TypeScript, Vitest, navegador o Advisors: el delta
cambia sólo la aceptación de una huella de preflight y sus pruebas. Los
resultados anteriores de esos gates no se atribuyen a esta ejecución.

SHA256 del archivo 0423 corregido:
`7a63c499d468451ad0ae0732ffaf42be5b78f4bb8f0e2e2e76651a553a0e235e`.
La prueba utiliza un contenedor exclusivo, sin red ni puertos; fue retirado
por su ID y etiqueta, con ausencia comprobada. Los gates canónicos utilizan
sus propios nombres, comprobados libres antes del arranque.

## Secuencia y pendientes de release

1. Publicación autorizada del lote local en su rama y CI del SHA exacto.
2. Terminar preflights de columnas/tipos/ACL de las fachadas y contrastar
   código/autenticación de Edge; no declarar completo el preflight general.
3. Aprobación nominal por migración. Aplicar expansiones 0401–0406,
   0410–0413 y 0421 antes de publicar sus consumidores; no ejecutar en bundle.
4. Resolver integración/despliegue y comprobar versión real de consumidores.
   0414 requiere 0407/0411–0413 y smoke; 0415 requiere 0410 y smoke.
   0422 requiere 0420/0421, consumidores y smoke; 0423 viene después.
5. Restricciones y pruebas alojadas de una en una según sus GO. Sólo después
   de publicación e integración demostradas se evalúa retirar el worktree.

No hay GO de main, Cloud o producción. No se reintentó el push rechazado.
El incremento agrega una pieza local después de los once commits pendientes;
la aprobación solicitada hasta `2d7671ab` no incluye automáticamente esta pieza.
El checklist conserva **48/103 (46,6 %)**: no se cuenta una prueba ni una
segunda comprobación del mismo correctivo como otra tarea terminada.

Runbook normativo: [aplicar migraciones](../runbooks/aplicar-migraciones-prod.md).
Fuentes consultadas: [changelog de Supabase](https://supabase.com/changelog) y
[RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
La documentación no sustituye catálogo, autorización ni verificación de operación.
