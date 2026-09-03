---
title: Verificador público - reserva atómica local
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
confidencialidad: interno
---

# Verificador público · SDD-0375 · evidencia local

## Resultado y alcance

La RPC 0426 y su consumidor están implementados sólo en el worktree de
saneamiento. El límite sigue siendo 40 intentos en 30 minutos. Un lock
transaccional por clave IP textual serializa conteo e INSERT; la hora del
servidor se obtiene después de adquirirlo. Sólo READ COMMITTED está permitido.
El wrapper sólo permite continuar con data:true y error:null, sin fallback
al contador antiguo. La página y sus mensajes no cambian.

No aplicado a Supabase, no publicado, sin datos reales ni smoke de diplomas.
0426 necesita aprobación nominal, preflight y comprobación de permisos ANTES
del despliegue del consumidor. El fallo por RPC ausente bloquearía consultas.
La coexistencia con versiones antiguas que insertan directamente no garantiza
el cupo nuevo: el lock cooperativo no restringe escrituras administrativas.

## RED → GREEN ejecutado

- Wrapper anterior: 22/22 regresiones fallaron causalmente; el fake incluía
  un camino count+insert funcional, no una función/importación ausente.
- PostgreSQL 17.10 real, dos conexiones y barrera: ambas leyeron 39; ambas
  insertaron, y terminaron en 41. El runner --legacy salió distinto de cero.
- Wrapper corregido: 22/22. Integración/SKIP del runner: 3/3; 25/25 juntos.
- SQL: 63 aserciones persistidas, además de controles dentro de savepoints.
  Permisos EXECUTE reales con 42501, INVOKER sin SELECT/INSERT, límites,
  inválidos, ventana, preservación e idempotencia; 11 derivas rechazadas
  sin modificar el catálogo. El fixture completo se revierte.
- Un trigger sintético que suprime INSERT reprodujo otro falso éxito; se
  corrigió comprobando FOUND y propagando P0001, sin confirmar una reserva vacía.
- Conexiones reales: desde 39 sólo una reserva sobrevive a COMMIT; ROLLBACK
  libera el cupo para la segunda; otra clave progresa durante la espera.
  El reloj posterior al lock ve intentos vencidos durante la espera.
  lock_timeout propaga 55P03 sin fila y permite reintentar tras liberar el lock.
  Tres niveles distintos de READ COMMITTED se rechazan con 25000 y cero filas.

El runner usa PostgreSQL local con network=none, sin puertos publicados,
montaje de migrations/tests en lectura y datos sintéticos en tmpfs. No
descarga imágenes. SKIP devuelve 3 si falta Docker/imagen o VERIFY_SKIP_SQL=1;
un fallo real devuelve 1, sin retry ni absolvedor. Está en scripts/verify.mjs.
La limpieza se limita al contenedor creado con ID, nombre y label propios.

Primer gate conjunto: lint, RSC, tipos, cuatro Edge, docs, numeración,
constantes, componentes y gobernanza pasaron. Pasaron 168 contratos SQL, la
concurrencia nueva y rebuild de 423 migraciones (405 desde cero, 18 sólo-ledger).
migrations-applied fue SKIP por credenciales ausentes; no mide Cloud.

La suite completa falló en el arnés de worktrees: primero 2 timeouts/6.916
aprobados (301,01 s); el reintento falló con 4 timeouts/6.914 aprobados
(311,65 s), siempre entre las mismas 52 pruebas del arnés y sin fallos de
aserción funcional. Un contraste focal con un trabajador produjo 3 aprobados,
1 timeout y 48 no seleccionados: reducir concurrencia no basta como causa.
Vitest instalado permite 31 workers en esta máquina de 32 unidades de
paralelismo/15,7 GB; hubo una muestra de sólo 30 MB libres. Son condiciones,
no prueba causal completa. No se cambió la configuración ni se ocultó el rojo.

Perfil in-process del helper en fixture sintética, dry-run, fuera de Vitest:
72 llamadas Git, 3.801 ms, todas exitosas. El presupuesto CLI del fixture es
10.000 ms para el conjunto; se investiga su comportamiento bajo carga antes
de modificarlo. E2E/build del primer gate siguen en curso al conservar este
checkpoint; no se declara cierre general ni se extrapola el gate de SDD-0374.

## Revisión técnica de privacidad del delta

Revisar-datos-ve se usó para minimizar el delta y separar evidencia local de
hechos alojados; no certifica cumplimiento legal.

| Estado | Evidencia y límite |
|---|---|
| CORRECTO | lib/public/verify-throttle.ts:40 exige reserva confirmada antes del lookup; aviso genérico en :42 sin IP, folio o error del proveedor |
| CORRECTO | app/verificar/page.tsx:215 conserva consultas condicionadas; no se añadieron campos de alumnos ni eventos analíticos |
| CORRECTO | 0426 no cambia filas, ACL de tabla, RLS, índices ni columnas; el contrato compara históricos y catálogo antes/después |
| ENCONTRADO | app/api/cron/purge-throttle/route.ts:46 y :54 sólo purgan portal_registro_throttle y operario_pin_attempts; no public_verify_throttle |
| NO VERIFICABLE | Proxy efectivo, canonicalización de IP, retención alojada y comportamiento del consumidor en producción no medidos |

La deuda de retención no autoriza borrar históricos ni inventar un plazo.
No cambia getRequestIp, compartido con otras evidencias y accesos. La
atomicidad demostrada es por texto exacto: alias IPv6 y confianza del proxy
no están resueltos. El límite por IP no sustituye autorización ni impide toda
enumeración distribuida de códigos secuenciales.

## Continuidad

SDD-0374 queda como evidencia histórica del fallo seguro. Su carrera se cierra
en el contrato local de SDD-0375, no en producción. SEC-03 sigue parcial hasta
resolver release/smoke y sus otros límites. El checklist original conserva
56/106 (52,8 %); este paquete se muestra aparte, no como porcentaje del ERP.

Siguiente slice local acordado: comando de soft delete de direcciones Portal.
Las 24 migraciones anteriores, 0425 y ahora 0426 conservan permisos nominales
independientes; tampoco se autoriza nuevo push, main, deploy o limpieza final.
