/**
 * SDD-0468 · Mensaje que el cliente le manda a su proveedor junto con el enlace
 * `/p/{token}` (Factura + Packing List, etiquetas y dirección del almacén).
 *
 * Por qué tiene esta forma:
 * - **Chino simplificado primero.** Lo lee el proveedor; el español va después
 *   para que el cliente sepa qué envió.
 * - **Tres pasos numerados, una acción por línea.** El mensaje anterior metía
 *   cuatro acciones en una sola oración.
 * - **Vocabulario de comercio exterior que un proveedor de Yiwu ya usa**
 *   (装箱单, 发票, 标签, 仓库) y cero inglés, salvo la marca y «Excel».
 * - **El enlace va en su propia línea**, justo después del bloque en chino:
 *   WeChat y WhatsApp lo vuelven tocable sin tener que buscarlo al final.
 *
 * Solo recibe la URL: el mensaje no lleva identidad del cliente (SDD-0443).
 */

export const PROVIDER_MESSAGE_ZH = {
  intro: "您好！请打开 DTD Cargo 链接，完成 3 步：",
  steps: [
    "1. 在线填写装箱单和发票（也可以用 Excel）",
    "2. 打印标签，每个箱子贴一张",
    "3. 按页面上的地址，把货送到仓库",
  ],
  linkLabel: "链接：",
} as const;

export const PROVIDER_MESSAGE_ES = {
  intro: "Hola. Abre el enlace de DTD Cargo y completa 3 pasos:",
  steps: [
    "1. Llena el packing list y la factura (en línea o en Excel)",
    "2. Imprime las etiquetas y pega una en cada caja",
    "3. Envía la mercancía al almacén que indica la página",
  ],
} as const;

/** Arma el mensaje bilingüe (中文 → enlace → español) listo para pegar en un chat. */
export function buildProviderLinkMessage(url: string): string {
  return [
    PROVIDER_MESSAGE_ZH.intro,
    ...PROVIDER_MESSAGE_ZH.steps,
    `${PROVIDER_MESSAGE_ZH.linkLabel}${url}`,
    "",
    PROVIDER_MESSAGE_ES.intro,
    ...PROVIDER_MESSAGE_ES.steps,
  ].join("\n");
}
