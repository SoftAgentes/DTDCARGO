# Adjuntos de Bitácora · SDD-0411 / 0443 · evidencia local

Fecha: 2026-09-04

Alcance: helper documental, bucket Bitácora y PostgreSQL desechable

Fuera de alcance: Cloud, datos reales, push, `main`, despliegue y limpieza

## Hallazgo reproducido

Después de 0442, `bitacora_task` caía en la compatibilidad abierta del helper.
Soporte, aunque es read-only en la aplicación, obtenía autorización de edición.
Las policies del bucket `bitacora` sólo comparaban el primer segmento del path
con el tenant, por lo que el mismo rol podía insertar y borrar objetos mediante
acceso directo a Storage.

## Correctivo preparado

0443 añade `bitacora_task → bitacora` con los seis roles de vista de la matriz y
la regla transversal que impide editar a Soporte. Las policies de inserción,
lectura y borrado del bucket ahora consumen el mismo autorizador en modo
`edit/view/edit`, respectivamente. El alcance incluye los paths
`bitacora_task` y `bitacora_meeting` porque ambos pertenecen al módulo y comparten
el bucket.

Las Server Actions ya tenían `moduleEditDenial("bitacora")`; no fue necesario
duplicar código de aplicación. El mapa interno sigue sin `EXECUTE` para roles de
API.

## Evidencia ejecutada

- RED causal: Soporte registra metadata y escribe/borrar un objeto del bucket.
- GREEN focal: Soporte lee pero no edita; Operaciones conserva adjuntos y audio.
- Overrides: Marketing queda sin lectura/escritura cuando se cierra; un override
  positivo no permite edición a Soporte.
- Regresión: Naviera, Proveedores, finanzas, usuario desactivado, acción
  desconocida y cruce de tenant.
- SQL completo: 185/185 contratos con rollback total.
- Rebuild: 440 migraciones inventariadas, 422 aplicadas desde cero, 18
  sólo-ledger, 219 tablas y dos tenants del arnés.
- Numeración revalidada contra 15 refs: spec 0411 y migración 0443 libres.

## Estado y límites

- Local: **CORRECTO** para metadata y bucket de Bitácora.
- Producción: **NO VERIFICABLE**; 0443 no se aplicó ni se consultó Cloud.
- Checklist original: 57/106 (53,8 %); el frente documental sigue abierto.
- Migraciones locales preparadas: 43 (0401–0443), tomando 0400 como último
  ledger alojado verificado previamente.
