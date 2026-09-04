---
title: "Arranque Codex: estado saneado y checklist ejecutable"
tipo: auditoria-operativa
autor: Codex
created: 2026-09-02
updated: 2026-09-04
review-by: 2026-09-09
confidencialidad: interno
---

# Arranque Codex · estado saneado y checklist ejecutable

Este documento es el punto de entrada operativo después del traspaso desde
Cloud. No reemplaza specs ni runbooks: ordena qué sigue, quién puede hacerlo y
qué autorización exige. El resumen vigente se revalidó el 2026-09-04 después de
0400, la revisión del modo continuo y la cola local hasta SDD-0413. Los puntos
anteriores conservan su contexto histórico; antes
de cualquier otra operación Git o alojada se deben refrescar sus precondiciones.

## Snapshot comprobado

### Resumen para Sam · punto de control vigente del objetivo

**Punto vigente posterior · SDD0377–0380:** borrado lógico Portal implementado:
63 aserciones SQL, ocho carreras,27 casos de action/UI y navegador sintético.
Timeouts E2E cerrados localmente:150 aprobados/18 omitidos, ningún error global
ni flaky,211s. El gate ya rechaza errores globales y reportes incompletos.
fflate0.4.9 conservado localmente en ef6101c4;10 pruebas de codec y dos de
privacidad. Audit de dependencias no disponible por timeout, no certificado limpio.

Cotizaciones Portal0380/0428: cruce entre tenants reproducido y corregido,
63 aserciones SQL y31 casos de aplicación. Conjunto final:7.149/7.149 en553
archivos,421,24s, sin reintento;170 contratos SQL y rebuild425 aprobados.
El gate general anterior a0380 midió16/17 pasos (Cloud SKIP) y build158.
No hay prueba autenticada contra producción ni cierre de todas las políticas.
[Portal](2026-09-03-portal-address-delete-local.md),
[verificación](2026-09-03-verification-lifecycle-local.md) y
[cotizaciones](2026-09-03-portal-quotes-local.md).

| Cola local actual | Estado |
|---|---|
| Reserva atómica del verificador,0375 | Implementada y probada localmente |
| Borrado lógico Portal,0377 | Implementado; SQL, carreras, navegador sintético y suite unitaria aprobados |
| Timeouts y veracidad del gate,0378 | Cerrado localmente; E2E150/18 sin errores globales y suite7149/7149 |
| fflate/replay,0379 | Parche compatible y controles aprobados; commit ef6101c4 local |
| Cotizaciones Portal,0380 | Aislamiento de lectura SQL y aplicación corregido;0428 no aplicada |
| Solicitudes de servicios de recepción, 0381 | Cerrado localmente: cruce y reasignación bloqueados; 0429 preparada, 35 focales, 171 SQL y suite 7.173/7.173 |
| Perfil y solicitudes de cambio, 0382 | Cerrado localmente: 0430, 70 focales, 172 SQL, rebuild 427 y suite 7.181/7.181 |
| Frontera service_role Portal, 0383 | Cerrado localmente: 105 componentes cubiertos, guard/fachada 10/10 y suite 7.187/7.187 |
| Acciones de Perfil Portal, 0384 | Cerrado localmente: RED causal 9/12; GREEN 13/13, Perfil 53/53 y suite 7.200/7.200 |
| Mensajes Portal, 0385 | Cerrado localmente: RED causal; 22 aserciones, 173 SQL y rebuild 428; 0431 no aplicada |
| Web Push Portal, 0386 | Cerrado localmente: RED 7/9; GREEN 186/186 y Portal 867/867; sin envío real ni SQL |
| Academia Portal aplicación, 0387 | Cerrado localmente: RED 7/7; GREEN 7/7 y Portal 874/874; 0418 sigue sin aplicar |
| Proveedores Portal aplicación, 0388 | Cerrado localmente: RED 5/5; GREEN 5/5 y Portal actual 870/870; 0417 sigue sin aplicar |
| Compras Portal aplicación, 0389 | Cerrado localmente: RED 6/6; focal/histórico 15/15 y Portal+Prealertas 1.025/1.025; 0417 sin aplicar |
| Pagos y eventos Portal, 0390 | Cerrado localmente: RED 4/4; focal/histórico 38/38 y Portal 878/878; sin datos reales |
| Lecturas núcleo Portal, 0391 | Cerrado localmente: RED 5/5; focal/histórico 24/24 y Portal 883/883; sin datos reales |
| Activación y completitud Portal, 0392 | Cerrado localmente: RED 3/3; focal/histórico 18/18 y Portal 886/886; 0427 intacta |
| Reclamos Portal, 0393 | Cerrado localmente: RED 2/2; GREEN 2/2 y Portal 888/888; sin datos reales |
| Direcciones Portal aplicación, 0394 | Cerrado localmente: RED 8/8; focal/histórico 23/23 y Portal+helper 896/896; 0427 intacta |
| Cotizaciones Portal aplicación, 0395 | Cerrado localmente: RED 3/3; focal/histórico 18/18 y Portal 895/895; sin avisos reales |
| Referidos y reclamos elevados, 0396 | Cerrado localmente: RED 4/4; GREEN 4/4 y Portal 899/899; sin correos, adjuntos ni datos reales |
| Facturas Portal acciones, 0397 | Cerrado localmente: RED 5/5; focal/histórico 61/61 y Portal 903/903; sin efectos reales |
| Contextos privados Portal, 0398 | Cerrado localmente: RED 12/12; focal/histórico 51/51 y Portal+Prealertas 1.068/1.068; sin lecturas reales |
| Consumidores de compras Portal, 0399 | Cerrado localmente: RED 12/12; focal/histórico 47/47 y Portal 928/928; tenant + Shipping Mark preservados; sin lecturas reales |
| Cajas Portal RBAC, 0400/0432 | Cerrado localmente: cruce por vínculo incoherente reproducido y bloqueado; 174 SQL, rebuild 429 y policy de equipo preservada; 0432 sin aplicar |
| Realtime de conversaciones Portal, 0401/0433 | Cerrado localmente: RED causal; 175 SQL, rebuild 430 y helper booleano ligado a principal+tenant; 0433 sin aplicar |
| Catálogo de servicios Portal, 0402/0434 | Cerrado localmente: 3 RED de aplicación + RED SQL; 1.086 Portal/Prealertas, suite 7.292/7.292, 176 SQL y rebuild 431; 0434 sin aplicar |
| Documentos de factura RBAC, 0403/0435 | Primer slice documental cerrado localmente: filas, bucket, reservas, restauración y RPC privilegiadas; 177 SQL y rebuild 432; 0435 sin aplicar |
| Documentos de Tesorería RBAC, 0404/0436 | CxP y órdenes de pago heredan accounting/admin en el control central; 178 SQL y rebuild 433; 0436 sin aplicar |
| Documentos de asientos RBAC, 0405/0437 | `journal_entry` completa los tipos estrictamente contables; 179 SQL y rebuild 434; 0437 sin aplicar |
| Documentos de gastos RBAC, 0406/0438 | Hub + reautorizar/finalizar + control tenant-aware de vista/edición y overrides; 7.296 unitarias, 180 SQL y rebuild 435; 0438 sin aplicar |
| Documentos de envíos RBAC, 0407/0439 | Server Actions + Hub + tabla legacy + bucket heredan Tracking; policy Portal preservada; 181 SQL y rebuild 436; 0439 sin aplicar |
| Documentos de clientes RBAC, 0408/0440 | `client` hereda defaults y overrides del módulo Clientes; 182 SQL y rebuild 437; 0440 sin aplicar |
| Documentos de proveedores RBAC, 0409/0441 | `supplier` hereda defaults y overrides de Proveedores; mapa interno no expuesto a roles API; 183 SQL y rebuild 438; 0441 sin aplicar |
| Documentos de Naviera RBAC, 0410/0442 | `consolidation` y `booking` heredan defaults y overrides de Naviera; 184 SQL y rebuild 439; 0442 sin aplicar |
| Adjuntos de Bitácora RBAC, 0411/0443 | `bitacora_task` + bucket propio heredan Bitácora; Soporte queda read-only también ante acceso directo; 185 SQL y rebuild 440; 0443 sin aplicar |
| Documentos sin transacción, 0412/0444 | `none` hereda Documentos, versionado gana su guard y tipos inventados fallan cerrados; 13 focales, 186 SQL y rebuild 441; 0444 sin aplicar |
| CSP privada con nonce, 0413 | Cerrada localmente: RED de navegador detectó el script de tema sin nonce; GREEN 35/35, build 158 y Studio/Portal sin errores CSP; Marca y SSG público aislados |
| Reconciliación de specs | Inventario corregido: 105 abiertas; SDD-0264, 0276 y 0287 cerradas con `origin/main`, pruebas y navegador/PDF real; quedan 102 |
| Logs y web | Logger central + 17/17 crons + 4/4 Edge Functions; queda residuo interno legacy y medición web |

