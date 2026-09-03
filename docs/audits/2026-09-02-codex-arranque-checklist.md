---
title: "Arranque Codex: estado saneado y checklist ejecutable"
tipo: auditoria-operativa
autor: Codex
created: 2026-09-02
updated: 2026-09-02
review-by: 2026-09-09
confidencialidad: interno
---

# Arranque Codex · estado saneado y checklist ejecutable

Este documento es el punto de entrada operativo después del traspaso desde
Cloud. No reemplaza specs ni runbooks: ordena qué sigue, quién puede hacerlo y
qué autorización exige. Los números son una medición del 2026-09-02 y deben
refrescarse antes de cualquier operación Git o alojada.

## Snapshot comprobado

### Resumen para Sam · punto de control vigente del objetivo

**Avance del checklist: 51 de 105 casillas completadas (48,6 %); 54 pendientes.** Es un
recuento de tareas, no una estimación de horas restantes ni del porcentaje
funcional del ERP: las casillas tienen tamaños distintos y algunas agrupan
varios cambios. No existe todavía una medición defendible del producto completo.

| Bloque | Hecho / total | Situación |
|---|---:|---|
| Correcciones locales enumeradas | 27 / 27 | Implementadas/verificadas localmente; no equivale a producción |
| Cierre Git y publicación | 12 / 21 | Publicación parcial; falta lote nuevo e integración |
| Cloud y operación alojada | 4 / 32 | Metadatos/código y avisos clasificados; aplicación y operación real pendientes |
| Seguridad pendiente por dominio | 3 / 9 | Comandos de pago verificados localmente; release pendiente |
| Reproducibilidad y operación | 1 / 4 | Falta entorno E2E completo y verificación de proveedores |
| Orden del producto/documentación | 4 / 12 | qs del tooling corregido; faltan specs y decisiones de producto |

**Dónde estamos:** la limpieza inicial ya retiró 8 worktrees y 6 ramas;
quedan el checkout principal y el worktree activo. Después se encadenaron
correcciones de seguridad, permisos, Portal, CI y pruebas. Por eso esta sesión
ya no está sólo limpiando carpetas: está remediando hallazgos del proyecto.

**Último avance documental:** SDD-0309 queda cerrada como cobertura técnica
de Referidos: contrato ya integrado, siete criterios aprobados y tres
mutaciones causales rechazadas, con rollback y contenedor retirado.
No certifica RLS, acreditación real ni aplicación del crédito a facturación.
Las specs abiertas bajan de94 a93; se conserva **51/105 (48,6 %)** porque
la reconciliación completa sigue pendiente.
[Acta de cierre y límites](2026-09-02-codex-cierre-referidos.md).

**Correctivo local anterior:** SDD-0369 impide destinos E2E ajenos y mezcla de
configuración entre el fixture y Next, incluida la clave sólo-servidor.
La preparación es atómica; conserva deny-only no efímero y no inyecta claves
al Next remoto. RED23/13 → GREEN62/62, suite completa6.477/539, TypeScript,
ESLint, CLI con18 casos enumerados y rechazo temprano, revisión independiente
aprobados. No se ejecutó login real ni seed; el bootstrap sigue pendiente.
Mantiene **51/105 (48,6 %)**, sin aumentar casillas por un avance parcial.
[Contrato y evidencia local](../specs/0369-e2e-project-boundary/spec.md).

**Avance anterior:** SDD-0368/0424 cierra la incoherencia entre vínculo,
cliente y persona que podía exponer seis lecturas de Club de otro tenant.
Preserva acceso legítimo, membresías pausadas/canceladas, historia y permisos
internos. Pasan 374 aserciones, 27 derivas, 166 contratos SQL y rebuild de 421 migraciones;
revisión independiente aprobada. No aplicado ni publicado.
[Contrato y evidencia local](../specs/0368-portal-club-principal-tenant/spec.md).
Se añade una corrección local completada y su aplicación nominal pendiente:
el denominador pasa de 103 a 105. No es un retroceso ni una estimación de tiempo.

**Clasificación anterior:** los 204 avisos de seguridad alojados quedaron clasificados
en 19 dominios: 20 INFO y 184 WARN, correspondientes a 162 funciones, 20 tablas
y una extensión. Inventario íntegro y revisión independiente aprobados.
Esto cierra la casilla de clasificación, no la remediación: no se cambió ningún
permiso, policy, función ni dato alojado. [Triaje y evidencia por objeto](2026-09-02-codex-triaje-advisors.md).

**Correctivo anterior:** SDD-0367 corrige el webhook Kommo para omitir conexiones
disabled/desconocidas antes de Vault y mutaciones, sin romper la recuperación
error→active. Una desactivación en vuelo ya no se revierte al finalizar.
25 regresiones específicas, suite completa6.441/538, Deno4/4, TypeScript del
test, gates documentales/gobernanza y revisión independiente aprobados.
No cancela efectos previamente admitidos. Es avance parcial de la casilla
Kommo: mantuvo entonces el49/103, sin nuevo denominador. No publicado ni desplegado.
[Contrato, pruebas y revisión acotada de privacidad](../specs/0367-kommo-webhook-disabled-connection/spec.md).

**Avance anterior:** los dos avisos moderados de qs del tooling quedaron
corregidos con6.16.0:15 regresiones verdes, instalación limpia congelada y audit
nativo sin avisos. Cambio limitado a desarrollo, no publicado.
[Evidencia y límites](2026-09-02-codex-qs-tooling.md).

**Preflight posterior:** se refrescaron metadatos alojados sin leer datos de
negocio. La 0423 rechazaba el cuerpo 0195 de Cloud por comentarios/formato;
ahora acepta sus dos huellas exactas comprobadas. Pasan ambas variantes
(323 aserciones/18 derivas cada una), 165 contratos SQL y rebuild420.
No cambia la función instalada ni sus permisos. La revisión posterior completa
94 columnas/tipos en 16 relaciones, ACL y código/auth de las cuatro Edge.
Cierra una casilla existente de preflight, no el release ni el smoke alojado.
[Estado de release y límites](2026-09-02-codex-release-preflight.md).

