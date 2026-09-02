---
sdd: "0365"
title: Operaciones de reportes de pago con resultado veraz y evidencia conservada
status: in-progress
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0134", "0350", "0357", "0364"]
confidencialidad: interno
---

# SDD-0365 — Seguridad de los comandos de reportes de pago

## Objetivo y evidencia

SDD-0364 corrigió la identidad/tenant, no los comandos. La reproducción
independiente ejecutó las acciones, consultas, identidad y upload reales con
I/O sintético: tres regresiones rojas y dos controles positivos verdes sobre
e9d49980. Un UPDATE sin coincidencias devuelve éxito; un error del conteo se
convierte en cero; el alta continúa subiendo, insertando y notificando.

El caller de `createProofSignedUrl` autoriza el reporte con RLS, pero firma su
path mediante admin sin comprobar tenant/factura/reporte. Además, el alta
elimina el comprobante ante cualquier error del INSERT, incluso cuando no
puede saberse si el servidor confirmó la transacción antes de perder respuesta.
No se usaron datos ni objetos reales. No se afirma exfiltración demostrada.

`pnpm sdd:next` consultó 15 refs y ofreció 0365/0421. Esta primera etapa no
crea migraciones ni reserva 0421: se debe volver a numerar antes del SQL.

## Plan por incrementos dentro del mismo objetivo

### Etapa 1 · resultado veraz y protección de evidencia

- [x] Reproducir fallo del conteo y éxito falso sin cambiar runtime.
- [x] Rechazar conteo desconocido, inválido o fallido antes de cualquier efecto.
- [x] No declarar cancelación exitosa sin una fila afectada; conservar RLS de
  sesión, sin recurrir a admin para salvar el rechazo de la cancelación propia.
- [x] Firmar sólo paths canónicos del tenant, factura y reporte previamente
  autorizados por el caller. No tocar ni corregir archivos históricos.
- [x] Conservar comprobantes ante resultado incierto del INSERT y explicar al
  cliente que revise el estado antes de repetir. No programar purgas.
- [x] RED/GREEN focal, suite completa, TypeScript, lint, build y gates locales.

Es un incremento de contención completo y compatible con el schema existente,
no el cierre del comando de cancelación ni de la integridad financiera. No
crea nuevos caminos de escritura. El conteo sigue siendo una comprobación
previa, no una garantía atómica contra dos solicitudes concurrentes.

### Etapa 2 · comandos auditados y consumidores

- [ ] Definir contratos create/cancel/resolve y allowlist exacta antes de editar
  SQL/UI. Reproducción SQL independiente usando PostgreSQL desechable.
- [ ] Derivar actor/cliente/tenant de sesión activa y relaciones coherentes;
  sellar moneda/factura/estado/metadatos y validar pertenencia del comprobante.
- [ ] Crear bajo bloqueo de factura para garantizar tope de cinco pendientes.
  Cancelar sólo pendiente propio, conservando original y evidencia P3/P4.
- [ ] Confirmar/rechazar sólo accounting/admin con permiso vigente, motivo y
  auditoría atómica. Preservar la fórmula de SDD-0134: paid_amount/status,
  sin asientos contables nuevos ni cambios retroactivos de pagos.
- [ ] Idempotencia/reintentos verificables, resultado mínimo decodificado,
  error seguro y rollback de mutación si falla la auditoría.
- [ ] Adoptar confirmación y motivo con componentes canonical, reglas del
  Norte y pruebas de teclado/pendiente/error. No rediseñar pantallas.

### Etapa 3 · restricción y release

- [ ] Inventariar todos los escritores; retirar DML directo y RPC heredada
  después de los consumidores nuevos, sin fallback inseguro de aplicación.
- [ ] Restringir lectura financiera interna, preservando Portal propio e
  historia. Probar principales duales, archivo del padre y revocación de vínculo.
- [ ] Separar expansión → aplicación/smoke → restricción. Cada migración con
  autorización nominal, no una aplicación en lote ni un deploy implícito.

## Allowlist exacta · etapa 1

