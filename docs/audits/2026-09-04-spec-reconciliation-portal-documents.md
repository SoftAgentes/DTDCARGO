# Reconciliación de specs · documentos y comandos Portal

Fecha: 2026-09-04

Alcance auditado: SDD-0287 y SDD-0300

Fuera de alcance: datos reales, Cloud, push, `main`, despliegue y limpieza

## SDD-0287 · estado de cuenta PDF

Resultado: **cerrada**.

- Código y spec ya estaban contenidos en `origin/main` (`c6098e1b`).
- Portal deriva el cliente de la sesión y no acepta un identificador ajeno por
  URL; Studio añade el permiso de lectura de Facturas y las consultas usan el
  cliente autenticado bajo RLS.
- Se añadió el hueco que faltaba en pruebas: render real a buffer PDF. La salida
  inicia con `%PDF-` y supera 1.000 bytes.
- Focal: 27/27. Los gates compartidos del HEAD anterior permanecen 7.308/7.308,
  build 158, TypeScript y lint correctos.

## SDD-0300 · borrar estimados

Resultado: **permanece abierta**.

El código y las pruebas sintéticas están en `origin/main`, pero la propia spec
declara que no se midió el comportamiento de un rol no administrador contra
`studio_role_module_overrides`. Cerrar el front-matter ocultaría ese hueco. No
se usó una identidad real ni se modificó un estimado para forzar el cierre.

## Inventario posterior

- 302 specs `done`, una `superseded` y 102 abiertas.
- Abiertas: 87 `in-progress`, ocho `proposed`, cuatro `approved`, tres `draft`.
- Reconciliación amplia: 3/105 cerradas en esta continuación; 102 pendientes.
- Checklist general: 59/106 (55,7 %), sin crear casillas artificiales.
