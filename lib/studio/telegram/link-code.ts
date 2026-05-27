/**
 * Genera un código random de 8 chars [A-Z0-9] (ej "K2X9PMQ4") para
 * el flow de linking de Telegram. Excluye chars confundibles (O, 0, I, 1).
 *
 * Usado en linkTelegramAccountAction. Validado contra unique index en
 * user_profiles.telegram_link_code.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTelegramLinkCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
