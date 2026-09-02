# Cierre local · SDD-0358 · Release compatible de Mailing

Fecha: 2026-09-02
Rol: worker
Rama: `codex/saneamiento-integral`
Base de este slice: `702de3f4`
Estado: terminado localmente; sin push, integración, deploy ni Cloud.

## Cambio y alcance

La migración 0410, creada en esta rama y todavía no publicada, mezclaba el alta
de `collections_mail_context` con el cierre del SELECT antiguo de `mail_logs`.
No permitía desplegar primero ni migrar primero sin romper un consumidor.

Ahora 0410 sólo agrega la RPC y preserva la lectura antigua. Después del deploy
y smoke de Cobranzas, 0415 cierra el SELECT a admin activo del tenant. La RPC no
cambia y la aplicación nueva no tiene fallback al SELECT crudo.

La allowlist exacta de diez archivos vive en SDD-0358. No se renumeró ni editó
una migración histórica aplicada; 0410 no existe en `origin/main` y el commit
que la introdujo sólo está contenido en esta rama local.

## Evidencia

- Contrato unitario de Cobranzas: 1 archivo / 3 pruebas aprobadas.
- PostgreSQL desechable: 156 contratos aprobados con rollback total. El test
  0415 reutiliza el fixture 0410 y prueba los mismos principales en la segunda
  fase; la RPC conserva idénticas respuestas mínimas en ambas.
- Rebuild: 412 migraciones, 394 desde cero y 18 sólo-ledger. Comprobación
  estructural de aislamiento de 219 tablas con dos tenants sintéticos.
- Baseline de aplicación previo, sin cambios TS/TSX en este slice: canónico de
  SDD-0357, 14/15 gates medidos sin fallos; 527 archivos / 5.957 unitarios;
  150 E2E aprobados / 18 omitidos; build de 158 páginas.
- `migrations-applied` sigue sin medir por ausencia deliberada de credenciales.
- Índice de specs regenerado; docs, numeración, gobernanza, componentes y
  `git diff --check` aprobados. Numeración: 350 specs / 412 migraciones.

## Gates restantes

1. Push de rama e integración conservan sus autorizaciones separadas.
2. Autorizar y aplicar 0410 individualmente, comprobar el facade en DB.
3. Autorizar deploy de la aplicación y comprobar Cobranzas/Mailing.
4. Autorizar y aplicar 0415 individualmente; verificar lectura admin-only.

El preflight de 0415 comprueba la RPC y policies, no certifica qué versión de
la aplicación está desplegada. Ningún paso alojado se ejecutó en este cierre.
