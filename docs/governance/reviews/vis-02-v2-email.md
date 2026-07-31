# VIS-02 Gate V2 · email

| Control | Valor |
|---|---|
| Revisión | REV-VIS-004 |
| SDD | [SDD-0175](../../specs/0175-vis-02-tipografia-voz-idioma/spec.md) |
| Fecha | 2026-07-30 |
| Resultado | aprobado en un slice formal |

## Alcance

El gate crea una pila inline canónica para clientes de correo y migra un solo
consumidor real: las firmas del módulo Mailing.

- `es` y `en` conservan Archivo con fallback de sistema;
- `zh` se serializa como `lang="zh-CN"`;
- la firma formal `zh-CN` usa Noto Serif SC y cae primero a Noto Sans SC;
- nombre/cargo chinos comparten el bloque documental;
- marca, datos y firma siguen diferenciados sin depender sólo de la fuente;
- preview, envío inmediato y envío programado pasan el mismo `lang`.

Los demás renderers continúan inventariados como deuda por slices. No se
reescribieron correos, templates almacenados ni envíos vivos.

## Evidencia

Pruebas contractuales cubren orden de fallback, español/inglés, `lang` y
ausencia de Song Ti en una firma española. No se enviaron emails reales ni se
llamó Resend.
