# Cierre local · SDD-0332 · retención de la llave KMS de backup

Fecha: 2026-09-02
Rama: `codex/saneamiento-integral`
Base remota medida: `origin/main` en `2a2e81bf554dbe7bd4f05170847e8f02e988d320`

## Resultado

El template AWS histórico retiene ahora la llave KMS del backup junto con el
bucket WORM, tanto al borrar el stack como al reemplazar el recurso. La llave de
escaneo temporal no cambió. No se ejecutó AWS.

## Evidencia

- Antes: `BackupBucket` tenía las dos políticas `Retain`; `BackupKey`, ninguna.
- AWS documenta que quitar una `AWS::KMS::Key` de un stack programa su borrado y
  que una llave en ese estado no puede usarse criptográficamente.
- La alternativa AWS está supersedida por R2 y no conectada; el fix protege el
  artefacto ejecutable si vuelve a utilizarse, no declara estado alojado.

## Verificación local

- Test focal: 1 archivo / 7 tests, todos verdes; el propio test parsea el JSON.
- `docs:check`: verde; índice regenerado en 324 specs.
- `git diff --check`: verde.
- El gate canónico completo inmediatamente anterior quedó sin fallos en 14 de
  15 pasos; `migrations-applied` fue el único paso no medido por falta de
  credenciales. Este lote no modifica app, DB ni dependencias.

## Gates externos

- No se desplegó ni actualizó ningún stack.
- Cuenta, región, drift, SNS, Object Lock y restore AWS siguen no verificables.
