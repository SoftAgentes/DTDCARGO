---
sdd: 0332
title: Retener la llave KMS del backup WORM junto con el bucket
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0224
  - SDD-0235
confidencialidad: interno
---

# SDD-0332 — Retener la llave KMS del backup WORM junto con el bucket

## Estado real

El template AWS de adjuntos es una alternativa histórica supersedida por
Cloudflare R2 y no hay evidencia de un stack AWS conectado. Sigue siendo un
artefacto ejecutable del repositorio, por lo que debe ser seguro si se reutiliza.

## Problema

`BackupBucket` tenía `DeletionPolicy: Retain` y `UpdateReplacePolicy: Retain`,
Object Lock COMPLIANCE por diez años y cifrado mediante `BackupKey`. La llave
KMS no tenía esas políticas. Al quitarla de la plantilla o borrar el stack,
CloudFormation podía programar su eliminación; una llave pendiente de borrado
no puede participar en operaciones criptográficas y, una vez eliminada, los
objetos cifrados quedan irrecuperables.

## Decisión

1. Aplicar `DeletionPolicy: Retain` y `UpdateReplacePolicy: Retain` sólo a
   `BackupKey`.
2. Mantener `ScanKey` con su ciclo corto: su bucket no se retiene y los objetos
   de escaneo expiran.
3. Extender el contrato de infraestructura para que bucket y llave de backup
   conserven siempre las dos políticas.
4. No desplegar ni actualizar AWS desde esta tarea.

## Fuentes oficiales

- [CloudFormation · DeletionPolicy](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-deletionpolicy.html):
  `Retain` mantiene el recurso cuando se elimina el stack.
- [CloudFormation · UpdateReplacePolicy](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-updatereplacepolicy.html):
  `Retain` mantiene el recurso anterior cuando una actualización lo reemplaza.
- [CloudFormation · AWS::KMS::Key](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-kms-key.html):
  retirar una llave del stack programa su eliminación.
- [AWS KMS · eliminar llaves](https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys.html):
  una llave pendiente de eliminación no puede usarse en operaciones
  criptográficas.

## Gobernanza

- `cumplimiento`: fail-closed; la evidencia retenida conserva su dependencia de
  descifrado.
- `cumplimiento`: alcance mínimo; no se retiene la llave temporal de escaneo.
- `no aplica`: UI, datos de negocio, migración Supabase, Cloud o Producción.

## Allowlist exacta

- `infra/attachments-aws/cloudformation.json`
- `scripts/__tests__/attachments-aws-infra.test.mjs`
- `docs/legal/privacidad/aws-adjuntos-expediente-contractual.md`
- `docs/specs/0332-retener-llave-kms-backup/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/2026-09-02-kms-backup-retention-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- `BackupBucket` y `BackupKey` tienen ambas políticas `Retain`.
- `ScanKey` no se retiene.
- El template sigue siendo JSON válido.
- El test focal, documentación y diff pasan localmente.
- No existe despliegue AWS ejecutado por este cambio.

## Fuera de alcance

- Reactivar AWS como proveedor de backup.
- Modificar un stack existente o comprobar drift alojado.
- Confirmar cuenta, región, suscripción SNS, Object Lock o restore real.
