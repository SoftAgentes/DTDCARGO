# DTDCargo

Plataforma de **DTDCargo** (operador logístico China → Venezuela): sitio web público,
Studio ERP, portal de clientes y PWA.

## Qué contiene este repo

- **Sitio web público** (comercial e institucional).
- **Studio ERP** (`app/studio`), con Supabase propio.
- **Portal de clientes** (`/portal`).
- **PWA** para operarios.

El sitio público no importa `@/lib/studio`, `@/lib/db` ni `@supabase/*`: habla con el
ERP solo por HTTP (`NEXT_PUBLIC_HAILUWAY_API`). El puente compartido vive en `lib/shared/`.
Las reglas de arquitectura y dominio están en
[`docs/engineering/project-rules.md`](docs/engineering/project-rules.md).

## Stack

- **Next.js 16** App Router + **TypeScript** + **Tailwind v4** + **React 19**
- **pnpm** para packages
- **Servidor propio** (VPS de Contabo): cada merge a `main` se publica solo cuando
  su imagen y el CI quedan en verde
  ([`docs/runbooks/publicacion-automatica-web.md`](docs/runbooks/publicacion-automatica-web.md)).
  Antes era Vercel, hoy en pausa.

## Estado

Producción corre en el VPS propio (Contabo) con la publicación congelada desde el
2026-11-01. El índice de specs está en [`docs/specs/README.md`](docs/specs/README.md).

## Más información

- Reglas del repositorio y flujo Director/Worker: [`AGENTS.md`](AGENTS.md)
- Documentación: [`docs/README.md`](docs/README.md)