La cifra original avanza a 59/106 (55,7 %): además de la auditoría Portal y el
RBAC por slices, la aplicación privada reemplaza scripts inline por nonce sin
volver dinámico el sitio público ni ampliar Marca. No se crearon subpasos por
superficie. Las migraciones preparadas sin aplicar siguen siendo 44
(0401–0444), derivadas
del último ledger 0400; no se hizo nueva consulta Cloud en esta continuación.
Todos los recibos y cambios posteriores a 70812835 permanecen sólo locales.
Las secciones inferiores conservan sus fechas/alcance históricos.

**Continuación vigente · 2026-09-03:** reserva atómica conservada localmente
en `47b1dd0b` (SDD-0375/0426), no aplicada. Pasaron 25 unitarios focales,
63 aserciones SQL, carreras reales, 168 contratos y rebuild423. El gate
general detectó timeouts del arnés de worktrees. SDD-0376 reduce sus consultas
Git de 72 a 52 conservando guards: 18 pruebas nuevas y 52 existentes aprobadas;
suite completa posterior 6.936/6.936 en 545 archivos, 214,59 s, sin ampliar
tiempos ni cambiar concurrencia. Build158 correcto; E2E150/18 con dos
timeouts de cierre aún pendientes. [Reserva](2026-09-03-public-verify-atomic-local.md)
y [correctivo del arnés](2026-09-03-worktree-git-probe-local.md).

**Avance del checklist: 56 de 106 casillas completadas (52,8 %); 50 pendientes.** Es un
recuento de tareas, no una estimación de horas restantes ni del porcentaje
funcional del ERP: las casillas tienen tamaños distintos y algunas agrupan
varios cambios. No existe todavía una medición defendible del producto completo.

| Bloque | Hecho / total | Situación |
|---|---:|---|
| Correcciones locales del checklist original | 27 / 27 | No incluye los nuevos correctivos de la tabla de continuidad; no equivale a producción |
| Cierre Git y publicación | 15 / 22 | Lote publicado hasta 70812835 y CI verde; faltan integración y cierre |
| Cloud y operación alojada | 6 / 32 | 0399 y 0400 aplicadas con permisos verificados; quedan 24 migraciones del paquete |
| Seguridad pendiente por dominio | 3 / 9 | Comandos de pago verificados localmente; release pendiente |
| Reproducibilidad y operación | 1 / 4 | Falta entorno E2E completo y verificación de proveedores |
| Orden del producto/documentación | 4 / 12 | qs del tooling corregido; faltan specs y decisiones de producto |

