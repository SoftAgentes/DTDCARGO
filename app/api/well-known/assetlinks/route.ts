import { NextResponse } from "next/server";

/**
 * Digital Asset Links — vincula el APK TWA (`com.dtdcargo.operario`) con
 * dtdcargo.com para que la PWA del operario (`/m/*`) abra a pantalla completa,
 * sin la barra de URL del navegador.
 *
 * Servido en `/.well-known/assetlinks.json` vía rewrite (ver next.config.ts).
 *
 * El fingerprint SHA-256 sale del keystore de FIRMA del APK:
 *   - bubblewrap lo imprime al hacer `build`, o
 *   - keytool -list -v -keystore <keystore> -alias <alias> | grep SHA256
 * Setearlo en Vercel (env de prod) como DTD_ANDROID_CERT_SHA256. Soporta
 * varios (coma-separados) para debug+release o rotación de llave.
 *
 * Sin la env var → 404: Android no verifica y la PWA abre con barra de URL
 * (sigue funcionando, solo no es full-screen). Runbook:
 *   docs/runbooks/setup-android-apk.md
 */

export const dynamic = "force-dynamic";

const PACKAGE_NAME = "com.dtdcargo.operario";

export async function GET() {
  const raw = process.env.DTD_ANDROID_CERT_SHA256?.trim();
  if (!raw) {
    return NextResponse.json(
      { error: "assetlinks no configurado — falta DTD_ANDROID_CERT_SHA256" },
      { status: 404 },
    );
  }

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
