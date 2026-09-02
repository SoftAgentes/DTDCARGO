# DTD Cargo

Aplicación logística y administrativa de **DTD Cargo** para la operación
China ↔ Venezuela. Un solo paquete Next.js reúne el sitio público, el ERP
interno, el Portal del cliente, la PWA móvil y el Back/CMS.

No es un proyecto nuevo ni un scaffold: el repositorio contiene operación,
migraciones, contratos SQL y especificaciones SDD activas.

## Empezar aquí

| Necesidad | Fuente |
|---|---|
| Reglas para agentes y límites operativos | [`AGENTS.md`](AGENTS.md) |
| Marca, UI y materiales visuales | [`BRAND.md`](BRAND.md) y [`docs/design/README.md`](docs/design/README.md) |
| Arquitectura | [`docs/architecture/`](docs/architecture/) |
| Índice y ubicación de documentos | [`docs/README.md`](docs/README.md) |
| Especificaciones funcionales | [`docs/specs/README.md`](docs/specs/README.md) |
| Auditorías y estado medido | [`docs/audits/`](docs/audits/) |
| Cierres y continuidad entre agentes | [`.agents/handoffs/`](.agents/handoffs/) |

`CLAUDE.md` sólo importa `AGENTS.md`; `AGENTS.md` es la fuente operativa.

## Superficies

| Superficie | Rutas principales | Backend |
|---|---|---|
| Sitio público | `app/` fuera de Studio, Portal, móvil y Back | HTTP al ERP HailuWay externo; integraciones públicas declaradas |
| Studio ERP | `app/studio/` y `app/api/studio/` | Supabase propio y Server Actions |
| Portal cliente | `app/portal/` | Supabase propio |
| PWA móvil | `app/m/{cn,ve,erp}/` | Supabase; puede reutilizar `lib/studio/` |
| Back/CMS | `app/back/` | Supabase mediante `lib/back/` |

La frontera público ↔ ERP es obligatoria: el sitio público no importa
`@/lib/studio`, `@/lib/db` ni `@supabase/*`. ESLint la valida como error. El
único puente de código permitido es `lib/shared/`; las operaciones de negocio
cruzan por HTTP.

## Stack

Next.js 16 · React 19 · TypeScript strict · Tailwind CSS v4 · pnpm · Supabase
(Postgres/Auth/Storage) · Vitest · Playwright · Vercel.

## Desarrollo local

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
node scripts/verify.mjs
```

`node scripts/verify.mjs` es el cierre canónico. Un paso marcado `SKIP` informa
que faltó entorno; no equivale a una validación completa.

## Reglas de cambio

- Los cambios de comportamiento usan SDD y allowlist exacta.
- El número de una spec o migración se obtiene con `pnpm sdd:next`; no se
  adivina mirando el checkout local.
- Una migración aplicada nunca se renumera.
- Secretos, PII de clientes y documentos financieros crudos nunca entran a Git.
- Commit, push, Cloud, Producción, Vercel y limpieza son gates independientes.
- El trabajo paralelo vive en worktrees aislados y usa commits atómicos y
  staging selectivo; nunca `git add -A`.

La configuración de entorno está documentada en [`.env.example`](.env.example).
