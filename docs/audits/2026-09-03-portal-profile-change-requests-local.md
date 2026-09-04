---
title: Perfil y solicitudes de cambio Portal por principal y tenant
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
review-by: 2026-09-10
confidencialidad: interno
---

# SDD0382 · perfil y solicitudes de cambio Portal

## Estado

Correctivo local verificado. No publicado ni aplicado. La numeración 0382/0430 se
confirmó contra 15 refs después de actualizar `origin`. No hubo Cloud, datos
reales, push, `main`, despliegues ni limpieza final.

## Reproducción causal

La sonda independiente reconstruyó las migraciones reales 0006, 0080, 0220,
0221 y 0230 sobre PostgreSQL desechable. Bajo la policy histórica:

- Un vínculo activo con tenant A y cliente B leyó el perfil y la solicitud B.
- Un cliente retirado no leyó su perfil, pero sí conservó su solicitud.
- Portal A leyó una solicitud de su `client_id` con tenant B y una traza
  `source='admin'`, incluido el campo interno `review_note`.
- Revocados, invitados, sin vínculo y equipo deshabilitado no recibieron filas.
  Las ramas de equipo e híbridas se midieron separadamente.

El vínculo incoherente se insertó como fixture administrativo. Esta evidencia
no demuestra que una cuenta Portal pueda crearlo. RED SQL terminó en exit 3 /
P0001 en la primera expectativa segura posterior a los controles causales.
RED de aplicación: 3/3 casos expusieron perfil por confiar sólo en la RPC;
otros 2/2 demostraron que las excepciones de transporte no degradaban a null.

## Delta

- 0430 cambia únicamente dos expresiones RLS. Perfil exige vínculo activo,
  cliente vivo y coherencia client/tenant. Solicitudes añade el mismo contrato
  y `source='client'` sólo a la rama Portal; la rama de equipo sigue por tenant.
- `getPortalClient` conserva su DTO, pero deriva la relación desde la sesión,
  filtra el vínculo por UID/estado y valida el cliente embebido.
- La página Perfil usa una lectura Portal específica para solicitudes, con
  filtros explícitos por tenant, cliente, origen y estado. Las queries genéricas
  del Studio y las acciones no cambian.
- Sin cambios visuales, rutas, acciones, captura de datos o logs.

## Verificación local

- 40 aserciones SQL focales, reejecución idempotente y 11 derivas: aprobadas.
- Equipos A/B, cuatro híbridos, anon, service_role, ACL, catálogo y filas:
  preservados; rollback total y contenedor propio retirado.
- 46 pruebas focales en cuatro archivos: aprobadas.
- 172 contratos SQL y reconstrucción de 427 migraciones: aprobados.
- 7.181 pruebas unitarias en 556 archivos, 414,44 s: aprobadas sin reintento
  después del último ajuste. Los intentos interrumpidos anteriores no cuentan.
- TypeScript, lint focal, docs, numeración, componentes, gobernanza y diff:
  aprobados.

## Límites y continuación

- Aplicación nominal 0430, verificación posterior, publicación y smoke son gates
  externos independientes.
- No se certifican otros usos de helpers Portal ni la frontera service_role de
  componentes: tienen sus propios inventarios y reproducciones.
- Hay 30 migraciones preparadas 0401–0430 según el último ledger 0400, sin una
  nueva consulta Cloud. Checklist original 56/106; no se suman subpasos nuevos.