**Dónde estamos:** la limpieza inicial ya retiró 8 worktrees y 6 ramas;
quedan el checkout principal y el worktree activo. Después se encadenaron
correcciones de seguridad, permisos, Portal, CI y pruebas. Por eso esta sesión
ya no está sólo limpiando carpetas: está remediando hallazgos del proyecto.

**Último avance alojado verificado · 2026-09-03:** aplicada únicamente 0400 con su
autorización nominal independiente, versión de ledger `20260903171553`.
Las dos RPC de verificación quedaron sin EXECUTE para `anon`/`authenticated`
y sin grant a `PUBLIC`; `service_role` y `postgres` conservan ejecución.
Definiciones, permisos protegidos, RLS y metadatos comparados permanecen iguales.
El ledger pasó de 407 a 408 entradas; los advisors bajaron de 204 a 200 por los
cuatro avisos previstos, sin nuevos avisos. No se ejecutó un QR/diploma real.
Quedan 24 migraciones (`0401`–`0424`) y 50 casillas; no se autorizó `main`.
[Recibo de 0400 y límites del cierre](2026-09-03-codex-cloud-0400.md).
Los recibos y el checklist siguen locales, sin nuevo push.

### Modo continuo · cola local y gates separados

La revisión del 2026-09-03 conserva **56/106 (52,8 %)**. No se marcó una tarea
como terminada por auditarla ni se convirtió este porcentaje en una estimación
de horas o de preparación comercial. Las 50 casillas abiertas se distribuyen así:

| Grupo | Casillas | Qué puede avanzar sin otro GO |
|---|---:|---|
| Frentes técnicos con trabajo local elegible | 6 | RBAC por dominio, policies Portal restantes, CSP, reconciliación de specs, logger/redacción y medición web; el cierre de algunos frentes todavía depende de release o datos autorizados |
| Migraciones Cloud 0401–0424 | 24 | Revisión de archivos, contratos sintéticos y preflight de metadatos; no aplicación |
| Integración y cierre Git | 7 | Verificar contención, divergencia, compatibilidad e ignoreCommand; no merge, nuevo push o retirada |
| Operación, proveedores y decisiones | 13 | Preparar evidencia y verificar metadatos accesibles; no crear entornos alojados, enviar avisos, cambiar secretos/variables ni usar datos reales |

**Regla de continuidad:** un gate no autorizado estaciona sólo su casilla, no
toda la cola. Se continúa con el siguiente trabajo local elegible en esta misma
tarea y worktree. No se pregunta qué opción elegir para cada lectura, prueba,
contrato sintético o corrección local ya comprendida en el objetivo. Las
decisiones externas se reúnen en un único punto de control; su agrupación no
convierte una autorización nominal en permiso para otra migración o servicio.

**Estado del objetivo en la app:** el objetivo original existe y sigue marcado
`blocked`. La herramienta disponible no ofrece una operación de reanudación y
rechaza crear un duplicado mientras ese objetivo esté inconcluso. No se marca
como completo para sortear esa restricción. Se puede trabajar en esta misma
tarea; para recuperar la continuación automática, el objetivo debe reanudarse
desde los controles de la app, conservando los límites aquí documentados.

**Orden acordado al iniciar esta tanda:** comenzar por la exclusión de las puertas de acceso de Analytics
con tokens sintéticos, identificada en el informe actual; después avanzar por slices de RBAC/Portal, contratos y pruebas,
reconciliación documental, observabilidad, CSP y medición web. No abrir nuevos
módulos ni endurecer helpers globales sin inventario y contrato. Las direcciones
de entrega Portal son un siguiente slice acotado: tres policies comparan
Shipping Mark, y su posible cruce entre tenants debe reproducirse en Postgres
desechable antes de declararlo fallo. No se necesitan direcciones reales.

**Ejecución local por instrucción de Sam · 2026-09-03:** cuatro paquetes
encadenados en la misma tarea, sin pedir otra elección. Estado focal:

| Paquete | Resultado local | Qué no queda cerrado |
|---|---|---|
| SDD-0371 · Analytics | 90/90 focales, 100/100 con consentimiento y navegador con Google interceptado | Publicación y comportamiento del tag real |
| SDD-0372 · Direcciones Portal | Cruce reproducido; 54 aserciones; 167 contratos SQL y rebuild de 422 correctos | Aplicación nominal 0425; soft delete propio mantiene 42501 previo |
| SDD-0373 · Push | 321/321, incluidas tres autoridades URL ambiguas descubiertas en revisión | Entrega real, rebind/ownership, cotas totales de concurrencia |
| SDD-0374 · Verificador público | 33/33; errores de lectura/escritura ahora bloquean el lookup | Cupo atómico: carrera 39→41 todavía reproducible |

Evidencia: [Analytics](2026-09-03-analytics-local.md),
[Direcciones](2026-09-03-portal-delivery-addresses-local.md),
[Push](2026-09-03-push-local.md) y
[Verificador](2026-09-03-public-verify-local.md).
**Gate conjunto final terminado, exit 0 con reservas: 14/15 pasos medidos.**
Lint, TypeScript, frontera RSC, cuatro Edge, 6.926/6.926 pruebas en 543
archivos, docs, numeración, constantes, componentes y gobernanza correctos.
Pasaron 167 contratos SQL, reconstrucción de 422 migraciones y build de
158 páginas. La reconstrucción usó PostgreSQL desechable, no Cloud.