**Correctivo funcional anterior:** SDD-0366/0423 corrige el rename de Shipping Mark cuando
existen reportes sobre facturas archivadas. Sincroniza sólo identidad, conserva
pagos/comprobantes/historial y agrega auditoría atómica. No habilita operaciones
financieras sobre archivos ni reabre la API restringida por 0422.

Validación de esta pieza: **164 contratos SQL**, reconstrucción de
**420 migraciones**, **323 aserciones, incluidas 18 derivas rechazadas**, y
revisión independiente aprobada. Advisors locales: 5 WARN en objetos heredados
del fixture (4 de rendimiento y 1 helper), ninguno en la función modificada.
La suite previa de consumidores pasó 6.401 pruebas/536 archivos, TypeScript,
build de 158 páginas y navegador sintético; no se presentan como ejecuciones nuevas.
Las cinco carreras anteriores corresponden a 0422. Sigue pendiente el E2E
con Auth/Storage real.

**SDD-0365 y 0366 siguen abiertas por publicación/release/smoke.** Con0423 se
pasó de46/101 a47/103 por una corrección local y un gate nominal pendiente.
El arreglo posterior de qs cierra una casilla existente: **48/103**, sin cambiar
el denominador ni sumar casillas por prueba. El cierre de revisión de metadatos
y código alojado llevó el punto anterior a **49/103**; clasificar los avisos
elevó el punto anterior a **50/103**. Club/0424 lleva el vigente a **51/105**.
SDD-0258 no está cerrado.

**Lo que impide decir “terminado”:** lote nuevo sin publicar, `main` sin
integrar, 26 migraciones del paquete sin aplicación autorizada y trabajo de
aplicación/seguridad/documentación todavía pendiente. El worktree activo no
se borra mientras conserve trabajo sin publicar/integrar.

### Evidencia Git y alojada

- Remoto: `https://github.com/hailuwaycom-sketch/DTDCARGO.git`.
- `origin/main`: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
- Última base publicada: `codex/saneamiento-integral` en
  `eabb230b257579d3b5527a8721eebc328d748f79`, 0 detrás / 59 delante de
  `origin/main`. Academia está en el commit local `f1cd9743`, sin publicar:
  auto-review rechazó el push y pidió autorización explícita del commit/destino.
  No se reintentó por otra herramienta ni se modificó ese commit.
  Reclamos está en el segundo commit local `9b243069`; SDD-0364 añade un
  tercero (`e9d49980`) para el aislamiento de reportes de pago. SDD-0365 etapa 1
  añade la contención de sus acciones/comprobantes como cuarto commit local.
  La expansión SQL 0421 de SDD-0365 añade el quinto commit local (`7f4c1046`).
  El transporte de comandos y recuperación de comprobantes añade el sexto
  (`85912909`); consumidores en el séptimo (`bcf111a8`) y la restricción0422
  en el octavo (`f649bdbc`). SDD-0366/0423 añade el noveno incremento local
  que contiene esta actualización.
  La recuperación documental posterior conserva el archive Cloud en un bundle
  local verificado; es un décimo incremento, distinto del lote funcional hasta
  `5797920a`. Ese rescate quedó en `cfe7a9c9` y no incrementó el47/103.
  La corrección de qs del tooling es un undécimo incremento local separado;
  una autorización limitada a cfe7a9c9 no lo incluye automáticamente.
  El lote nuevo requiere publicación autorizada y CI propio.
  El correctivo posterior del preflight0423 añade un duodécimo incremento,
  separado del SHA `2d7671ab`, y quedó en `f12ed8ae`. Este cierre de revisión
  añade únicamente documentación como decimotercer incremento; no hubo push
  ni integración. La autorización debe cubrir el SHA final exacto.
  La comprobación final del ignoreCommand corrige su interpretación en un
  decimocuarto incremento documental: el handoff anidado no está excluido;
  un push puede generar Preview. No se reintentó la publicación.
  El guard y regresiones de SDD-0367 añaden un decimoquinto incremento local
  sobre f761c278, sin publicar ni modificar el remoto/main. Necesita CI propio
  y una autorización que cubra el SHA final exacto; no hereda un GO anterior.
  Ese correctivo quedó en `a2456aa2`. El triaje de avisos añade un decimosexto
  incremento exclusivamente documental sobre ese SHA: no reintenta el push,
  no modifica `main` ni aplica cambios alojados. La autorización de publicación
  debe nombrar el SHA final y considerar que puede generar Preview.
  Ese punto quedó en `c6accbcd`. SDD-0368/0424 añade un decimoséptimo incremento
  local, con migración, contrato y evidencia documental; no se reintenta el push
  rechazado. Una autorización limitada a c6accbcd no incluye este incremento.
  Ese correctivo quedó en `00d972e2`. SDD-0369 añade el decimoctavo incremento
  local: guard/configuración E2E, reproducción y evidencia. No añade SQL ni
  reintenta push; la autorización debe cubrir el SHA final, no sólo 00d972e2.
  Ese punto quedó en `2f1242b7`. El cierre técnico de cobertura SDD-0309 añade
  un decimonoveno incremento sólo documental; no modifica SQL ni reintenta
  el push. Una autorización hasta2f1242b7 no incluye automáticamente esta acta.
