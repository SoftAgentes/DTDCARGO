---
title: Verificador público - rechazo local ante fallo del throttle
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
confidencialidad: interno
---

# Verificador público · SDD-0374 · evidencia local

## Resultado

Se corrigió únicamente el fallo abierto de isVerifyThrottled. Ante lectura
incierta, count inválido, escritura sin confirmación o excepción, devuelve
true. El consumidor existente omite las consultas de diploma/Shipping Mark.
Sólo count válido por debajo de 40 y un INSERT confirmado permiten continuar.
No cambia el límite, la ventana, la UI, la IP obtenida ni la tabla.

RED: 25 fallos / 8 positivos. GREEN: 33/33, sin DB, red, datos reales ni
enumeración de alumnos. Se preservan conteos0/3/39 y bloqueos40/41/90,
ventana exacta de 30 minutos y un único INSERT cuando corresponde.
Los errores generan aviso genérico sin IP, folio ni mensajes externos.

Implementación: lib/public/verify-throttle.ts:47.
Consumo: app/verificar/page.tsx:208; lookups condicionados en :215 y :216.
Contrato: lib/public/verify-throttle.test.ts.

## Residuo expresamente NO corregido

Dos solicitudes concurrentes observan39 y ambas insertan: el fake termina
en 41. Este caso sigue reproducible y probado, por lo que SEC-03 permanece
parcial, no cerrado. La reserva atómica necesita contrato transaccional,
migración nominal y secuencia de aplicación propias. No usar un mutex de
proceso como sustituto de concurrencia distribuida ni cambiar0169 aplicada.

No se revisó confianza de IP/proxy ni se rediseñaron códigos secuenciales.
No se midió disponibilidad de QR en producción. El error de control muestra
el estado neutro ya existente; el cambio privilegia no revelar información
sin registrar el intento frente a disponibilidad durante una falla.

## Privacidad y permisos

CORRECTO técnico: resultado incierto bloquea el lookup sensible y el aviso
no incluye PII. NO VERIFICABLE: comportamiento/despliegue efectivo alojado y
reserva concurrente global. Revisión acotada según revisar-datos-ve; no
certificación legal. Sin migraciones nuevas, escrituras Cloud ni credenciales.
Nuevo push, integración, deploy y smoke real siguen requiriendo sus permisos.

## Preparación del siguiente slice local

Lectura de 0169 confirma un log por IP con índice(ip, created_at), RLS sin
policies y uso privilegiado. El repo ya utiliza pg_advisory_xact_lock por
identidad de operación (por ejemplo0147 y0316); no hace falta un mutex en Node.
Diseño propuesto, todavía sin migración ni cambio de consumidor:

1. Inventariar escritores/limpieza y verificar confianza/canonicalización de IP.
   getRequestIp devuelve la primera XFF o unknown; su comentario sobre Vercel
   no sustituye la comprobación del proxy real. No cambiar ese helper global
   dentro del slice sin inventariar sus otros consumidores de evidencia.
2. Una RPC privilegiada reserva cupo con lock transaccional por clave IP,
   conteo y alta en la misma transacción. Mantener log/ventana/límite actuales;
   tiempo de servidor después de adquirir el lock. Sin lookup de diploma.
3. EXECUTE sólo para service_role; público y authenticated sin acceso.
   Respuesta booleana estricta y wrapper fail-closed; no fallback al contador
   separado si falta la RPC.
4. Contrato en Postgres desechable con conexiones concurrentes: desde 39 sólo
   una reserva puede aprobarse; otra IP no comparte cupo. Probar permisos,
   ventana, rollback/error, entradas inválidas y preservación de filas/índice.
5. Release por expansión: migración nominal aprobada/aplicada/verificada
   antes del consumidor. Un gate verde local no autoriza esa aplicación.

Este diseño orienta la cola siguiente, no constituye implementación ni
comprobación de atomicidad. No se reservó un número de migración por memoria.