E2E final: 150 aprobados y 18 omitidos por falta de entorno autenticado;
dos errores globales de tiempo agotado de 480 s (suite y teardown).
El arnés los aceptó con aviso porque ningún test falló. Su mensaje atribuye
el cierre a WebKit, pero estos dos errores no prueban por sí solos esa causa.
No es una corrida E2E impecable ni prueba con usuarios reales.
migrations-applied fue SKIP por credenciales: no es verificación del ledger
alojado ni cierre verde completo. El primer gate histórico falló en typecheck
y tuvo un flaky; se corrigieron tipos, incluido un callback de test Push,
y se repitió el gate completo sin ocultar las reservas del pase final.

Conservación selectiva: 37bc0848 (specs/evidencia), 260384b2 (Analytics),
3d3ab047 (Portal) y c1e44555 (Push). El correctivo del verificador se conserva
junto con este punto terminal y el handoff actualizado. Ninguno está publicado.
El remoto se comprobó de nuevo: saneamiento 70812835, main 2a2e81bf.
El checkout principal sigue limpio en 22cec0c2; permanecen dos worktrees.

El contador original sigue **56/106**: estos correctivos de la auditoría
posterior no eran cuatro casillas independientes de ese denominador. No se
presenta su número de tests como porcentaje de producto ni se cierra una
casilla amplia de Portal/RBAC por arreglar una entidad.

**Continuación automática:** get_goal todavía devuelve blocked. No hay
operación de reanudación en las herramientas de objetivos. Se inspeccionó
la ventana expuesta por el control de escritorio, identificada como ChatGPT;
la skill computer-use prohíbe automatizar esa aplicación. No se pulsaron
controles, no se creó otro objetivo y no se editó el estado persistido por
medios alternativos. Reanudar el mismo objetivo desde la app sigue siendo
un control del usuario; la elección de la siguiente tarea local no hace falta.

**Siguiente cola local definida, sin nueva ronda de opciones:**

1. Reserva atómica SDD-0375/0426 implementada: 25 unitarios focales, 63
   aserciones SQL y carreras con conexiones reales aprobadas; 168 contratos
   SQL y rebuild423 correctos. El gate conjunto detectó timeouts del arnés
   de worktrees: correctivo SDD-0376 con 18+52 focales y suite completa posterior
   6.936/6.936 aprobados. No se repitió verify completo; E2E/Cloud mantienen
   reservas. [Evidencia](2026-09-03-public-verify-atomic-local.md).
   La migración sigue sin aplicar y el consumidor sin publicar.
2. Comando de soft delete Portal como slice independiente, sin abrir históricos.
3. Diagnosticar el cierre E2E sin ocultar timeouts; revisar actualización
   compatible del fflate transitivo con contratos de replay.
4. Continuar los inventarios RBAC/Portal, specs, logger, CSP y medición web.

Se añadieron **0425 y 0426 preparadas localmente**, además de las 24 migraciones anteriores.
Aplicación, nuevo push, main, despliegue, datos reales y limpieza final siguen
fuera del permiso local. Sólo se retiró la caché regenerable analytics-check
creada para la prueba de esta sesión, no otro worktree ni rama.

**Observación Git local:** core.hooksPath en la configuración común apunta a
la ruta antigua C:/Users/Trabajo/Desktop/DTDCargo/.git/hooks, que no existe.
No se modificó esa configuración compartida ni se afirma que un hook haya
ejecutado los gates: se corrieron explícitamente. Revisar su destino y los
hooks legítimos antes de reparar la configuración durante el cierre Git.

**Corte histórico anterior a la tanda local:** remoto de saneamiento `70812835`, CI `33774952136` verde y
PR #21 abierto en borrador; deployment `6247512977` en Preview, no producción.
Worker `f61a18dc`, dos commits documentales por delante y árbol limpio al inicio
de esta revisión; `origin/main` sigue en `2a2e81bf` y el checkout principal en
`22cec0c2`, limpio y 20 commits detrás. Permanecen dos worktrees y las dos ramas
de archivo, sin contención ancestral en `origin/main`. La consulta de las 50
tareas recientes sólo mostró esta tarea de DTDCargo; no hubo fuentes inaccesibles.
Hay 362 specs: 267 done, una superseded y 94 abiertas.

**Revalidación local de este corte:** 14/15 pasos medidos; migrations-applied
omitido por credenciales, no verde completo. Pasan 6.547 unitarios en el segundo
intento (el primero agotó el tiempo de un CLI sintético), 166 contratos SQL,
rebuild de421 migraciones y build de158 páginas. E2E:150 pasados/18 omitidos,
con un worker WebKit terminado por el runner tras no cerrar durante cinco
minutos; el arnés continuó con aviso. No equivale a smoke autenticado ni a un
teardown perfecto. No hubo correctivos funcionales nuevos en esta auditoría.

El informe de auditoría de este corte se conserva aparte del contador histórico.
Sus hallazgos nuevos no se presentan como remediados ni se añaden silenciosamente
al denominador. [Auditoría y límites del corte](../../AUDIT-2026-09-03.md).

**Avance anterior · publicación y 0399:** los 22 commits autorizados hasta
`70812835` están publicados en la rama y el CI `33774952136` pasó completo
(6.547 pruebas / 540 archivos). El PR #21 sigue en borrador; el deployment
`6247512977` es Preview, no producción. Se aplicó únicamente
`0399_revoke_truncate_anon_authenticated`, versión de ledger `20260903164612`.
`anon` y `authenticated` quedaron sin TRUNCATE en las 249 tablas y dos vistas
de `public`; los demás permisos medidos, RLS y `storage` permanecen iguales.
Ledger: 407 entradas, una sola añadida. Quedan 25 migraciones (`0400`–`0424`),
no autorizadas por este permiso. No se integró `main` ni se limpió otro worktree.
[Recibo de aplicación, permisos y publicación previa](2026-09-03-codex-cloud-0399.md).
Este recibo y el checklist actualizado quedan locales, sin push adicional.

