# Despliegue manual de DTD · 2026-10-25

Sam autorizó desplegar por etapas con respaldo, rollback y validación, sin migraciones, escrituras de negocio o intervención de Orca, manteniendo bloqueados los automáticos.

- Resultado: PASÓ. Fuente compilada: 929cabf51fa2ae565ffaf4f42e2c1d95529d3e3b. Base conservada: 8e9e0f505322cd57b3230cce6b16b45b5554cb8a.
- Imagen activa: sha256:cd041ea4405858c1eaf887554051b03bd5ebf6ce6624e414b2c2e3a09d603305; Node v24.22.1, UID 1000; healthy.
- Validación exacta del corte: 80 unitarios aprobados, 0 omitidos; build con compilación sin red. 
- Esquema y ledger idénticos antes/después: 499 migraciones; ninguna ejecutada. No hubo restauración de BD ni pruebas financieras en datos existentes.
- Respaldo cifrado: /var/backups/manual-node-release-20261025-01a16fc9/DTD. Dump/TOC y hashes verificados; archivo de imagen anterior cargado de prueba sin iniciar contenedores. Transferencia externa: PASÓ.
- Otros 49 contenedores preservados al cierre global; 30 procesos Orca, incluidos 13 Node, con iguales identidades. Checkouts principales no movidos.
- PUBLICABLE_CONGELADO=si; publicadores DTD/Loop desactivados; dtd-cargo-publicar.timer disabled/inactive. Sin timer de despliegue nuevo ni reactivación programada.

Primer intento revertido correctamente por un control que incluyó el cambio esperado del selector de imagen. Segundo intento aprobado; fallos y recuperación conservados.

El corte mantiene los archivos de aplicación de la versión servida y aplica solo los cambios aprobados de Node/dependencias. No representa un despliegue íntegro de main; Loop requiere conciliar con main los cambios que ya estaban publicados antes de reactivar automatismos.

La evidencia completa, limitaciones y comandos de recuperación quedan en outputs/Nodejs-despliegue-manual-2026-10-25 y /var/backups/manual-node-release-20261025-01a16fc9. Los documentos posteriores al build no cambian la fuente de la imagen indicada arriba.
