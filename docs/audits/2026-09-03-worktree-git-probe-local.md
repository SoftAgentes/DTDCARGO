---
title: Cierre seguro - consultas Git agrupadas
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
confidencialidad: interno
---

# SDD-0376 · corrección local del arnés

## Problema y límite

El gate de SDD-0375 falló dos veces en timeouts de 10 segundos del CLI
sintético: 2/6.918 y 4/6.918 casos. Un contraste con un trabajador dejó
1/4 fallido. No se atribuye todo a concurrencia ni se aumentan timeouts.
La guía de depuración detuvo el siguiente slice de Portal para corregir
primero este fallo; el permiso sigue siendo local, no de limpieza real.

El cierre llama inspectFinish dos veces y comprueba dos raíces. Antes
resolvía seis rutas de operaciones Git en seis procesos por comprobación:
24 procesos de rutas, 72 totales en un finish dry-run válido.

## Cambio y evidencia

Se agrupan las seis opciones --git-path con --path-format=absolute en un
solo rev-parse. Se exigen seis rutas absolutas, ordenadas por basename.
Respuesta ambigua o código Git fallido bloquea; Git sigue resolviendo las
rutas y se mantienen ambas inspecciones y todos los guards de disposición.
No cambia Vitest, los tiempos máximos, permisos ni attestation externa.

RED independiente: contador real 72/24 frente a 52/4 esperado, exit 1.
GREEN: 18/18 en 16,16 s; 52 procesos totales y cuatro consultas de seis
rutas. Los seis estados en ambas raíces bloquean sin mutación; truncamiento,
ruta relativa, desorden y fila extra bloquean. CRLF completo funciona.
Lint focal y diff-check aprobados; revisión independiente sin bloqueadores.

### A/B emparejado, mismo fixture por par

Node ejecutó la fuente anterior de 47b1dd0b y el helper actual, alternando
orden. Cada variante fue sólo dry-run; se compararon archivos, índices,
refs locales/remotas y registro antes/después. Sólo remotos file sintéticos.

| Par | Orden | Antes, ms | Después, ms | Reducción |
|---|---|---:|---:|---:|
| 1 | antes / después | 2.537 | 1.723 | 32,1 % |
| 2 | después / antes | 3.105 | 2.579 | 16,9 % |
| 3 | antes / después | 2.792 | 2.090 | 25,1 % |

En todos los pares: 72→52 procesos, 24→4 consultas de rutas, cero errores
Git y evidencia idéntica. Reducción del tiempo medio: 24,2 %. La variación
del host no desaparece: esto demuestra menor trabajo y mejora en estos
tres pares, no garantiza un SLA de diez segundos bajo cualquier carga.
El primer build general coincidió con la medición; se informa esa condición.

Los repositorios sintéticos se retiraron mediante su cleanup existente,
que valida ruta absoluta, padre temporal, token y ausencia de enlaces.
Ningún worktree real, rama real o configuración Git común fue retirado.

## Validación final local

Las 52 pruebas CLI existentes pasaron sin cambios: 52/52, 132,71 s, exit 0.
La suite completa pasó 6.936/6.936, 545 archivos, 214,59 s, exit 0,
con configuración original: sin retries manuales posteriores al correctivo,
sin maxWorkers alternativo ni timeout aumentado. Docs/index368, numeración,
lint focal, diff-check, gobernanza28 y componentes5 aprobados. Un comando
manual apuntó a check-governance.mjs inexistente; se corrigió invocando
pnpm governance:check (build-governance-capsule.mjs), que pasó realmente.
El gate anterior ya aprobó 168 contratos SQL,
concurrencia PostgreSQL y rebuild423; E2E terminó con 150 aprobados,
18 omitidos y dos timeouts globales de 480 s aceptados con aviso por el
arnés anterior. No se demuestra causa WebKit sólo por ese mensaje.
Build terminó correctamente: 158 páginas y postbuild, tsconfig restaurado.
Ese gate terminó exit 1 por los timeouts unitarios previos; 15/16 pasos
ejecutados, migrations-applied SKIP por falta de credenciales. No se afirma
un segundo gate completo ni se convierte la omisión en verificación Cloud.

## Continuidad y permisos

Conservar este correctivo separado del commit47b1dd0b. Después de verificar
el arnés, sigue la cola local: soft delete Portal; cierre E2E y replay;
RBAC/Portal restantes, specs, logs, CSP y medición web. No nuevas elecciones.
El objetivo automático sigue blocked; no se altera por vías alternativas.
Checklist original: 56/106, 52,8 %. Este slice no añade casillas al denominador.
Sin push, main, deploy, migración Cloud, datos reales ni limpieza final.

Lectura remota final: saneamiento70812835 y main2a2e81bf, sin cambios.
Principal22cec0c2 limpio; exactamente dos worktrees reales conservados.
