# Acciones de Usuarios · SDD-0435 · evidencia local

Fecha: 2026-09-04

Alcance: invitación de miembros, envío de enlace de acceso y cambio de correo
en las Server Actions de Studio Usuarios

Fuera de alcance: usuarios, membresías, Auth, correos o datos reales, permisos,
RLS, migraciones, Cloud, push, `main`, despliegues y limpieza

## Resultado

Las tres acciones crean un logger canónico por invocación. Los ocho
`console.error` libres se reemplazaron por eventos con correlador, operación,
etapa y error saneado. Los eventos no incluyen email, ID de usuario, token,
enlace, payload ni mensaje libre del proveedor.

La semántica se conserva: la guarda previa y los envíos siguen siendo
best-effort; un fallo al guardar el token conserva su respuesta; y la revocación
posterior al cambio de correo continúa sin revertir el cambio ya aceptado por
Auth.

## Evidencia ejecutada

- RED: 13/13 fallos confirmaron los ocho logs y los eventos/loggers ausentes.
- GREEN focal: 50/50 pruebas del contrato y acciones de Usuarios.
- Suite completa: 7.504/7.504 pruebas en 601 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: código 0, TypeScript y 158 rutas generadas.

El build usó una URL Supabase sintética cerrada en localhost; sus avisos de
fetch eran esperados. No consultó ni modificó usuarios, correos o datos reales.

## Estado

- SDD-0435: **done local**.
- Logs retirados en este slice: **8**.
- Inventario legacy medido: **166** logs libres en `lib/studio`, `app/studio`,
  `app/api/studio` y `app/api/m`, excluyendo pruebas.
- Checklist general: **60/106 (56,6 %)**; la casilla de logs permanece abierta.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: no ejecutadas; el worktree se conserva.
