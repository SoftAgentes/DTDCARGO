# Cierre · patrones UX, SDD-0118 EOL y dependencias CMP-01

| Control | Valor |
|---|---|
| Estado | CERRADO |
| Fecha | 2026-07-29 |
| Tarea y rol | Gobernanza5 · worker aislado con publicación autorizada |
| Rama | `codex/sdd-0180-ux-patterns` |
| Worktree | `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\sdd-0180-ux-patterns` |
| Base | `origin/main@37332f54` |
| Publicado hasta | `origin/main@4f3ac28c` antes de este recibo |

## Alcance cerrado

1. REV-SGE-014 formaliza formularios, tabs, menus/listboxes y comboboxes.
2. SDD-0180 implementa tabs accesibles en Fiscal.
3. SDD-0181 completa teclado, foco y colisión de selectores canónicos.
4. SDD-0182 implementa validación progresiva de identidad en Club.
5. REV-AUD-030 hace portable el gate SDD-0118 entre LF y CRLF.
6. REV-SGE-015 valida dependencias CMP-01 y alinea `ConfirmDialog` con BTN-01
   v1.1 sin abrir schema v1.1 o el caso `deprecated`.
7. La revisión final corrige el foco con Tab de `SplitActionButton` y añade el
   caso ArrowLeft con wrap en Fiscal.

## Commits publicados

- `f7b1ac64` · REV-SGE-014;
- `de05310b` · SDD-0180;
- `05f8d3cb` · SDD-0181;
- `12865ce1` · SDD-0182;
- `3c9d6a96` · portabilidad EOL SDD-0118;
- `a5a31cd5` · dependencias y registro CMP-01;
- `4f3ac28c` · foco Tab de `SplitActionButton`.

El commit que contiene este recibo se publica inmediatamente después sobre
`origin/main` mediante fast-forward.

## Verificación

- suite focal final: 6 archivos, 33/33 pruebas verdes;
- suite global inicial: 302 archivos, 4.084/4.084 pruebas verdes;
- suite global posterior a las pruebas nuevas: 4.085 pruebas verdes y un único
  timeout de 5 s en el escaneo estático `shipment-public.test.ts`; repetido
  aislado pasó 10/10 en 4,18 s;
- build exacto posterior al primer push: Next 16/Turbopack verde, 152 páginas
  estáticas;
- typecheck verde;
- ESLint proporcional: 0 errores; conserva un warning preexistente en la carga
  de `localStorage` de `SplitActionButton`;
- `docs:check`, `components:check`, SDD-0118 `--check` y `diff --check` verdes;
- `package.json` y `pnpm-lock.yaml` sin cambios.

## Efectos externos y límites

- Git: fast-forward `37332f54..4f3ac28c` publicado en `origin/main`;
- Supabase/Cloud: no ejecutado;
- Vercel/deploy: no ejecutado;
- migraciones: ningún archivo ni aplicación;
- PII/filas de negocio: no leídas;
- CMP-01 schema v1.1, caso `deprecated`, D1, D2–D5 y PLG-P3: cerrados.

## Otras tareas y trabajo ajeno

La inspección de tareas mostró sólo Gobernanza5 activa en DTDCargo. Las demás
tareas listadas estaban `notLoaded`; sus worktrees y ramas se preservaron. El
checkout principal y sus commits locales no se modificaron.

## Limpieza

No se eliminó ni podó ningún worktree. El usuario no autorizó limpieza y el
protocolo exige conservarlos mientras existan sesiones o propiedad incierta.

## Siguiente responsable

Ninguno para este lote. Cualquier CMP-01 v1.1, caso `deprecated`, D1, D2–D5 o
PLG-P3 requiere autorización y gate separados.