Los puntos siguientes registran el avance anterior: sus cifras y menciones
«sin publicar» describen aquel momento, no sustituyen el resumen vigente.

**Correctivo local anterior:** SDD-0370 corrige el helper de worktrees: no copia
secretos, congela la instalación y comprueba preservación, publicación y
contención antes de retirar. Exige atestación externa de inactividad/ownership
ligada al HEAD y handoff versionado; no pretende detectar procesos ni otorgar GO.
Rechaza ignorados, enlaces, índices ocultos e historia sustituida. Sin fallback,
force, prune global ni branch -D. Pasan 79 casos específicos (27 puros + 52 integración),
suite completa 6.547/540 y revisión independiente. Cierra una casilla existente:
**52/106**, sin nuevo denominador. No se limpiaron worktrees reales ni se publicó.
[Contrato, reproducciones y límites](../specs/0370-worktree-safe-lifecycle/spec.md).

**Saneamiento documental anterior:** los tres runbooks de worktrees ahora
distinguen roles, autorizaciones y pruebas de limpieza, sin copiar secretos,
usar rutas antiguas ni recomendar borrado forzado. `AGENTS.md` no se modificó.
La lectura del helper existente detectó automatismos aún inseguros: se añade
una tarea concreta para corregirlos antes de volver a usarlo. El denominador
pasa de 105 a 106 por ese pendiente real; no se cuenta la documentación como
una limpieza ni como corrección del script. [Guía vigente](../runbooks/git-worktrees-multiventana.md).

**Preflight anterior de bootstrap:** el control plane sólo devuelve la rama
productiva; no hay branch efímero disponible, y las siete variables E2E están
ausentes del proceso inspeccionado. Los 18 casos existentes no cubren login
positivo de Portal/Back/PIN. Se corrigieron inventario y secuencia en
[el runbook E2E](../runbooks/e2e-supabase-efimero.md): ejecutar lo existente y
ampliar el bootstrap son entregables distintos. No hubo seed ni escritura
alojada; se mantiene **51/105 (48,6 %)**.

**Cierre documental anterior:** SDD-0309 queda cerrada como cobertura técnica
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

**SDD-0365 y 0366 siguen abiertas por aplicación/release/smoke.** Con0423 se
pasó de46/101 a47/103 por una corrección local y un gate nominal pendiente.
El arreglo posterior de qs cierra una casilla existente: **48/103**, sin cambiar
el denominador ni sumar casillas por prueba. El cierre de revisión de metadatos
y código alojado llevó el punto anterior a **49/103**; clasificar los avisos
elevó el punto anterior a **50/103**. Club/0424 llevó el punto anterior a **51/105**.
El pendiente del helper de worktrees llevó entonces a **51/106**;
su corrección local SDD-0370 llevó el punto anterior a **52/106**.
SDD-0258 no está cerrado.

**Lo que impide decir “terminado”:** `main` sin integrar, 24 migraciones del
paquete sin aplicación autorizada y trabajo de aplicación/seguridad/documentación
todavía pendiente. El lote funcional sí está publicado; los recibos de 0399 y
0400 quedan locales. El worktree activo no se borra mientras conserve trabajo sin integrar.

### Historial Git y alojado anterior a la publicación de 70812835

Este apartado conserva la secuencia previa y sus bloqueos ya superados.
La publicación de los 22 commits, su CI y Cloud 0399/0400 están actualizados en el
resumen vigente y su recibo; no se debe ejecutar un nuevo push por leer este historial.

- Remoto: `https://github.com/hailuwaycom-sketch/DTDCARGO.git`.
- `origin/main`: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
- Base publicada anterior: `codex/saneamiento-integral` en
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
  Ese cierre quedó en `1d4b1452`. El vigésimo incremento corrige sólo el README,
  runbook y seguimiento E2E; no implementa fixtures nuevos, publica ni aplica
  migraciones. La autorización de un SHA anterior conserva ese límite exacto.
  Ese incremento quedó en `900b25bb`. La revisión de runbooks de worktrees
  añade un vigesimoprimer incremento documental, sin usar el helper heredado,
  modificar AGENTS, publicar ni borrar carpetas. Mantiene separado el GO del SHA.
  Ese incremento quedó en `3c1e834a`. SDD-0370 añade un vigesimosegundo incremento
  local para corregir el helper, con pruebas y llamadores sincronizados. No se
  reintenta el push: la autorización debe cubrir el SHA final de este lote.
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
- Specs reales: 362; 267 `done`, 1 `superseded` y 94 sin cierre documental
  (79 `in-progress`, 8 `proposed`, 4 `approved`, 3 `draft`). SDD-0370 conserva
  publicación/CI pendientes; su corrección local no cierra el repo. SDD-0309 cierra
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
Posteriormente se publicó la rama hasta `70812835` con autorización exacta;
su CI alojado pasó y Vercel produjo otro Preview. Después se aplicaron 0399 y
0400 de una en una, cada una con su autorización independiente. No hubo merge
a `main` ni promoción de la app. Sus recibos y este checklist actualizado no
están incluidos en aquel push.

## Lo ya saneado localmente

- [x] Rescate selectivo del trabajo válido y separación de cambios ajenos.
- [x] Revocación local de `TRUNCATE` público y del RPC público de verificación;
  migraciones 0399 y 0400 preparadas y contratadas; ambas aplicadas y verificadas
  con autorizaciones independientes. El smoke real de /verificar sigue pendiente.
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
  push exacto de aquel lote. El push posterior tuvo su autorización independiente.
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
- [x] Obtener aprobación explícita y publicar los 22 commits posteriores a
  `eabb230b`, hasta `70812835`, en `origin/codex/saneamiento-integral`.
  Remoto exacto confirmado; no incluye un push del recibo posterior de 0399.
