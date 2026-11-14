import { X509Certificate } from "node:crypto";
import { request as httpsRequest, type RequestOptions } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import { Readable, pipeline } from "node:stream";
import { rootCertificates } from "node:tls";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

/**
 * SDD-0569 · TLS de la fuente BCV.
 *
 * El servidor de www.bcv.org.ve entrega su hoja (*.bcv.org.ve, emitida por
 * «Sectigo Public Server Authentication CA DV R36») junto con OTRO intermedio
 * («Sectigo RSA Domain Validation Secure Server CA»), así que el fetch nativo
 * falla con UNABLE_TO_VERIFY_LEAF_SIGNATURE (medido el 2026-10-21 y el 2026-11-14).
 *
 * Arreglo: se agrega al almacén de confianza el intermedio que falta, fijado por
 * su huella SHA-256. La verificación queda COMPLETA: cadena hasta la raíz pública
 * «Sectigo Public Server Authentication Root R46» del almacén de Node, nombre del
 * host y vigencia. Nunca se apaga la verificación (`rejectUnauthorized` queda en
 * true) y no se toca la variable de entorno que la apaga ni el fetch global.
 *
 * Si el BCV renueva su hoja con otro intermedio, la conexión vuelve a fallar
 * cerrada (SOURCE_UNAVAILABLE): no publica nada.
 */
export const BCV_INTERMEDIATE_SHA256 =
  "8C:54:C3:34:B6:6B:A4:E4:26:77:2A:F4:A3:F9:13:6C:19:A1:AE:C7:29:FD:B2:8C:53:5C:07:A5:A4:EF:22:E0";

/** Certificado público de Sectigo (crt.sectigo.com), vigente hasta 2036-03-21. */
export const BCV_INTERMEDIATE_PEM = `-----BEGIN CERTIFICATE-----
MIIGTDCCBDSgAwIBAgIQOXpmzCdWNi4NqofKbqvjsTANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgRFYgUjM2MIIBojANBgkqhkiG9w0B
AQEFAAOCAY8AMIIBigKCAYEAljZf2HIz7+SPUPQCQObZYcrxLTHYdf1ZtMRe7Yeq
RPSwygz16qJ9cAWtWNTcuICc++p8Dct7zNGxCpqmEtqifO7NvuB5dEVexXn9RFFH
12Hm+NtPRQgXIFjx6MSJcNWuVO3XGE57L1mHlcQYj+g4hny90aFh2SCZCDEVkAja
EMMfYPKuCjHuuF+bzHFb/9gV8P9+ekcHENF2nR1efGWSKwnfG5RawlkaQDpRtZTm
M64TIsv/r7cyFO4nSjs1jLdXYdz5q3a4L0NoabZfbdxVb+CUEHfB0bpulZQtH1Rv
38e/lIdP7OTTIlZh6OYL6NhxP8So0/sht/4J9mqIGxRFc0/pC8suja+wcIUna0HB
pXKfXTKpzgis+zmXDL06ASJf5E4A2/m+Hp6b84sfPAwQ766rI65mh50S0Di9E3Pn
2WcaJc+PILsBmYpgtmgWTR9eV9otfKRUBfzHUHcVgarub/XluEpRlTtZudU5xbFN
xx/DgMrXLUAPaI60fZ6wA+PTAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk
lfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQUaMASFhgOr872h6YyV6NGUV3LBycw
DgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI
KwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgEw
VAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv
UHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH
AQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp
Z29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF
BzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA
YtOC9Fy+TqECFw40IospI92kLGgoSZGPOSQXMBqmsGWZUQ7rux7cj1du6d9rD6C8
ze1B2eQjkrGkIL/OF1s7vSmgYVafsRoZd/IHUrkoQvX8FZwUsmPu7amgBfaY3g+d
q1x0jNGKb6I6Bzdl6LgMD9qxp+3i7GQOnd9J8LFSietY6Z4jUBzVoOoz8iAU84OF
h2HhAuiPw1ai0VnY38RTI+8kepGWVfGxfBWzwH9uIjeooIeaosVFvE8cmYUB4TSH
5dUyD0jHct2+8ceKEtIoFU/FfHq/mDaVnvcDCZXtIgitdMFQdMZaVehmObyhRdDD
4NQCs0gaI9AAgFj4L9QtkARzhQLNyRf87Kln+YU0lgCGr9HLg3rGO8q+Y4ppLsOd
unQZ6ZxPNGIfOApbPVf5hCe58EZwiWdHIMn9lPP6+F404y8NNugbQixBber+x536
WrZhFZLjEkhp7fFXf9r32rNPfb74X/U90Bdy4lzp3+X1ukh1BuMxA/EEhDoTOS3l
7ABvc7BYSQubQ2490OcdkIzUh3ZwDrakMVrbaTxUM2p24N6dB+ns2zptWCva6jzW
r8IWKIMxzxLPv5Kt3ePKcUdvkBU/smqujSczTzzSjIoR5QqQA6lN1ZRSnuHIWCvh
JEltkYnTAH41QJ6SAWO66GrrUESwN/cgZzL4JLEqz1Y=
-----END CERTIFICATE-----
`;

