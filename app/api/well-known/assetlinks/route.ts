import { NextResponse } from "next/server";

/**
 * Digital Asset Links — vincula el APK TWA (`com.dtdcargo.twa`) con
 * dtdcargo.com para que la PWA del operario (`/m/*`) abra a pantalla completa,
 * sin la barra de URL del navegador.
 *
 * Servido en `/.well-known/assetlinks.json` vía rewrite (ver next.config.ts).
 *
 * El fingerprint SHA-256 del keystore de firma viene horneado como
 * DEFAULT_SHA256 (es PÚBLICO — se sirve en este mismo endpoint, no es secreto).
 * Override por env DTD_ANDROID_CERT_SHA256 (coma-separado) si rotás el keystore.
 * Runbook: docs/runbooks/setup-android-apk.md
 */

export const dynamic = "force-dynamic";

// Debe matchear el applicationId del APK (PWABuilder usó su default `*.twa`).
const PACKAGE_NAME = "com.dtdcargo.twa";

// Fingerprint del keystore que firmó el APK (PWABuilder · 2026-05-31). Público.
const DEFAULT_SHA256 =
  "D3:B3:5C:D3:1F:12:E0:88:D6:84:28:11:97:C5:C1:61:D9:A0:3B:42:47:EF:20:51:EA:A6:5F:86:DA:B2:9B:D3";

export async function GET() {
  const raw = process.env.DTD_ANDROID_CERT_SHA256?.trim() || DEFAULT_SHA256;

  const fingerprints = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: PACKAGE_NAME,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
