// Punto generador público de P-256 (SEC2), no clave privada ni VAPID real.
export const SYNTHETIC_PUSH_KEYS = {
  p256dh: Buffer.from(
    "04" +
    "6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296" +
    "4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5",
    "hex",
  ).toString("base64url"),
  auth: Buffer.from("000102030405060708090a0b0c0d0e0f", "hex").toString("base64url"),
};

export function validPushSubscription(label = "test") {
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/synthetic-${label}`,
    keys: { ...SYNTHETIC_PUSH_KEYS },
  };
}

export const INVALID_PUSH_ENDPOINTS = [
  ["localhost HTTPS", "https://localhost/synthetic"],
  ["loopback IPv4", "https://127.0.0.1/synthetic"],
  ["loopback IPv6", "https://[::1]/synthetic"],
  ["IPv4 privada", "https://10.0.0.1/synthetic"],
  ["host ajeno", "https://example.invalid/synthetic"],
  ["sufijo engañoso", "https://fcm.googleapis.com.example.invalid/synthetic"],
  ["prefijo engañoso", "https://evilpush.apple.com/synthetic"],
  ["puerto no estándar", "https://fcm.googleapis.com:8443/synthetic"],
  ["credenciales", "https://user:password@fcm.googleapis.com/synthetic"],
  ["HTTP", "http://fcm.googleapis.com/synthetic"],
  ["fragmento", "https://fcm.googleapis.com/synthetic#secret"],
  ["espacio", "https://fcm.googleapis.com/synthetic value"],
  ["control", "https://fcm.googleapis.com/synthetic\nvalue"],
  ["endpoint excesivo", `https://fcm.googleapis.com/${"a".repeat(4096)}`],
  ["autoridad ambigua con tres barras", "https:///fcm.googleapis.com/synthetic"],
  ["autoridad ambigua con cuatro barras", "https:////fcm.googleapis.com/synthetic"],
  ["autoridad ambigua codificada", "https://%66cm.googleapis.com/synthetic"],
] as const;
