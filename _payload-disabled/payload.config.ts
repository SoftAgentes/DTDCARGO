import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import sharp from "sharp";

import { Users } from "./payload/collections/Users";
import { Media } from "./payload/collections/Media";
import { Services } from "./payload/collections/Services";
import { Posts } from "./payload/collections/Posts";
import { Pages } from "./payload/collections/Pages";
import { Contact } from "./payload/globals/Contact";
import { SiteSettings } from "./payload/globals/SiteSettings";
import { Navigation } from "./payload/globals/Navigation";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

/**
 * Resolución segura del PAYLOAD_SECRET.
 *
 * - PRODUCCIÓN: throw fail-fast si la env var falta o es muy corta (<32 chars).
 *   Esto previene que el deploy a prod corra con un secret hardcoded conocido,
 *   que permitiría a un atacante forjar cookies JWT de admin.
 * - DEV/TEST: usa un secret aleatorio efímero por proceso. Trade-off: las
 *   sesiones admin se invalidan al reiniciar dev server. Para sesiones
 *   persistentes en dev, setear PAYLOAD_SECRET en .env.local con:
 *     openssl rand -hex 32
 *
 * Por qué no hay fallback hardcoded: si accidentalmente se deploya a prod
 * sin la env var, un string conocido en el código fuente permite forgery.
 * Fail-fast > fail-silent. Ver `.gstack/security-reports/2026-05-21-cso-daily.md`.
 */
function resolvePayloadSecret(): string {
  const s = process.env.PAYLOAD_SECRET;
  if (s && s.length >= 32) return s;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PAYLOAD_SECRET env var is missing or too short (<32 chars in production). " +
        "Generate one with: openssl rand -hex 32",
    );
  }

  console.warn(
    "\n[payload] PAYLOAD_SECRET not set — using ephemeral random secret.\n" +
      "[payload] Admin sessions will reset on dev server restart.\n" +
      "[payload] For persistent sessions add to .env.local:\n" +
      "[payload]   PAYLOAD_SECRET=$(openssl rand -hex 32)\n",
  );
  return randomBytes(32).toString("hex");
}

export default buildConfig({
  admin: {
    user: "users",
    meta: {
      titleSuffix: " · DTD·CARGO Admin",
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Services, Posts, Pages],
  globals: [Contact, SiteSettings, Navigation],
  editor: lexicalEditor(),
  secret: resolvePayloadSecret(),
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL ?? "",
    },
  }),
  plugins: [
    s3Storage({
      collections: {
        media: {
          // Las imágenes se sirven directo desde Supabase Storage (público).
          // disablePayloadAccessControl: true,
        },
      },
      bucket: process.env.S3_BUCKET ?? "media",
      config: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION ?? "eu-west-2",
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
        },
      },
    }),
  ],
  sharp,
});
