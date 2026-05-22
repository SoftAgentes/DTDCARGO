import config from "@payload-config";
import { GRAPHQL_PLAYGROUND_GET } from "@payloadcms/next/routes";

/**
 * GraphQL Playground — UI interactivo para explorar el schema de Payload.
 *
 * Solo expuesto en dev. En producción retorna 404 para reducir attack surface
 * (information disclosure del schema). El endpoint real `/api/graphql` sigue
 * operativo en prod — solo se deshabilita la UI exploradora.
 *
 * Ver: `.gstack/security-reports/2026-05-21-cso-daily.md` REC-A.
 */
export const GET =
  process.env.NODE_ENV === "production"
    ? () => new Response("Not found", { status: 404 })
    : GRAPHQL_PLAYGROUND_GET(config);
