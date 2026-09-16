# Handoff Worker — 0472 clients RBAC de escritura

Fecha: 2026-09-16. Estado: lista-para-revision en PR draft; gate incompleto explícito.

Owner/sesión: `01a0aa97-b55c-7c02-8a23-ebb282c4b7be`.
Worktree: `C:/Users/AKX generator/.codex/worktrees/9bc3/DTDCARGO`.
Rama: `codex/sdd-reserve-0472-clients-rbac-escritura-gobernada`.
Base reservada: `cc131d4bfcd30508da29c0cea197710fa130e41f`, padre/main
`3f81ca83232e54218f486eac1943beab422c89a8`.
Git común: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.git`.
El worktree nuevo llegó detached y limpio; se asoció a la reserva libre.
Guard y claim PASARON antes de editar. No se movió trabajo ajeno.

## OBJETIVO ORIGINAL

Impedir DELETE físico de clients por authenticated y gobernar INSERT/UPDATE
directos mediante el permiso efectivo clients, incluidos overrides por rol,
sin cambios visuales ni consultas/escrituras en producción.

SDD: `docs/specs/0472-clients-rbac-escritura-gobernada/spec.md`.
Dependencias: 0357, 0440 y su evolución 0444, 0453, 0454 y 0455.
Alcance: SDD e índice generado, migración/test 0456 y este handoff; derivados
ignorados locales. Tests focales existentes sólo si resultan necesarios.
Autorizado: implementar, pruebas locales, commits selectivos, push de rama propia
y PR draft a main. Excluido: producción, merge, deploy, PR #114/#126, UI,
modificar migraciones aplicadas, secretos, limpieza de ramas/worktrees.

Aceptación: siete roles sin DELETE; escritura con membership único activo,
tenant y RBAC efectivo; defaults y overrides positivos/negativos; fallos cerrados;
SELECT sin cambio; RPC INVOKER, merge, Portal y auditoría preservados; pre/postflight
metadata-only; controles SQL rojos/verdes PG17; gates focales y pnpm verify;
revisión advisory de privacidad y cierre de conocimiento honesto.

## COMPLETADO

- Inventario fresco: fetch sin prune; 96 refs + worktrees, siguiente migración
  0456; sólo PRs abiertas #114 y #126. No se detectó colisión 0456.
- Diseño: reutilizar helper vigente 0444 sin redefinirlo; separar policies por
  operación y revocar DELETE. Conservar SELECT tenant-only vigente desde 0230.
- Implementación completa en 0456, sin cambio de helper, Server Actions o UI.
  Conserva InitPlan de 0012, SELECT Portal, RPC INVOKER, guards de merge y
  triggers/ACL/auditoría 0454/0455. Pre/postflight metadata-only, huellas de
  cuerpos íntegros (sólo CRLF→LF), constraints, ownership y privilegio efectivo.
- Prueba PostgreSQL 17.11: control rojo reproduce las tres escrituras indebidas;
  cierre verde final 162 aserciones con rollback total. Regresiones 0440/54/55
  verdes; 197 contratos SQL y reconstrucción del schema verdes en verify.
- Revisión independiente de RBAC/test y advisory de privacidad documentados.

## VALIDACIÓN

HEAD inicial de pruebas/verify: `cc131d4bfcd30508da29c0cea197710fa130e41f`
con exclusivamente la allowlist 0472 sin commit, luego guardada en `8f56f951`.
Revisión de ese commit detectó P2: faltaba verificar volatilidad del helper/RPC.
Se corrigió con volatilidad esperada i/s/v, no STRICT y no LEAKPROOF. Las pruebas
finales SQL focal/suite/schema pasaron sobre HEAD `8f56f951` más ese delta
selectivo, que queda en el commit de cierre que contiene este documento.
La migración final tiene SHA-256
`b9eb45348e8a96e677784ab6890b80ac2469a5bb694eb88160e20695020d879a`;
el test final `50710e5e7a328428495e5bb369b6fe33f3be5180e1c6f0b23b29d42568103960`.
Los recibos locales completos
se conservan en `graphify-out/0472-validation/` (ignorados, sin secretos).

| Comando / alcance | Estado | Evidencia |
|---|---|---|
| `pnpm install --frozen-lockfile` | PASÓ | 813 paquetes, lockfile intacto; Node 24.20.0/pnpm 11.19.0 |
| `docker exec dtd_0472_9bc3_pg17 psql -h 127.0.0.1 -X -U postgres -v ON_ERROR_STOP=1 -v apply_fix=false -f /sb/tests/0456_clients_write_rbac.test.sql` | PASÓ control rojo | Exit 3 esperado en GREEN DELETE; NOTICE reproduce INSERT support, UPDATE warehouse y DELETE de 7 roles |
| Mismo comando sin `-v apply_fix=false` | PASÓ | 162 aserciones finales; fixture rollback=t, PostgreSQL 17.11 |
| `psql ... -f /sb/tests/0440_client_document_entity_rbac.test.sql` | PASÓ | Helper documental original, rollback=t |
| `psql ... -f /sb/tests/0454_borrar_cliente_revoca_portal.test.sql` | PASÓ | 84 aserciones |
| `psql ... -f /sb/tests/0455_borrado_cliente_auditado.test.sql` | PASÓ | 85 aserciones |
| `pnpm test lib/studio/rbac.test.ts lib/studio/rbac-actions-guard.test.ts 'app/studio/(app)/clientes/__tests__'` | PASÓ | 143 tests / 7 archivos |
| `pnpm docs:index`, `pnpm docs:check` | PASÓ | 460 specs, índice sincronizado |
| `pnpm sdd:check` | PASÓ | 453 migraciones, sin colisiones nuevas; conserva históricos declarados |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ | 0 rojo / 0 amarillo |
| `pnpm verify`: harness/lint/RSC/types/Edge/test/docs/numbering/constantes/componentes/gobernanza | PASÓ | 178 harness, 7.301 tests / 562 archivos, 4 Edge; lint 0 errores y 11 warnings previos |
| `pnpm verify`: sql-tests | PASÓ | 197 contratos, rollback total, versión anterior al P2 de atributos |
| `pnpm verify`: schema-rebuild | PASÓ | 435 migraciones + 18 sólo-ledger; 219 tablas, tenants sintéticos |
| `node scripts/run-sql-tests.mjs` después del P2 | PASÓ | 197 contratos sobre migración/test finales; rollback total |
| `node scripts/check-schema-rebuild.mjs` después del P2 | PASÓ | 435 migraciones + 18 sólo-ledger; aislamiento sobre 219 tablas y dos tenants sintéticos |
| `pnpm verify`: migrations-applied | NO DISPONIBLE / SKIP | Sin URL/service key; producción excluida del encargo |
| `pnpm verify`: e2e | PASÓ con COBERTURA PARCIAL | 149 passed, 4 flaky, 33 skipped; detalle debajo |
| `pnpm verify`: build | PASÓ | Next 16.2.11 + postbuild; tsconfig restaurado por runner |
| `git diff --check`, guard/claim | PASÓ | Worktree propio y allowlist |
| Producción / navegador con sesión real / release | NO EJECUTADO | Excluidos; no se copian secretos para obtener verde |

Incidencias de prueba corregidas: el primer verde falló con 42601 (CASE sin
paréntesis en IF); el segundo con 42725 (concatenación text/char del catálogo).
Se corrigieron ambos y se repitió 0456, sin bajar aserciones. Una revisión
posterior añadió defensa contra cambios de espacios dentro de literales y su
probe. El verde final de 162 aserciones incluye además STABLE/IMMUTABLE/STRICT.

**Veredicto completo de `pnpm verify`: exit 0, CIERRE INCOMPLETO, 16/17 pasos;
migrations-applied crítico sin medir y e2e crítico con cobertura parcial.**
No hubo fallos definitivos en lo medido. Tras la corrección del P2 se repitieron
los gates afectados `node scripts/run-sql-tests.mjs` y
`node scripts/check-schema-rebuild.mjs`; no se atribuye el verify anterior al
delta de metadatos posterior. Los recibos finales están junto al focal final.

Cada caso E2E omitido se omitió en chromium, mobile-chrome y mobile-safari:

| Caso (3 ejecuciones cada uno) | Motivo / estado |
|---|---|
| auth.spec.ts:27 login Studio | NO DISPONIBLE: Supabase público ausente |
| auth.spec.ts:98 login Back | NO DISPONIBLE: Supabase público ausente |
| auth.spec.ts:106 magic link Portal | NO DISPONIBLE: Supabase público ausente |
| auth.spec.ts:114 dos puertas Portal | NO DISPONIBLE: Supabase público ausente |
| global-search.spec.ts:25 redirección sin sesión | NO DISPONIBLE: Supabase público ausente |
| comments-lifecycle.spec.ts:108 ciclo de comentarios | NO DISPONIBLE: Preview aislado/BASE_URL/E2E_SUPABASE_*/STUDIO_E2E_PASSWORD ausentes |
| gastos-expense-void.spec.ts:76 decisión Studio | NO DISPONIBLE: STUDIO_E2E_EMAIL/PASSWORD y EXPENSE_CODE de fixture |
| gastos-expense-void.spec.ts:99 decisión móvil | Mismo motivo, sin seed/credenciales |
| global-search.spec.ts:56 apertura buscador | NO DISPONIBLE: STUDIO_E2E_EMAIL/PASSWORD, branch+seed |
| global-search.spec.ts:72 facetas por rol | Mismo motivo, sin seed/credenciales |
| nomina-settlement-void.spec.ts:14 finiquito | NO DISPONIBLE: usuario admin/seed efímero PAYROLL_SETTLEMENT_CODE |

Flaky fuera de este delta SQL: calculadora-semantic-colors.spec.ts:53 en chromium
y mobile-chrome, calculadora-sin-peso.spec.ts:24 y :63 en mobile-chrome.
Pasaron con los reintentos propios de Playwright; no se modificaron esos tests.

Runtime: Docker 29.7.2, imagen postgres:17
`sha256:67f41722b7a8cbdb868a44a4995c846eddfdc2973bccb291ce937dce88ad5675`.
Contenedor focal sin red, sin puertos publicados, fixtures ficticios. Docker
no iniciaba por sockets Windows huérfanos. Auto-review rechazó inicialmente un
stop genérico; con WSL detenido, cero motores y PID/fechas de nuestros propios
arranques fallidos, aprobó la recuperación acotada. Se preservaron directorios
socket-only `Docker/run.0472-stale-20260916`, `Docker/run.0472-attempt2-20260916`
y `docker-secrets-engine.0472-stale-20260916` bajo AppData/Local. No se cambiaron
datos, volúmenes ni configuración. Recibo `docker-recovery-20260916.json`.

## COMMITS

- `cc131d4b`: reserva SDD heredada de Director.
- `8f56f951`: implementación, matriz SQL, SDD y advisory.
- Commit que contiene este cierre: corrección P2 de atributos funcionales,
  pruebas negativas y recibos/handoff. SHA final registrado en PR.

## PR / BRANCH

[PR draft #127](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/127).
Rama propia indicada arriba; base main `3f81ca83232e54218f486eac1943beab422c89a8`.
Allowlist verificada en PR: exactamente cinco archivos. El push dispara el
Preview automático del proveedor; no se hizo deploy manual ni release productivo.

## PENDIENTES DE ESTA TAREA

- Revisión Director del SHA final y del gate incompleto; smokes en entorno
  autorizado con datos sintéticos/credenciales apropiadas antes de aprobar.
- Integración y aplicación 0456, si se autorizan después, son acciones distintas.
- Semántica piloto/global y lectura visible de Obsidian quedan sin certificar;
  recibos locales no sustituyen publicación integrada ni revisión visual.

## FUERA DE ALCANCE DETECTADO

- merge_clients SECURITY DEFINER admite support en su guard propio (0361).
- Lector TS de overrides devuelve defaults al fallar consulta; SQL falla cerrado.
- MP-01: permanencia P2 sin restauración, notas/motivos libres, retención y
  supresión integral pendientes previos; no se amplían silenciosamente aquí.
- Ruta histórica `_norte/backend/README.md` está movida a
  `docs/design/studio/_norte/backend/README.md`, que sí se leyó.

## HANDOFF AL DIRECTOR

Revisar PR #127 y el SHA/base final, conservando el orden después de los smokes
de Sam. El P2 de la revisión independiente queda corregido y probado; no hay
otros hallazgos accionables confirmados en ese review. SDD queda in-progress
por validación crítica parcial; no declarar cierre verde completo ni producción.
Root libera el claim al acabar el push/check final; el recibo de cierre en la
PR registra esa liberación. No eliminar rama/worktree ni backups de sockets.
Conocimiento: fuentes canónicas actualizadas SDD/índice/handoff; sin cambios a las
16 fuentes piloto. Se construyó grafo local desde cero con Graphify 0.9.61
(34.062 nodos/63.561 aristas/2.286 comunidades). No se importó evidencia de main.
Semántica NO EJECUTADA: 0/16 piloto y 0/1.075 global; son pendientes explícitos.
Archify 2.16.0 preparado desde release oficial, build PASÓ 9/9 sin warnings.
Su check y preview iniciales detectaron cambios concurrentes de fuentes y
rechazaron el snapshot (`ARCHIFY_STALE_CORPUS`/`SOURCE_CHANGED`). El cierre
reproducible sobre el commit final ejecuta `graphify update .`,
`node scripts/knowledge-visual.mjs build`, `node scripts/knowledge-visual.mjs check`,
`node scripts/knowledge-sync.mjs publish --preview`, `check --preview` y `status`.
Resultados finales por capa/SHA se conservan en `graphify-out/0472-knowledge-final.json`
y en la PR; esa evidencia se produce después de este commit para no autorreferir
la revisión ni invalidar el corpus al escribirla. Un check parcial por semántica
0/16 se informa como tal, no como fallo de integridad ni piloto certificado.
Publicación compartida y revisión visual en Obsidian NO EJECUTADAS.
Warnings previos: 74 self-loops, 11 import targets virtuales, 22 JSON de datos
omitidos AST y extracción parcial en dos archivos Legal. No implican semántica
verificada ni nueva deuda de producto 0472. Recibos en graphify-out.

## Advisory de datos personales (lectura local)

Skill: `.claude/skills/revisar-datos-ve/SKILL.md`, revisión independiente por
subagente sobre base `cc131d4b`. Sin filas reales. Resultado de los doce puntos:
**1 CORRECTO, 2 ENCONTRADO, 9 NO VERIFICABLE**. Es una revisión técnica acotada,
no asesoría legal ni declaración de cumplimiento. Una segunda revisión jurídica
y técnica independiente queda recomendada para los pendientes fuera de 0472.

Inventario: cada fila identifica un campo de `clients`. NV = no verificable en
esta tarea. Lectura T = miembros del tenant conforme a la policy vigente;
destinatarios externos sólo documentados, sin validar acceso efectivo/contratos.
El registro `docs/legal/privacidad/registro-tratamiento.md:23-29` declara contrato
para nombre/contacto/dirección y consentimiento para marketing, sin que esta
revisión evalúe la suficiencia jurídica de esas bases. La retención queda NV
para todos estos campos; el soft-delete conserva la fila.

| Campo | Finalidad observable/declarada | Base declarada | Destinatario documentado | Evidencia |
|---|---|---|---|---|
| id | Identidad estable | NV | T | 0006_clients.sql:10 |
| markbox | Identidad operativa de carga | NV | T | 0006_clients.sql:12 |
| name | Servicio, nombre/razón social | Contrato | T | 0006_clients.sql:13 |
| email | Comunicación del servicio | Contrato | T, correo/CRM | 0006_clients.sql:14 |
| phone | Contacto/coordinación | Contrato | T, CRM | 0006_clients.sql:15 |
| address | Entrega | Contrato | T, geocodificación | 0006_clients.sql:16 |
| rif | Identificación | Contrato/obligación declarados | T | 0006_clients.sql:17 |
| tier | Clasificación comercial | NV | T | 0006_clients.sql:18 |
| notes | Finalidad no evidente en el código | NV | T | 0006_clients.sql:19 |
| created_at | Alta del perfil | NV | T | 0006_clients.sql:20 |
| updated_at | Actualización | NV | T | 0006_clients.sql:21 |
| deleted_at | Retirada operativa | NV | T | 0006_clients.sql:22 |
| lat | Geolocalización, Cerca tuyo | NV | T | 0048_clients_geo.sql:13 |
| lng | Geolocalización | NV | T | 0048_clients_geo.sql:14 |
| address_reference | Referencia de entrega | NV | T | 0066_foundation_v3.sql:151 |
| facade_photo_url | Foto de vivienda | NV | T, bucket privado client-facades | 0066_foundation_v3.sql:152 |
| portal_approved_at | Aprobación Portal | NV | T | 0087_portal_approval.sql:16 |
| cedula_photo_path | Foto de identificación | NV | T, bucket privado client-docs | 0091_portal_self_register.sql:24 |
| registration_channel | Origen de alta | NV | T | 0092_identity_verification.sql:30 |
| doc_kind | Tipo de documento | NV | T | lib/studio/client-types.ts:56 |
| doc_verify_status | Resultado advisory de identidad | NV | T | 0092_identity_verification.sql:68 |
| doc_verify_source | Fuente de resultado | NV | T | 0092_identity_verification.sql:77 |
| doc_registry_name | Nombre de registro oficial | NV | T | 0092_identity_verification.sql:85 |
| doc_verified_at | Momento de verificación | NV | T | 0092_identity_verification.sql:93 |
| doc_verified_by | Usuario verificador | NV | T | 0092_identity_verification.sql:100 |
| kommo_lead_id | Relación con trato CRM | NV | T, CRM | 0108_clients_kommo_lead.sql:8 |
| email_marketing_optin_at | Opt-in email | Consentimiento | T | 0134_clients_email_consent.sql:10 |
| email_optin_source | Origen opt-in | Consentimiento | T | 0134_clients_email_consent.sql:11 |
| whatsapp_marketing_optin_at | Opt-in WhatsApp separado | Consentimiento | T | 0134_clients_email_consent.sql:12 |
| advisor_id | Asesor asignado | NV | T, Portal | 0151_clients_advisor.sql:29 |
| person_id | Vínculo identidad | NV | T | 0172_clients_person_link.sql:12 |
| contact_name | Contacto de empresa, puede no tener cuenta | NV | T | 0194_clients_contact_name.sql:20 |
| avatar_path | Foto opcional | NV | T, Portal, client-docs | 0199_clients_avatar.sql:4 |
| merged_into_client_id | Identidad superviviente | NV | T | 0341_client_merge_duplicados.sql:41 |
| kommo_contact_id | Identidad CRM | NV | T, CRM | 0342_kommo_contact_link.sql:35 |
| city | Ciudad de entrega | NV | T | 0348_clients_ciudad_estado.sql:39 |
| state | Estado de entrega | NV | T | 0348_clients_ciudad_estado.sql:40 |
| aliado_id | Relación comercial | NV | T | 0362_aliados_base.sql:130 |
| phone_last10 | Matching por teléfono | NV | T, CRM | 0383_clients_phone_last10_y_vinculo.sql:65 |

Rutas SQL de la tabla relativas a `supabase/migrations/`. Geolocalización merece
revisión específica; foto de identidad/avatar no prueban tratamiento biométrico.
Notes y motivo libre pueden contener información sensible; no se leyó contenido.

| Punto | Estado | Evidencia / límite |
|---|---|---|
| Inventario | CORRECTO | Esquema/tipos/buckets anteriores; sólo inventario técnico |
| Minimización | ENCONTRADO | notes con trim sin límite/finalidad evidente, lib/studio/client-types.ts:344; motivo libre 0455:302-310 |
| Consentimiento | NO VERIFICABLE | 0134:9-19 tiene timestamps/canales, no prueba registros/versión/retirada efectivos |
| Derechos | NO VERIFICABLE | app/studio/(app)/clientes/actions.ts:290-380 y 0220:28-47 no prueban procedimiento íntegro del titular |
| Borrado integral | ENCONTRADO | 0455:312-320 sólo deleted_at; docs/legal/privacidad/mapa-de-borrado.md:305-318 conserva datos/archivos y retención sin fundamento resuelto |
| Trazabilidad de solicitudes | NO VERIFICABLE | 0455:245-272 audita operación, no recepción/evaluación/respuesta al titular |
| Política pública | NO VERIFICABLE | app/privacidad/page.tsx:10-21,39-68 no prueba despliegue ni revisión jurídica actual |
| Terceros | NO VERIFICABLE | docs/legal/privacidad/inventario-terceros.md:24-34,81-85; contratos/retención sin validar |
| Transferencias | NO VERIFICABLE | Mismo inventario:24,34,81-85; no se comprobaron regiones/accesos desde China |
| Decisiones automatizadas | NO VERIFICABLE | 0092:68-88 advisory previo; 0472 no añade scoring ni perfilado |
| Aceptación electrónica | NO VERIFICABLE | lib/studio/legal/seal.ts:119-176 no prueba certificados/evidencia real/valor probatorio |
| Titulares sin cuenta | NO VERIFICABLE | 0194:4-14,20-23 contacto de empresa; aviso/base/solicitudes no revisados |

Reglas de gobernanza: SGE-00.05 exige servidor y negativos por rol/tenant
(`docs/governance/policies/sge-00.md:53`); MP-01 prohíbe P0 ordinario y pide P1/R2
para maestros (`mp-01.md:24,69`). Permanece la no conformidad previa P2 sin
restauración (`docs/specs/0469-borrado-cliente-auditado/spec.md:90-95,414`).
AUD-01 conserva atomicidad/payload de 0455:245-272 y revocación 0454:277-313.
AUD-02 y BTN-01 no aplican al delta de consulta/retención/UI, que no cambia.
El estado de cumplimiento acotado depende de los recibos SQL, no de esta lectura.