let trusted: readonly string[] | undefined;

/** Raíces públicas de Node + `pem`; lanza BCV_TLS_PIN_MISMATCH si su huella no es `pin`. */
export function bcvTrustedCaFor(pem: string, pin: string): readonly string[] {
  if (new X509Certificate(pem).fingerprint256 !== pin) throw new Error("BCV_TLS_PIN_MISMATCH");
  return Object.freeze([...rootCertificates, pem]);
}

/** El almacén de producción: el intermedio fijado de arriba, verificado una vez. */
export function bcvTrustedCa(): readonly string[] {
  trusted ??= bcvTrustedCaFor(BCV_INTERMEDIATE_PEM, BCV_INTERMEDIATE_SHA256);
  return trusted;
}

type SendRequest = (url: URL, options: RequestOptions, onResponse: (response: IncomingMessage) => void) => ClientRequest;

function decoded(response: IncomingMessage): { stream: Readable; changed: boolean } {
  const encoding = String(response.headers["content-encoding"] ?? "identity").trim().toLowerCase();
  const done = (error: Error | null) => { if (error) response.destroy(error); };
  if (encoding === "identity" || encoding === "") return { stream: response, changed: false };
  if (encoding === "gzip" || encoding === "x-gzip") return { stream: pipeline(response, createGunzip(), done), changed: true };
  if (encoding === "deflate") return { stream: pipeline(response, createInflate(), done), changed: true };
  if (encoding === "br") return { stream: pipeline(response, createBrotliDecompress(), done), changed: true };
  response.destroy();
  throw new TypeError("BCV_TLS_UNSUPPORTED_ENCODING");
}

/**
 * fetch mínimo sobre node:https con el almacén de arriba. Sin redirects
 * automáticos (los decide fetchBcvObservation), sin cookies ni agente compartido.
 */
export function bcvTlsFetch(deps: { request?: SendRequest; trustedCa?: () => readonly string[] } = {}): typeof globalThis.fetch {
  const send = deps.request ?? (httpsRequest as unknown as SendRequest);
  const trustedCa = deps.trustedCa ?? bcvTrustedCa;
  return (input, init) => new Promise<Response>((resolve, reject) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.protocol !== "https:") { reject(new TypeError("BCV_TLS_HTTPS_ONLY")); return; }
    const signal = init?.signal ?? undefined;
    if (signal?.aborted) { reject(signal.reason); return; }
    const method = init?.method ?? "GET";
    const headers = Object.fromEntries(new Headers(init?.headers));
    headers["accept-encoding"] ??= "gzip, deflate, br";
    const request = send(url, { method, headers, ca: [...trustedCa()], servername: url.hostname,
      rejectUnauthorized: true, agent: false, signal }, response => {
      try {
        const { stream, changed } = decoded(response);
        const out = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          for (const item of [value ?? []].flat()) out.append(name, item);
        }
        if (changed) { out.delete("content-encoding"); out.delete("content-length"); }
        const status = response.statusCode ?? 0;
        const empty = method === "HEAD" || status === 204 || status === 304;
        if (empty) response.resume();
        resolve(new Response(empty ? null : Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status, headers: out }));
      } catch (error) { reject(error); }
    });
    request.on("error", reject);
    request.end();
  });
}