- `app/portal/(app)/facturas/[code]/reportar/actions.ts`.
- `lib/portal/payment-report-queries.ts`.
- `lib/portal/payment-proof.ts`.
- `app/studio/(app)/facturacion/[code]/page.tsx` (sólo argumentos de firma).
- `lib/portal/__tests__/payment-report-actions.test.ts` (reproducción independiente).
- `lib/portal/__tests__/payment-proof-scope.test.ts` (reproducción independiente).
- `docs/specs/0365-payment-report-command-safety/spec.md`.
- `docs/specs/README.md` (generado).
- `docs/audits/2026-09-02-codex-arranque-checklist.md`.
- `.agents/handoffs/2026-09-02-payment-report-command-safety-close.md`.
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`.

No SQL, ACL, Storage policy, tokens, componentes compartidos, env, paquetes ni
datos de producción en esta etapa. Los archivos futuros no quedan autorizados
por esta allowlist; se amplía con su contrato antes de cada incremento.

## Gobierno, privacidad y límites

- SGE-00/ERR-01: un error no equivale a cero o éxito; mostrar resultado incierto
  sin detalles SQL ni sugerir repetir ciegamente una operación financiera.
- AUD-01/AUD-02: esta contención no agrega escritores ni eventos. La auditoría
  de los comandos heredados sigue como no conformidad; debe ser atómica en
  etapa 2, sin declarar conforme una mutación por tener tests verdes.
- MP-01: conservar comprobantes P4; no eliminar ante confirmación desconocida.
  Los uploads no vinculados quedan privados y requieren revisión autorizada
  de disposición (MP-D6), no limpieza automática desde esta acción.
- BTN-01/FRM-01: no se añade ni rediseña UI en etapa 1. El error usa la misma
  salida del formulario; confirmar/cancelar con motivo corresponde a etapa 2.
- Datos: mismos monto/fecha/método/nota/comprobante y destinatarios actuales.
  Sin nuevos campos de PII ni logging del contenido. La firma restringe acceso.
  Las obligaciones de retención/backups/proveedores no se verifican con estos
  tests y no se afirma cumplimiento jurídico.

## Verificación y estado

Etapa 1 implementada. El RED ampliado reprodujo 31 fallos/8 controles verdes.
GREEN independiente: 62 casos nuevos; otros dos casos de LF/CRLF confirmaron
que no había ese bypass adicional. Suite completa: 6.094 pruebas/532 archivos
verdes antes de esos dos casos extra; TypeScript sin caché también pasó.
No se atribuye el positivo simulado count=1 a una cancelación real bajo RLS.
Build aislado aprobado: 158 páginas, postbuild, restauración de tsconfig y
limpieza de .next-verify. Sin credenciales ni smoke alojado; los mensajes de
configuración ausente no demuestran que los catálogos de producción funcionen.
Etapa 1 técnicamente verificada; etapas 2/3 y publicación permanecen abiertas.

## Gate constitucional · etapa 1

| Principio | Clasificación y evidencia |
|---|---|
| SGE-00.01 | cumplimiento: mismos verbos; error distinto de éxito |
| SGE-00.02 | cumplimiento: no borrar comprobante de resultado incierto |
| SGE-00.03 | no conformidad heredada: confirmación/motivo R3 pendientes de etapa 2; sin nuevo control destructivo |
| SGE-00.04 | no conformidad heredada: comandos sin auditoría atómica, etapa 2 |
| SGE-00.05 | cumplimiento: contexto de firma derivado de factura/reporte autorizados |
| SGE-00.06 | cumplimiento: conteo desconocido corta antes de efectos |
| SGE-00.07 | cumplimiento acotado: sin éxito falso, conteo desconocido ni reintento ciego; idempotencia pendiente en etapa 2 |
| SGE-00.08 | no aplica: sin pasos ni pantalla nueva en esta etapa |
| SGE-00.09 | cumplimiento: helpers existentes; sin cliente elevado adicional |
| SGE-00.10 | no aplica: sin cambios de layout, tokens ni componentes |
| SGE-00.11 | cumplimiento: errores seguros con códigos, no detalles internos |
| SGE-00.12 | cumplimiento: Cloud/publicación/integración permanecen separados |

La no conformidad heredada NO es una excepción aprobada ni un pase del módulo:
este incremento reduce efectos inseguros, no habilita un nuevo escritor. La
adopción de comandos y sus controles R3/AUD-01 sigue obligatoria antes del cierre.

Fuente técnica consultada: [funciones de Supabase](https://supabase.com/docs/guides/database/functions).
La futura elevación del comando requiere permisos mínimos y search_path vacío;
no se instala ni actualiza Supabase en este incremento.