- [x] Confirmar CI de Academia, Reclamos, Pagos y todo el lote publicado en
  `70812835`: run `33774952136` completo y verde, 6.547 pruebas / 540 archivos.
- [x] Corregir localmente `scripts/harness-worktree.mjs` con SDD-0370: start
  sin copia de entorno y con lockfile congelado; finish verifica preservación,
  publicación/contención y exige confirmación externa de ownership/inactividad
  antes de retirar. Sin fallback recursivo, force, prune global ni branch -D.
  RED causal y 79 casos específicos, suite 6.547/540, gates y revisión aprobados.
  No elimina la comprobación humana de procesos/GO ni se ejecutó sobre los
  worktrees reales. Publicación/CI se verificaron en sus casillas independientes.
  [Contrato operativo actualizado](../runbooks/git-worktrees-multiventana.md).
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
  con hashes idénticos; evidencia publicada hasta70812835, falta integrarla y resolver la
  contención antes de borrar la rama. No se restauran instrucciones obsoletas.
  [Acta de recuperación y límites](2026-09-02-codex-archivo-y-recuperacion.md).
- [x] Retirar el upstream `origin/main` de esa rama archive para evitar una
  publicación accidental desde ella; HEAD `d05b6355` y contenido conservados.

## P0 · gates alojados independientes

- [x] Aplicar `0399_revoke_truncate_anon_authenticated.sql` con autorización
  específica y siguiendo el runbook: ledger `20260903164612`, aplicación única,
  postflight de permisos aprobado el 2026-09-03. No autoriza otra migración.
  [Recibo y comparación antes/después](2026-09-03-codex-cloud-0399.md).
- [x] Aplicar `0400_revoke_public_verify_rpc_execute.sql` con autorización
  específica independiente y el mismo runbook: ledger `20260903171553`,
  permisos verificados, cuatro avisos previstos retirados y ninguno nuevo.
  [Recibo y límites; smoke real pendiente](2026-09-03-codex-cloud-0400.md).
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
  `anon` y 204 para `authenticated`, sobre 249 tablas de `public`; después de
  aplicar 0399 ambos quedaron en cero, también en las dos vistas de `public`.
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
  legítimas sólo para reducir el contador. Esa clasificación no hizo remediación;
  el postflight de 0399 confirmó los mismos 204 avisos. El postflight posterior
  de 0400 retiró sólo sus cuatro avisos de RPC: quedan 200, sin avisos nuevos.
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
- [x] Continuar RBAC de aplicación en la base por slices: lectura minimizada de
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
  SDD-0403/0435 cierra el primer slice de autorización documental: una factura
  ahora hereda el candado `accounting`/`admin` en metadatos, bucket, reservas,
  restauración y escrituras `SECURITY DEFINER`. La casilla permanece abierta:
  SDD-0404/0436 extiende el mismo control a CxP y órdenes de pago de Tesorería,
  sin duplicar policies; SDD-0405/0437 suma los asientos y completa los cuatro
  tipos estrictamente contables. SDD-0406/0438 incorpora `expense`, separa
  vista/edición según defaults y overrides de Gastos, completa sus dos endpoints
  mutantes pendientes y deja `support` estrictamente read-only. SDD-0407/0439
  extiende el contrato a las dos familias de documentos de envíos, añade el
  guard faltante en sus Server Actions y preserva la lectura Portal de 0416.
  SDD-0408/0440 añade `client` con defaults y overrides de Clientes.
  SDD-0409/0441 suma `supplier` con la matriz de Proveedores y extrae el mapa a
  una función interna no ejecutable por roles de API. SDD-0410/0442 incorpora
  `consolidation` y `booking` con la matriz compartida de Naviera.
  SDD-0411/0443 añade `bitacora_task` y corrige el bucket propio para que Soporte
  sea read-only también ante acceso directo. SDD-0412/0444 completa `none`,
  añade el guard faltante al versionado, preserva paths legados sin segundo
  segmento y hace fallar cerrados los tipos Storage inventados. Los 12 valores
  del enum quedan cubiertos; un tipo futuro exige otro slice explícito.
