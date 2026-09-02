# Cierre técnico · SDD-0360 foco del selector de destino

Fecha: 2026-09-02

Rol: worker
Estado: CERRADO TÉCNICAMENTE EN RAMA · CI ALOJADO PENDIENTE

## Identidad y alcance

- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`.
- Rama: `codex/saneamiento-integral`; padre `726a7118`.
- Base: `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
- Allowlist exacta: nueve archivos en `docs/specs/0360-destino-combobox-focus-race/spec.md`.
- No cambia catálogo, precios, estilos, persistencia, migraciones ni workflow.

## Causa y corrección

El segundo CI pasó TypeScript/Edge, pero falló un test al obtener `a` en vez de
`mara`. `requestAnimationFrame(input.select)` podía seleccionar las primeras
letras y la siguiente las reemplazaba. Retener el frame también reproducía
`Valencia (sede)mara` si la escritura comenzaba antes de seleccionar la etiqueta.

Se selecciona sincrónicamente al recibir foco y se conserva la selección sólo
en el mouseup inicial. La primera tecla/cambio/blur cancela esa corrección; los
clics posteriores respetan el cursor manual. No se añadió debounce ni espera.

## Evidencia

- RED determinista: 11 pasan / 2 fallan con el código original.
- GREEN: 13/13, incluidos los 10 tests existentes sin relajar expectativas.
- Suite completa: 527 archivos / 5.961 pruebas, 108,94 s, exit 0.
- ESLint, TypeScript sin caché incremental y old-space 4096: exit 0.
- Numeración: 352 specs / 413 migraciones; colisiones históricas preservadas.
- Componentes: 5 fuentes; gobernanza: 28 políticas aprobadas, cápsula vigente.
- Playwright CLI, navegador aislado sobre `http://127.0.0.1:3460/tarifas`:
  `mara` conserva cursor 4/4; Escape restaura Valencia; edición intermedia
  produce `maxra`; Enter selecciona Maracaibo y cierra el listbox.
- Supabase apuntó a un servidor local deny-only en 13460, sin `.env` ni
  credenciales reales. Los cuatro errores de consola fueron los rechazos
  esperados de tarifas/configuración; no surgieron errores nuevos de interacción.
- Se cerraron navegador y ambos servidores; puertos libres. Sólo se retiraron
  los cuatro logs/snapshots temporales creados por esta prueba, regenerables.
- Build aislado sin secretos: 158 páginas, postbuild y restauración de
  `tsconfig.json` correctos. `git diff --check` aprobado; docs finales se
  regeneran junto al estado `done` de esta spec.

## Gates separados

El PR #21 sigue en borrador; el tercer CI debe medir este cambio. Las 18
migraciones pendientes y las 10 RPC ausentes impiden tratar el PR como un
release aprobado. No hubo merge, promoción, Cloud ni escritura de negocio.