- [PR #21 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/21):
  no integrable todavía por los gates de release. El CI completo del SHA
  `eabb230b` pasó en el run `33671435585`; también pasaron `726d2f85` en
  `33669760589`, `d4a63115` en
  `33667880574` y `a4f1ba5f` en `33664422658`: memoria y carrera de foco resueltas.
  El run anterior `33663666096` fue cancelado por concurrencia, no por un fallo.
- Vercel: deployment `6228639456` de GitHub en **Preview**, estado `success`,
  `production_environment=false`; no se promovió a producción.
- Supabase: proyecto correcto `xpfuzqombmjmxvprjgmi`, `ACTIVE_HEALTHY`; 406
  entradas de ledger. Metadatos refrescados antes de 23:34 UTC: unión de
  origin/main y checkout con 420 archivos, corte238, 25 pendientes (0399–0423),
  cero huérfanas posteriores al corte y 13 RPC nuevas ausentes. Se conserva
  la excepción0017 bajo el corte. 15 buckets privados y cuatro versiones Edge
  inventariadas. Hasta 23:48 UTC se revisaron también 94 columnas/tipos, ACL y
  código/auth Edge; no certifica credenciales ni flujos reales. No hubo escritura alojada.
  El incremento 0424 agrega un archivo local y un gate nominal: 421 archivos y
  26 pendientes (0399–0424). Se contrastaron sólo metadatos de su helper y
  policies contra Cloud; no se actualizó el ledger ni se consultaron miembros.
- Checkout principal: limpio en `22cec0c2`, 20 detrás / 0 delante.
- Worktrees: 2; principal + `codex-saneamiento-integral`.
- Tareas Codex de DTDCargo: sólo la tarea activa de este saneamiento.
- Specs reales: 361; 267 `done`, 1 `superseded` y 93 sin cierre documental
  (78 `in-progress`, 8 `proposed`, 4 `approved`, 3 `draft`). SDD-0309 cierra
  su cobertura técnica ya integrada, sin certificar operación real. SDD-0369 está
  verificada localmente, pendiente de publicación/CI y validación efímera real.
  El bootstrap no está completo. SDD-0368 está
  verificada localmente, pendiente de publicación/aplicación/smoke. SDD-0367 está
  verificada localmente, pendiente de publicación/Edge/smoke. SDD-0365 y0366
  siguen abiertas hasta verificar publicación, aplicación y smoke del release.

El paquete y sus commits están enumerados en
`.agents/handoffs/2026-09-02-saneamiento-integral-close.md`. La evidencia alojada
y los límites de la medición están en
[el acta de publicación](2026-09-02-codex-publicacion-y-preflight.md).
Se publicó la rama hasta `eabb230b` y se abrió el PR; Vercel produjo un preview.
Los cambios posteriores no están publicados ni tienen CI alojado propio.
No se hizo merge a `main`, promoción, migración ni escritura en Cloud.

## Lo ya saneado localmente

- [x] Rescate selectivo del trabajo válido y separación de cambios ajenos.
- [x] Revocación local de `TRUNCATE` público y del RPC público de verificación;
  migraciones 0399 y 0400 preparadas, contratadas y todavía no aplicadas.
- [x] Neutralización CSV, minimización de logs inbound, cookies de operario
  autenticadas y secretos CBM/Telegram fuera de query en código propio.
- [x] N+1 principales, reloj de render, accesibilidad, tabs, aislamiento E2E y
  compatibilidad de tooling saneados.
- [x] Nominatim y consultas externas inseguras de identidad retiradas.
- [x] Node 24/pnpm 11 fijados; advisories de Vite/dependencias atendidos.
- [x] Llave KMS del backup WORM retenida junto con el bucket en el IaC histórico.
- [x] `/studio/debug` exige configuración completa; Payload CMS legado retirado
  del contrato activo de entorno.
- [x] Escritura directa de facturas cerrada en la base: sólo `accounting` y
  `admin` activos del tenant conservan INSERT/UPDATE; `authenticated` ya no
  tiene DELETE físico. SDD-0350/migración 0407 están preparados localmente.
- [x] Administración de Mailing alineada con su RBAC: plantillas, firmas,
  reglas, configuración, blacklist y programados exigen admin activo también
  en RLS; las RPC internas quedaron reservadas a `service_role`. SDD-0351/0408
  están preparados localmente; `mail_logs` conserva lectura por compatibilidad.
- [x] Conciliación bancaria alineada con Contabilidad: extractos y movimientos
  exigen `accounting|admin` también en RLS y ya no exponen privilegios fuera del
  CRUD esperado. SDD-0352/migración 0409 están preparados localmente.
- [x] Lectura cruda de `mail_logs` retirada de Cobranzas: una RPC por facturas
  entrega sólo Shipping Mark, flags y fecha; emails/metadata no salen de la
  base. SDD-0358 separa el release: 0410 agrega la RPC compatible y 0415
  restringe el SELECT a admin después de desplegar y probar el consumidor.
- [x] Facturación anual de Fidelización/CRM minimizada: SDD-0354/migración 0411
  agrega en Postgres y entrega sólo Shipping Mark + USD trailing-12m a roles
  con acceso efectivo (incluidos overrides); la aplicación ya no recibe moneda,
  tasa, estado ni fechas de cada factura.
- [x] Saldo de Conversaciones minimizado por hilo: SDD-0355/migración 0412
  deriva cliente/tenant, respeta overrides y devuelve sólo saldo/moneda; excluye
  facturas anuladas y no convierte errores de lectura en un saldo cero.
- [x] Referencias de facturas en Órdenes de venta minimizadas: SDD-0356/0413
  entrega sólo id, código, monto y estado a la UI, respeta permisos efectivos,
  consulta por lotes y propaga errores en vez de inventar listas vacías.
- [x] SELECT interno de facturas alineado con `accounting|admin` en SDD-0357/0414.
  Portal exige vínculo activo, cliente vivo y tenant coincidente; el test
  reproduce y cierra el acceso cruzado con Shipping Mark igual en dos tenants.
  Las tres RPCs minimizadas siguen funcionando bajo la RLS restrictiva.
- [x] Gate canónico posterior a SDD-0357 sin fallos: 14/15 pasos medidos;
  `migrations-applied` quedó `SKIP` por falta deliberada de credenciales.
  Unitarios: 527 archivos / 5.957 pruebas. SQL: 155 contratos. Rebuild: 411
  migraciones (393 desde cero + 18 sólo-ledger), 219 tablas y 2 tenants de prueba.
  E2E: 150 pasaron y 18 Tier 3 omitidos, sin fallos ni bloqueo de teardown.
  Build: 158 páginas. Este resultado local no demuestra estado alojado.
- [x] Transición de Mailing separada en expansión y restricción (SDD-0358), sin
  fallback de la aplicación al SELECT crudo. Ambas fases reutilizan el mismo
  contrato SQL y conservan idéntica respuesta mínima de Cobranzas.
  Validación posterior: 3 unitarios focales, 156 contratos SQL y rebuild de
  412 migraciones (394 desde cero + 18 sólo-ledger); 219 tablas / 2 tenants.
- [x] Dominio Envíos Portal ligado a principal y tenant (SDD-0359/0416): envíos,
  documentos e hitos rechazan coincidencias de Shipping Mark entre tenants.
  Hijos exigen padre vivo y relación coherente; las policies de equipo y ACL
  se conservan. 157 contratos SQL, 37 unitarios focales y rebuild de 413
  migraciones (395 desde cero + 18 sólo-ledger) aprobados localmente.
- [x] Dominio Compras/Proveedores Portal ligado a principal y tenant
  (SDD-0361/0417): siete policies impiden lectura ajena y cambio de tenant desde
  otra cuenta con el mismo Shipping Mark. Documentos exige padre vivo coherente.
  158 contratos SQL, 156 unitarios focales y rebuild de 414 migraciones
  (396 desde cero + 18 sólo-ledger); equipo, ACL y Storage conservados.
- [x] Aprendizaje de Academia Portal ligado a principal y tenant (SDD-0362/0418):
  ocho policies cierran lecturas cruzadas, borrado ajeno e INSERT sin inscripción.
  Catálogo/lecciones exigen padres coherentes; diplomas y progreso propios
  conservan historia. Pasan 159 contratos SQL, 68 unitarios focales y rebuild
  de 415 migraciones (397 desde cero + 18 sólo-ledger); ACL/RPC/triggers y
  policies internas intactos. Cohortes/Club y el resto del Portal no se certifican.
- [x] Reclamos/evidencias Portal ligados a principal, tenant y padre
  (SDD-0363/0419). Dos policies corrigen la lectura cruzada y niegan evidencia
  incoherente, preservando snapshot sin FK y reclamo con embarque archivado.
  Pasan 160 contratos SQL, 47 unitarios focales y rebuild de 416 migraciones
  (398 desde cero + 18 sólo-ledger). ACL, equipo, soft-delete interno,
  funciones/triggers, bucket y Storage conservados. Cierre sólo local.
- [x] Frontera del principal en reportes de pago (SDD-0364/0420): tres policies
  niegan SELECT/INSERT/UPDATE y reasignación cruzados, preservando operaciones
  propias, historia de facturas archivadas y el trigger de coherencia existente.
  Pasan 161 contratos SQL, 19 unitarios y rebuild de 417 migraciones
  (399 desde cero + 18 sólo-ledger). Diez drifts rechazados y rollback true.
  Los fallos de comandos/confirmación/comprobantes siguen pendientes debajo;
  este resultado NO declara saneado todo el módulo de pagos.
- [x] Contención de aplicación en SDD-0365 etapa 1: conteos desconocidos no
  permiten alta; cancelación no comunica éxito sin una fila afectada; firma
  de comprobante exige contexto exacto; resultado incierto no borra evidencia
  ni invita a repetir ciegamente. 62 regresiones independientes verdes más
  dos controles adicionales de paths; no se cambió SQL ni producción.
- [x] Expansión SQL local 0421: alta/cancelación/resolución auditadas,
  recibo idempotente, permisos y motivo; 400 aserciones independientes,
  5 carreras reales y rebuild418 verdes. Advisors locales: sin hallazgos en
  objetos nuevos, una advertencia del helper touch_updated_at del fixture.
  162 contratos SQL y 6.096 unitarios completos aprobados en ese incremento.
  No está aplicada. Consumidores y restricción0422 preparados localmente;
  publicación, aplicación alojada y smoke siguen abiertos.

- [x] Correctivo histórico SDD-0366/0423: rename de Shipping Mark conserva
  reportes en cinco estados sobre facturas archivadas, sin modificar pagos
  ni comprobantes y con evento mínimo/atómico. RED23514 → GREEN: 323 aserciones
  (18 derivas), 164 contratos SQL y rebuild de 420; revisión independiente aprobada.
  No aplicado. El resto de SDD-0258 y su interfaz siguen sin cierre integral.

- [x] Club Portal ligado a vínculo, cliente y persona del mismo tenant
  (SDD-0368/0424). Cierra dos cruces en seis lecturas sin cambiar policies,
  permisos ni historia propia. 374 aserciones, 27 derivas, 166 contratos SQL,
  rebuild de 421 migraciones y revisión independiente aprobados; 37 unitarios Club conservados;
  advisors locales con dos WARN heredados, ninguno en el helper corregido.
  Sólo local: no publicado ni aplicado. No certifica todo Cohortes/Club.

## P0 · terminar el saneamiento Git y publicar

- [x] Publicar el lote hasta `eabb230b` en `codex/saneamiento-integral` tras verificar
  remoto privado, permiso ADMIN, alcance de archivos y ausencia de patrones de
  credenciales en las líneas añadidas. La revisión de autorización permitió el
  push exacto de aquel lote. No autoriza el nuevo push que fue rechazado.
- [x] Verificar hash remoto, upstream correcto, 0/0 y diff de los 53 commits.
- [x] Abrir el PR #21 en borrador, sin merge ni promoción de producción.
- [x] Corregir el OOM del primer CI mediante límite explícito de heap sólo en
  TypeScript/build: regresión 6/6, TypeScript sin caché (~2,8 GiB) y build de 158
  páginas aprobados localmente; TypeScript/Edge confirmados en el segundo CI.
  No se quitó ningún gate.
- [x] Reproducir y corregir la carrera de foco del selector de destino expuesta
  por el segundo CI (SDD-0360): 13/13 focales, suite completa 5.961/5.961 y
  navegador local aprobados. Sin modificar estilos, precios ni catálogo.
- [x] Build aislado de SDD-0360: 158 páginas, postbuild y restauración de
  `tsconfig.json` aprobados, sin secretos ni cambios SQL.
- [x] Publicar SDD-0360 en `46afa953`, verificar remoto exacto, árbol limpio y
  upstream 0/0; `origin/main` permanece sin cambios.
- [x] Confirmar el primer resultado completamente verde de `Calidad continua`:
  `a4f1ba5f`, run `33664422658`, todos los pasos aprobados. Dos fallos previos
  corregidos; el tercer run fue cancelado al publicar el cierre documental.
- [x] Confirmar CI completo de SDD-0361: `d4a63115`, run `33667880574`,
  success, incluido build; terminó a las 18:47:15 UTC del 2026-09-02.
- [x] Confirmar CI completo del lote de acceso: `726d2f85`, run `33669760589`,
  success, incluido build; terminó a las 19:05:39 UTC del 2026-09-02.
- [x] Confirmar CI del cierre de exportaciones: `eabb230b`, run `33671435585`,
  success con build y árbol reproducible; terminó a las 19:22:45 UTC del
  2026-09-02 (14 min 54 s). No sustituye el CI del siguiente commit.
- [ ] Obtener aprobación explícita para publicar los commits locales posteriores
  a `eabb230b` en `origin/codex/saneamiento-integral`; no reintentar mientras falte.
- [ ] Confirmar CI de los aislamientos de Academia, Reclamos y Pagos en el SHA publicado.
- [ ] Autorizar por separado la integración a `main`; no confundir push de rama
  con merge o deploy.
- [ ] Antes de integrar, resolver compatibilidad de aplicación y migraciones:
  el merge puede disparar Vercel. No publicar una app que llama RPCs ausentes.
- [ ] Verificar el efecto real de `ignoreCommand` antes del release: los
  commits exclusivamente documentales no justifican forzar un build. Al
  integrar código, confirmar que el commit final no oculte cambios funcionales
  anteriores y que Vercel publique el SHA esperado.
- [ ] Después de integrar, comprobar que el HEAD del worktree es ancestro de
  `origin/main`; sólo entonces retirar el worktree.
- [ ] Actualizar el checkout principal limpio desde el remoto sin reset ni
  sobreescritura.
- [ ] Borrar `codex/archive-primary-pnpm-20260902` sólo después de demostrar que
  su intención está contenida en `origin/main`.
- [ ] Mantener `codex/archive-cloud-handoff-20260828`: conserva un handoff único
  no integrado. Su historia ya quedó recuperable en un bundle local verificado,
  con hashes idénticos; falta publicar/integrar esa evidencia y resolver la
  contención antes de borrar la rama. No se restauran instrucciones obsoletas.
  [Acta de recuperación y límites](2026-09-02-codex-archivo-y-recuperacion.md).
- [x] Retirar el upstream `origin/main` de esa rama archive para evitar una
  publicación accidental desde ella; HEAD `d05b6355` y contenido conservados.

## P0 · gates alojados independientes

- [ ] Aplicar `0399_revoke_truncate_anon_authenticated.sql` con autorización
  específica, de una en una y siguiendo
  `docs/runbooks/aplicar-migraciones-prod.md`.
- [ ] Aplicar `0400_revoke_public_verify_rpc_execute.sql` con otra autorización
  específica y el mismo runbook.
- [ ] Aplicar `0401_portal_brand_por_principal.sql` con autorización específica
  separada; la RPC no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0402_portal_hidden_statuses_por_principal.sql` con autorización
  específica separada; la RPC no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0403_portal_advisor_por_principal.sql` con autorización específica
  separada; la RPC no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0404_portal_referidos_por_principal.sql` con autorización específica
  separada; la RPC no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0405_portal_perfil_privado_por_principal.sql` con autorización
  específica separada; la RPC no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0406_portal_packing_lists_por_principal.sql` con autorización
  específica separada; la RPC no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0407_invoices_write_rbac.sql` con autorización específica
  separada; el RBAC de escritura no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0408_mailing_admin_rbac.sql` con autorización específica
  separada; el RBAC admin-only no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0409_bank_reconciliation_rbac.sql` con autorización específica
  separada; el RBAC financiero no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0410_collections_mail_context.sql` con autorización específica
  separada; sólo agrega el facade y conserva temporalmente el SELECT histórico.
- [ ] Aplicar `0411_client_annual_billing_facade.sql` con autorización específica
  separada; el agregado minimizado no existe en Cloud todavía.
- [ ] Aplicar `0412_conversation_outstanding_facade.sql` con autorización
  específica separada; el contexto mínimo no existe en Cloud todavía.
- [ ] Aplicar `0413_sales_order_invoice_facade.sql` con autorización específica
  separada; las referencias mínimas no existen en Cloud todavía.
- [ ] Aplicar `0414_invoices_read_rbac.sql` con autorización específica separada
  sólo DESPUÉS de confirmar 0411–0413 aplicadas y la app con facades desplegada.
  El preflight SQL no puede certificar la versión real del frontend.
- [ ] Aplicar `0415_mail_logs_read_rbac.sql` con autorización específica separada
  sólo DESPUÉS de confirmar 0410 aplicada y el consumidor nuevo de Cobranzas
  desplegado y probado. Esta segunda fase completa el cierre admin-only de
  `mail_logs`; el catálogo SQL no certifica la versión de la aplicación.
- [ ] Aplicar `0416_portal_shipments_tenant_boundary.sql` con autorización
  específica separada y smoke de envíos/documentos/hitos. No exige una RPC
  nueva ni deploy previo; la frontera sólo está corregida localmente.
- [ ] Aplicar `0417_portal_prealertas_tenant_boundary.sql` con autorización
  específica separada y smoke de compras/proveedores/documentos. Sin RPC nueva
  ni deploy previo; no se ha aplicado a Cloud.
- [ ] Aplicar `0418_portal_academia_tenant_boundary.sql` con autorización
  específica separada y smoke de catálogo, cursos, progreso y diplomas propios.
  Sin RPC nueva ni deploy previo; no se ha aplicado a Cloud.
- [ ] Aplicar `0419_portal_reclamos_tenant_boundary.sql` con autorización
  específica separada y smoke de reclamos/historial/evidencias propias.
  Sin RPC nueva ni deploy previo; no se ha aplicado a Cloud.
- [ ] Aplicar `0420_portal_payment_reports_tenant_boundary.sql` con autorización
  específica separada y smoke de identidad/historial/operaciones propias de
  reportes de pago. Sin RPC nueva ni deploy previo. No se ha aplicado a Cloud
  y no sustituye la reparación pendiente de cancelación y confirmación.
- [ ] Aplicar `0421_payment_report_commands.sql` sólo con autorización nominal,
  como expansión previa a sus consumidores. Después: aplicación/smoke y0422;
  no activar el release como un lote ciego.
- [ ] Aplicar `0422_payment_report_command_boundary.sql` sólo con otro GO
  nominal, después de consumidores/smoke de0421; verificar rechazo de DML/RPC
  antiguos y conservación de alta/cancelación/resolución/historial/reintento.
  No revertir la app a consumidores antiguos ni reabrir grants automáticamente.
- [ ] Aplicar `0423_payment_report_historical_identity.sql` sólo con GO nominal
  después de0421, consumidores y0422 verificados. Smoke de rename autorizado,
  conservación de expediente y rechazo de escrituras financieras sobre archivo.
- [ ] Aplicar `0424_portal_club_principal_tenant.sql` sólo con GO nominal,
  preflight fresco y transacción. Smoke autorizado de las seis lecturas Club,
  identidad coherente e historia propia; sin nueva RPC ni deploy previo.
  No está aplicada y no requiere leer miembros reales en este saneamiento.
- [ ] Reconfigurar el webhook Telegram alojado para usar el header secreto,
  desactivar la compatibilidad query y verificar `getWebhookInfo`.
- [x] Confirmar que el deployment automático de la rama fue Preview, no
  producción. Su estado `success` no sustituye un smoke funcional.
- [ ] Confirmar deployment de producción y smoke de público, Studio, Portal y
  móvil después de los gates de migración/integración.
- [x] Medir ledger y las 13 RPC nuevas mediante metadatos, sin leer PII ni filas
  de negocio; todas siguen ausentes. Preflight 0399: TRUNCATE en 179 tablas para
  `anon` y 204 para `authenticated`, sobre 249 tablas de `public`.
- [x] Completar preflights de grants/policies por migración, buckets y versión
  real de las cuatro Edge Functions, sin leer datos de negocio.
  Inventarios 0416–0420, precondiciones 0421–0423, 94 columnas/tipos en 16 relaciones,
  ACL, 15 buckets y código/auth de cuatro Edge contrastados. Dependencias
  explícitas: 0399→0410 y 0407→0411. Se mantiene la repetición de gates al aplicar,
  con cada GO nominal; no se marcaron smokes o despliegues como completados.
  [Acta de preflight](2026-09-02-codex-release-preflight.md).
- [x] Clasificar los avisos alojados por dominio: 20 INFO y 184 WARN en 19
  dominios; no son 204 vulnerabilidades confirmadas. Se cruzaron 162 funciones,
  20 tablas y una extensión con metadatos y 341 referencias locales; snapshot
  íntegro y revisión independiente aprobados. No abrir policies ni revocar RPCs
  legítimas sólo para reducir el contador. No se hizo remediación alojada.
  [Clasificación, próximos gates y límites](2026-09-02-codex-triaje-advisors.md).

## P1 · seguridad por slices

- [x] Cerrar localmente los comandos de reportes de pago mediante SDD-0365:
  expansión0421, consumidores y restricción0422 verificados. Se reprodujeron
  escrituras sin auditoría y confirmación sin motivo antes de retirar esas
  vías. Los comandos legítimos conservan alta/cancelación/resolución, recibo,
  auditoría, reintentos y fórmula contable; historial y comprobantes intactos.
  Pasan301 aserciones,35 derivas,163 contratos SQL, rebuild419 y5 carreras.
  No equivale a corregido en producción ni certifica todo Storage.
- [x] SDD-0365 etapa 1: contador fail-closed probado desde la acción real.
  null, error, transporte y conteos inválidos no producen upload/insert/aviso.
  El límite concurrente todavía requiere el comando transaccional de etapa 2.
- [ ] Completar el release de SDD-0365. Las tres etapas técnicas están
  verificadas localmente; faltan publicación, gates alojados y smoke real
  en el orden expansión0421 → consumidores → restricción0422.
  Los uploads inciertos se conservan privados: revisar su disposición con
  identidad/vínculo/hold y autorización; no hay job ni purga automática.
- [ ] Continuar RBAC de aplicación en la base por slices: lectura minimizada de
  facturas/dinero y autorización documental por entidad. Cada slice
  necesita SDD, contrato SQL, migración propia y gate Cloud separado; no hacer
  un sweep. SDD-0350 ya cerró la escritura directa de `invoices`, preservando
  temporalmente el SELECT tenant-wide que consumen módulos no financieros.
  SDD-0351 cerró las seis tablas administrativas de Mailing; SDD-0353 sustituyó
  la lectura de Cobranzas y SDD-0358 separó su expansión 0410 del cierre
  admin-only 0415 posterior al deploy. SDD-0352 cerró el CRUD
  directo de conciliación bancaria. SDD-0354 retiró las filas financieras del
  agregado anual usado por Fidelización, CRM y Reportes; SDD-0355 minimizó el
  saldo de Conversaciones y SDD-0356 retiró la lectura directa de Órdenes de
  venta. SDD-0357 cerró el SELECT interno y ligó Portal al tenant después de
  comprobar los consumidores financieros, Portal y procesos controlados de
  servicio. El inventario AST congela 18 archivos / 45 llamadas directas.
- [ ] Auditar por dominio las otras policies Portal que comparan Shipping Mark
  sin tenant. SDD-0357 cubre `invoices` y SDD-0359 cubre `shipments`,
  `shipment_documents` y `shipment_events`. SDD-0361 cubre `suppliers_cn`,
  `prealertas` y `prealerta_documents`. SDD-0362 cubre cursos, módulos, lecciones,
  inscripciones, diplomas y progreso de Academia. SDD-0363 cubre reclamos y
  evidencias. SDD-0364 cubre la identidad/tenant de reportes de pago, no sus
  comandos ni integridad financiera. SDD-0368 cierra la cadena de identidad
  que alimenta seis policies Club, incluidos eventos de contexto club; no
  certifica todo su RBAC/integridad ni cohortes fuera de ese contexto.
  Faltan las demás entidades y permisos fuera de los contratos enumerados.
  No hacer un sweep ni declarar corregido todo el
  Portal por estos slices. Secuencias, transiciones y relación proveedor/cliente
  son hipótesis separadas que necesitan reproducción, no fallos ya confirmados.
- [x] Retirar `service_role` de todos los RSC del Portal.
  SDD-0336 cerró el primer slice de marca: el baseline bajó de 11 rutas / 23
  construcciones a 10 rutas / 21 construcciones. SDD-0337 movió la visibilidad
  de hitos a una RPC por principal y lo bajó a 10 rutas / 19 construcciones.
  SDD-0338 movió el asesor asignado a otra RPC por principal y dejó el baseline
  en 10 rutas / 18 construcciones. SDD-0339 eliminó la elevación de Referidos y
  dejó el baseline en 9 rutas / 17 construcciones. SDD-0340 encapsuló las URLs
  firmadas de adjuntos detrás de una lectura RLS y dejó el baseline en 8 rutas /
  16 construcciones. Priorizar el facade de aceptación de facturas y las demás
  lecturas internas mediante RPCs autocontenidas ligadas a `auth.uid()`. SDD-0341
  consolidó códigos históricos y fotos privadas de Perfil y dejó el baseline en
  7 rutas / 14 construcciones. SDD-0342 movió los packing lists a una RPC por
  principal y encapsuló la firma de documentos después de una lectura RLS; dejó
  el baseline en 6 rutas / 12 construcciones. SDD-0343 retiró del RSC de detalle
  de compra sus dos elevaciones y las encapsuló detrás de una revalidación
  sesión/RLS; dejó el baseline en 5 rutas / 10 construcciones. SDD-0344 movió
  evidencia y conversación de Soporte a un contexto sin parámetros que revalida
  la sesión; dejó el baseline en 4 rutas / 9 construcciones. SDD-0345 encapsuló
  firma, avisos, naviera y aceptación del detalle de envío detrás de su lectura
  RLS; dejó el baseline en 3 rutas / 7 construcciones. SDD-0346 movió packing
  online, consolidaciones y próximo zarpe del listado de envíos a un contexto
  que deriva todos sus ids desde sesión/RLS; dejó el baseline en 2 rutas / 4
  construcciones. SDD-0347 encapsuló facturas pendientes, naviera y zarpe del
  home detrás de identidad e ids de sesión; dejó el baseline en 1 ruta / 1
  construcción. SDD-0348 encapsuló la lectura legal de aceptación, sin cambiar
  su acción, hash o evidencia; el baseline final quedó en 0 rutas / 0
  construcciones. El test
  `portal-service-role-boundary.test.mjs` congela el inventario; no lo aprueba.
- [ ] Definir con operación la retención de colas y borradores browser que
  contienen fotos, firma, documento, GPS, Shipping Mark o tokens. TTL/purga de
  logout sin esa decisión puede perder entregas pendientes.
- [ ] Rediseñar la autenticación del webhook Kommo. La documentación oficial de
  [webhooks de eventos](https://developers.kommo.com/docs/webhooks-general)
  sólo permite configurar URL + eventos y no documenta firma/cabecera; por eso
  no se puede reemplazar localmente `?secret=` por un header sin romper el
  proveedor. Evaluar gateway que inyecte credencial, rotación y redacción de
  access logs. En el código alojado v14, `conn.status` se lee pero no impide
  procesar disabled. SDD-0367 ya lo corrige LOCALMENTE con25 regresiones,
  conservando error→active y protegiendo una desactivación concurrente.
  Falta publicar y autorizar el deploy nominal de kommo-webhook; la comparación
  de fuentes v14 del preflight anterior no incluye este delta. No se consultaron
  conexiones reales para afirmar impacto. La autenticación sigue pendiente.
- [ ] Diseñar CSP con nonce para la app y aislar la excepción del visor Marca.
  No retirar `'unsafe-inline'`/`'unsafe-eval'` sin browser/build: Next y los
  documentos navegables pueden romperse.

## P1 · reproducibilidad y operación

- [x] Preparar CI independiente para lint, frontera RSC, TypeScript, Edge
  Functions, unitarios, docs, numeración, constantes, componentes, gobernanza
  y build sin secretos. SDD-0349 fija actions por SHA, usa permisos de lectura y
  lockfile congelado. El PR #21 activó la primera corrida alojada, que falló por
  heap agotado en TypeScript; el segundo run confirmó el ajuste de memoria y
  expuso la carrera corregida en SDD-0360. El run completo `33664422658`
  quedó verde en `a4f1ba5f`; cada commit posterior conserva su propio gate CI.
  Docker/E2E/Cloud necesitan
  una estrategia explícita de costo y credenciales antes de activarse en GitHub.
- [ ] Crear bootstrap no productivo reproducible para Auth/Portal/E2E; hoy un
  clon limpio no puede ejecutar el sistema completo sólo con el repo.
  SDD-0369 cierra localmente el guard de destino y la coherencia de variables
  del arnés; la selección CLI de18 casos no es una ejecución autenticada.
  La política vigente conserva branches efímeros alojados, no un stack local
  completo. Faltan ampliación de fixtures/journeys y wiring autorizado.
- [ ] Verificar en los proveedores, sin asumir por código: Kommo live/dry-run,
  Resend, SeaRates, Telegram, VAPID, monitor externo y adjuntos/restore.
- [ ] Si AWS vuelve a usarse, confirmar cuenta/región, Object Lock, suscripción
  SNS y restore; el template local no prueba estado alojado.

## P2 · ordenar el producto sin falsos cierres

- [x] Resolver localmente los dos avisos moderados de `qs@6.15.3` en desarrollo
  (`agentation-mcp` → SDK MCP → Express/body-parser) con override6.16.0.
  RED6/GREEN9 → GREEN15; repetido15/15 en instalación limpia congelada sin
  scripts. Firma/integridad verificadas; audit nativo0 avisos. Sólo cambia qs
  en el lockfile, sin nuevas versiones de otras dependencias. No se demuestra
  explotación de un servidor real ni se modifica producción. Publicación
  pendiente. [Acta](2026-09-02-codex-qs-tooling.md).
- [x] Cerrar documentalmente SDD-0280, SDD-0303 y SDD-0304 tras verificar sus
  commits en `origin/main`, código vigente y gates. No se borró código adicional;
  [acta del lote](2026-09-02-codex-cierre-documental.md).
- [x] Cerrar técnicamente SDD-0289 (CSV operativos), ya integrada en main:
  endpoint real con 2.501 filas, páginas recortadas, errores y rechazos de
  acceso; 42 pruebas focales, 29 contratos adicionales y 6.032 pruebas completas
  en 530 archivos. TypeScript, ESLint y gates documentales aprobados.
  [Acta del cierre](2026-09-02-codex-cierre-exportaciones.md).
- [ ] Reconciliar las 93 specs no cerradas por rebanadas de dominio. Cambiar un
  front-matter sólo con evidencia en `main` y estado alojado cuando aplique.
  SDD-0309 ya cerró su alcance de cobertura con siete criterios y tres
  mutaciones causales; operación real/RLS/SDD-0137 quedan fuera. No añade
  una casilla nueva: reduce el inventario pendiente dentro de esta tarea.
  El bloqueo23514 de rename con factura archivada quedó corregido localmente
  por SDD-0366/0423, no publicado/aplicado. No basta para cerrar SDD-0258;
  conservar como deuda su validación integral, incluida la interfaz legacy.
- [x] Reconciliar el dominio de acceso (SDD-0299/0302): código confirmado en
  main y 61 pruebas focales, con 52 regresiones nuevas. Ambas siguen abiertas
  porque falta navegador/sesión real. Suite completa: 529 archivos / 6.013
  pruebas; TypeScript, ESLint y gates documentales aprobados.
  [Evidencia y checklist específico](2026-09-02-codex-reconciliacion-acceso.md).
- [ ] Completar el rechazo visible del drawer (0299) y la navegación con
  access token vencido/refresh válido (0302) en un entorno autorizado.
- [ ] Confirmar la recepción del aviso real de SeaRates (0291); no confundir
  contrato local con entrega de correo/Telegram ni forzar un envío sin OK.
- [ ] Crear logger/redacción/correlación central y aumentar cobertura directa de
  crons y Edge Functions.
- [ ] Medir Core Web Vitals y fijar budgets de CSS/fuentes por superficie.
- [ ] Resolver la deriva Brand Book/generador usando únicamente un Norte nuevo;
  no republicar desde copias locales incompletas.
- [ ] Decidir si HailuWay sigue como integración health-only y si SeaRates se
  conserva, reemplaza o termina; no podar endpoints sólo por un snapshot viejo.
- [ ] Retirar variables muertas del entorno alojado después de comprobar sus
  consumidores allí; el repo ya no declara Payload legado.

## Orden de trabajo recomendado

1. Resolver el bloqueo de push de los commits locales y después confirmar su CI
   en el PR #21; el CI verde actual corresponde sólo a `eabb230b`.
2. Ejecutar, sólo con los GO correspondientes, la secuencia documentada en
   el acta de release; repetir preflight por migración. SDD-0358 ya separó
   expansión y restricción de Mailing; todavía no se ejecutó el release.
3. Con autorizaciones individuales, dejar disponibles las RPCs necesarias
   antes de publicar sus consumidores; comprobar cada migración 0399–0413 sin
   asumir que el orden numérico sustituye una prueba de compatibilidad.
4. Autorizar integración y deploy de la app; verificar los cuatro flujos de
   lectura mínima y Portal. Aplicar 0414 y 0415 sólo después del smoke de sus
   consumidores, cada una con su propio OK y de una en una.
   Aplicar 0416–0420 con gates/smokes de dominio independientes, de una en una
   y con su propio OK. Para pagos:0421 antes de consumidores/smoke,0422 después,
   con autorizaciones independientes;0423 después de esas fases y con smoke
   nominal de historial. 0424 conserva gate independiente para Club, sin nueva
   RPC o versión de aplicación. Completar Telegram
   y los demás gates alojados por separado.
5. Limpiar worktree y rama de archivo sólo cuando estén contenidos en main.
6. Con pagos preparado localmente, continuar sólo la siguiente rebanada
   elegible del checklist: aislamiento Portal restante/documentos por entidad,
   reconciliación de specs y deuda P2; no reabrir un barrido transversal.

## Stop conditions

- Los pushes de seguimiento quedan limitados a la rama propia y al alcance
  saneado; no incluyen `main`, force-push ni ramas ajenas. El rechazo vigente
  exige una nueva autorización explícita; no se rodea mediante otro mecanismo.
- No hay merge, deploy, migración, secreto o escritura de datos implícitos.
- Un `SKIP` documenta una parte no medida; no se presenta como verde.
- No se elimina worktree o rama mientras exista cambio no contenido o tarea
  activa apuntando a ese checkout.