- [x] Auditar por dominio las otras policies Portal que comparan Shipping Mark
  sin tenant. SDD-0357 cubre `invoices` y SDD-0359 cubre `shipments`,
  `shipment_documents` y `shipment_events`. SDD-0361 cubre `suppliers_cn`,
  `prealertas` y `prealerta_documents`. SDD-0362 cubre cursos, módulos, lecciones,
  inscripciones, diplomas y progreso de Academia. SDD-0363 cubre reclamos y
  evidencias. SDD-0364 cubre la identidad/tenant de reportes de pago, no sus
  comandos ni integridad financiera. SDD-0368 cierra la cadena de identidad
  que alimenta seis policies Club, incluidos eventos de contexto club; no
  certifica todo su RBAC/integridad ni cohortes fuera de ese contexto.
  SDD-0372/0425 cubre ahora las tres policies de direcciones, con contrato
  sintético y sin aplicación alojada; el soft delete previo se registra separado.
  SDD-0400/0432 cubre la policy de lectura de `warehouse_boxes`, preservando
  el acceso de equipo y servicio; 0432 tampoco está aplicada.
  SDD-0401/0433 cubre la entrega Realtime de `conversation_messages` mediante
  una autorización booleana ligada al principal, cliente, tenant y canal;
  preserva el acceso histórico de equipo/servicio y 0433 no está aplicada.
  SDD-0402/0434 cubre el último residuo reconstruido: `prealerta_addons` y sus
  tres consumidores. El inventario final clasifica 42 policies y deja cero
  expresiones con los helpers históricos de cliente/Shipping Mark/tenant.
  Esto cierra la auditoría de policies Portal enumerada, no todo el RBAC del ERP.
  Secuencias, transiciones, integridad financiera y relación proveedor/cliente
  fuera de esos contratos siguen como hipótesis que requieren reproducción.
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
  construcciones dentro de las páginas que el guard histórico sí recorría.
  SDD-0383 comprobó que ese guard omitía layouts y componentes: el layout aún
  tenía dos construcciones. El nuevo guard resuelve imports por AST en todos los
  `.tsx/.jsx` de producción y vuelve a dejar cero imports directos; las dos
  lecturas del layout quedaron en una fachada `server-only` probada. Este cero
  no certifica dependencias transitivas ni Server Actions. SDD-0384 tomó el
  primer slice de acciones: Perfil ya deriva principal coherente antes de
  elevar y fija tenant/cliente/origen en fotos y solicitudes. La reproducción
  causal, 53 pruebas de Perfil y la suite 7.200/7.200 pasan.
  SDD-0385 cerró después el RPC de mensajes: una fixture reprodujo la escritura
  tenant A → cliente B y 0431 ahora resuelve principal activo, cliente vivo y
  tenant coherente antes de cualquier DML. Pasan 22 aserciones focales, los 173
  contratos SQL y rebuild de 428 archivos. La migración no fue aplicada.
  SDD-0386 cerró seguidamente las rutas Web Push: alta y baja exigen el principal
  completo antes de elevar; errores Auth/transporte no escriben. RED 7/9,
  GREEN 186/186 y conjunto Portal 867/867. No hubo suscripción o envío real.
  SDD-0387 cerró después la capa de aplicación de Academia: lecturas y progreso
  derivan un principal único y fijan tenant, Shipping Mark, curso y lección según
  corresponda. RED 7/7, GREEN 7/7 y conjunto Portal 874/874. La defensa RLS 0418
  conserva su estado preparado y no fue aplicada; no se consultaron datos reales.
  SDD-0388 cerró el CRUD de proveedores: alta, edición y borrado derivan el
  principal canónico y fijan tenant + Shipping Mark antes del dominio. RED 5/5,
  GREEN 5/5, test histórico 9/9 y conjunto Portal actual 870/870. 0417 conserva
  su estado preparado y sin aplicar; las acciones de compras quedan en cola.
  SDD-0389 cerró esas acciones de compras: alta, solicitud de servicio y detalle,
  junto con sus helpers, fijan el mismo principal y tenant de punta a punta. RED
  6/6, focal/histórico 15/15 y Portal+Prealertas 1.025/1.025. 0417 sigue sin
  aplicar; no hubo compras, servicios, adjuntos ni datos reales.
  SDD-0390 cerró las lecturas de reportes de pago, hitos y actividad reciente:
  principal inválido corta antes del dominio; las lecturas fijan tenant de la
  fila y del envío junto con Shipping Mark. RED 4/4, focal/histórico 38/38 y
  Portal 878/878. No se consultaron comprobantes, envíos o eventos reales.
  SDD-0391 cerró las seis lecturas núcleo: listas/detalles de envíos y facturas,
  documentos y próximo arribo derivan principal y fijan tenant + Shipping Mark.
  RED 5/5, focal/histórico 24/24 y Portal 883/883. No se consultaron archivos,
  facturas, envíos ni datos reales.
  SDD-0392 cerró activación y completitud: aprobación, conteo de envíos, foto y
  direcciones derivan un principal único y fijan tenant/cliente/Shipping Mark.
  RED 3/3, focal/histórico 18/18 y Portal 886/886. El borrado transaccional 0427
  quedó intacto; no se consultaron perfiles, fotos o direcciones reales.
  SDD-0393 cerró la última lectura Portal basada en la RPC histórica: reclamos
  ahora derivan principal y fijan tenant + Shipping Mark. RED 2/2, GREEN 2/2 y
  Portal 888/888. No se consultaron reclamos o resoluciones reales.
  SDD-0394 cerró alta, edición y predeterminada de direcciones: el principal
  completo llega hasta los helpers con tenant/cliente/Shipping Mark. RED 8/8,
  focal/histórico 23/23 y Portal+helper 896/896. El borrado 0427 quedó intacto y
  no se consultaron o modificaron direcciones reales. Tras la tanda completa,
  pasan 7.249/7.249 unitarias en 569 archivos y el lint global.
  SDD-0395 cerró solicitud y avance de cotizaciones: el principal completo se
  valida antes de admin y fija correlativo, lectura, INSERT, UPDATE y aviso. RED
  3/3, focal/histórico 18/18 y Portal 895/895. No hubo datos ni avisos reales.
  SDD-0396 cerró las acciones elevadas de Referidos y Reclamos: ambas cortan
  antes de admin con principal inválido y ya no releen `clients`; el embarque y
  el INSERT del reclamo fijan tenant, Shipping Mark, cliente y usuario canónicos.
  RED 4/4, GREEN 4/4 y Portal 899/899. No hubo correos, adjuntos o datos reales.
  SDD-0397 cerró aceptación legal y reportes de pago: los tres comandos exigen
  el principal completo; aceptación y reporte cortan antes de admin y ya no
  releen `clients`. RED 5/5, focal/histórico 61/61 y Portal 903/903. No hubo
  aceptaciones, comprobantes, avisos, comandos o datos reales.
  SDD-0398 cerró siete contextos privados: todos exigen principal completo y se
  eliminaron cinco relecturas admin de tenant. Hub y detalle de compra propagan
  tenant + Shipping Mark a compras, proveedores y documentos. RED 12/12,
  focal/histórico 51/51 y Portal+Prealertas 1.068/1.068; la suite global posterior
  pasa 7.274/7.274 en 573 archivos y el lint global. Sin lecturas reales.
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
- [x] CSP con nonce para la app privada y excepción del visor Marca aislada
  (SDD-0413): RED de navegador encontró el script de tema sin nonce; GREEN 35/35,
  build 158, Studio/Portal sin errores y sitio público aún prerenderizado. El
  visor mantiene sólo su CSP autorizada; `style-src 'unsafe-inline'` queda como
  deuda explícita. [Evidencia](2026-09-04-private-app-csp-nonce-local.md).

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
  Preflight de control plane: sólo main; variables del proceso ausentes.
  Los seis casos lógicos existentes se pueden validar como paquete separado
  cuando haya GO y branch correcto, pero no cierran el bootstrap de Portal.
  [Secuencia, cobertura real y condiciones](../runbooks/e2e-supabase-efimero.md).
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
- [ ] Reconciliar las specs no cerradas por rebanadas de dominio. El inventario
  vigente encontró 105 reales, no 94; SDD-0264, SDD-0276 y SDD-0287 ya cerraron
  con evidencia en `origin/main`, pruebas, navegador y render PDF, por lo que
  quedan 102. SDD-0300 se revisó y sigue abierta por su hueco de rol operativo.
  [Primer slice](2026-09-04-spec-reconciliation-public-entry.md) y
  [segundo slice](2026-09-04-spec-reconciliation-portal-documents.md). Cambiar un
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
  crons y Edge Functions. SDD-0414 creó el helper y adoptó los tres cron con
  prueba previa; SDD-0415 extrajo el contexto común y cerró cuatro workers drain;
  SDD-0416 añadió cuatro jobs programados y SDD-0417 cerró los seis monitores.
  SDD-0418 añadió un logger Deno, correlacionó las 4/4 Edge Functions y eliminó
  doce logs libres, incluido el payload completo del dry-run de write-back.
  SDD-0419 propagó el correlador por cuatro crons de salud y retiró catorce logs
  crudos de altas, Telegram, correo, SeaRates y brief. SDD-0420 retiró otros
  trece logs de push, avisos al cliente y workflows, y propagó el correlador por
  sus tres drains. SDD-0421 estructuró el notificador y outbox de bugs, retiró
  doce logs adicionales y enlazó el cuarto drain. SDD-0422 retiró cinco logs de
  las primitivas in-app, Telegram y despacho, y conectó tres escrituras de bugs.
  Acumulado: 17/17 handlers cron, 4/4 Edge Functions, quince internals adoptados,
  cero `console.*` en esos alcances y 7.396 pruebas completas. El inventario
  general conserva otros módulos legacy; esta casilla no se marca ni aumenta el
  59/106.
  [Acta base](2026-09-04-structured-request-logging.md) y
  [workers drain](2026-09-04-structured-drain-crons.md) y
  [jobs programados](2026-09-04-structured-scheduled-crons.md), más
  [salud e integraciones](2026-09-04-structured-health-crons.md) y
  [Edge Functions Kommo](2026-09-04-structured-kommo-edge-observability.md), más
  [internals de salud](2026-09-04-structured-health-internals.md) e
  [internals de workers](2026-09-04-structured-worker-internals.md), más
  [notificaciones de bugs](2026-09-04-structured-bug-notification-internals.md)
  y [primitivas compartidas](2026-09-04-structured-notification-primitives.md).
- [ ] Medir Core Web Vitals y fijar budgets de CSS/fuentes por superficie.
- [ ] Resolver la deriva Brand Book/generador usando únicamente un Norte nuevo;
  no republicar desde copias locales incompletas.
- [ ] Decidir si HailuWay sigue como integración health-only y si SeaRates se
  conserva, reemplaza o termina; no podar endpoints sólo por un snapshot viejo.
- [ ] Retirar variables muertas del entorno alojado después de comprobar sus
  consumidores allí; el repo ya no declara Payload legado.

## Orden de trabajo recomendado

1. Continuar la cola local elegible sin pedir una elección por cada paso:
   reproducción sintética y slices de seguridad/Portal, pruebas, documentación,
   observabilidad, CSP y medición. Estacionar cada dependencia externa y seguir
   con el siguiente trabajo local seguro. El push hasta70812835, su CI y los
   permisos de 0399/0400 ya están verificados.
2. Mantener en la cola de gates el smoke de /verificar con QR/diploma reales
   aprobados y la aplicación nominal de0401. No bloquean la revisión local,
   pero siguen siendo necesarios antes de cerrar sus alcances. Ejecutar,
   sólo con los GO correspondientes, la secuencia documentada en
   el acta de release; repetir preflight por migración. SDD-0358 ya separó
   expansión y restricción de Mailing; todavía no se ejecutó el release.
3. Con autorizaciones individuales, dejar disponibles las RPCs necesarias
   antes de publicar sus consumidores; comprobar cada migración 0401–0413 sin
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
6. Detener el objetivo completo sólo cuando no quede trabajo local elegible,
   exista conflicto de ownership o una incertidumbre haga inseguro continuar.
   En ese punto, presentar juntos los permisos/decisiones pendientes; no
   interpretar «continuo» como autorización de Cloud, main, datos o limpieza.

## Stop conditions

- La autorización de push ya ejecutada cubrió exactamente los 22 commits hasta
  70812835 en la rama propia. No incluye los recibos posteriores, `main`, force-push
  ni ramas ajenas; cualquier ampliación exige autorización explícita.
- Las autorizaciones Cloud ejecutadas fueron individuales: primero 0399 y
  después únicamente 0400 con verificación de permisos. No autorizan datos de
  negocio para el smoke. Las otras 24 migraciones y `main` siguen fuera de alcance.
- No hay merge, deploy, migración, secreto o escritura de datos implícitos.
- Un `SKIP` documenta una parte no medida; no se presenta como verde.
- No se elimina worktree o rama mientras exista cambio no contenido o tarea
  activa apuntando a ese checkout.
