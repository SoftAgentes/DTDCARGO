/**
 * White-label documental (SDD-0255): lo que llega al cliente de un aliado no
 * puede decir DTD Cargo.
 *
 * ⚖️ No es cosmética. En el caso Greaves la nota de entrega de un cliente de
 * aliado salió con membrete DoorTuDoor, y el propio expediente concluye que eso
 * debilita la defensa de "aliado independiente".
 *
 * La prueba es un BARRIDO sobre un registro de salidas, no un test por archivo:
 * agregar una salida que ve el cliente final y no registrarla acá es el fallo
 * que se repite. Por eso hay además un contador fijo — si alguien saca una
 * superficie del registro, el contador grita.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { resolveBrand, type BrandContext } from "@/lib/shared/brand-context";
import { Label, type WarehouseAddress } from "../_components/Label";
import type { LabelClient } from "../page";

/**
 * Lo que delata a la casa.
 *
 * ⚠️ Dos cosas que a primera vista parecen marca y NO lo son — se dejaron fuera
 * a propósito, y las dos las destapó este mismo test:
 *
 * · `国际货运` = "transporte internacional de carga". Es el descriptor del rubro,
 *   no una marca. La etiqueta de un aliado dice `Dynasty Cargo 国际货运` y eso
 *   está bien: el proveedor chino necesita entender qué es. Sólo delata cuando
 *   va pegado a "DTD Cargo", y para eso ya está la primera alternativa.
 *
 * · `DTDLogistic` es el WeChat de la BODEGA. Decisión del founder (2026-08-13):
 *   es una cuenta neutral de bodega y se deja como está por ahora. Cuando se
 *   parametrice, agrégalo acá.
 */
const MARCA_DTD = /DTD[\s·-]?Cargo|DTDCARGO|DoorTuDoor|DTD Services|dtdcargo\.com/i;

/**
 * ⚠️ La marca del cliente directo se obtiene por `resolveBrand(null)`, que es el
 * camino REAL, y no importando `DTD_BRAND` a mano. Verificado con mutación el
 * 2026-08-13: con la constante importada, romper el fallback de `resolveBrand`
 * dejaba el test en VERDE — el escenario no discriminaba.
 */
const DIRECTO: BrandContext = resolveBrand(null);

const ALIADO: BrandContext = resolveBrand({
  trade_name: "Dynasty Cargo",
  brand_name: "Dynasty Cargo",
  brand_primary: "#1B4D3E",
  brand_secondary: "#0A2A22",
  support_email: "hola@dynastycargo.com",
  support_whatsapp: "+58 412 000 0000",
  support_website: "dynastycargo.com",
  hide_dtd_brand: true,
});

/**
 * La bodega REAL de Yiwu. Su dirección, contacto y WeChat son dato operativo:
 * la caja llega físicamente ahí, así que NO se repintan ni para un aliado.
 */
const WAREHOUSE: WarehouseAddress = {
  code: "YW1",
  city: "Yiwu",
  city_cn: "义乌",
  address_cn: "浙江省义乌市稠江街道 物流中心 3 号仓",
  contact_cn: "林冠",
  phone: "+86 000 0000 0000",
  wechat: "DTDLogistic",
};

function clienteDe(brand: BrandContext, markbox: string): LabelClient {
  return { markbox, name: "Comercial Los Andes", brand };
}

/**
 * El registro. Cada entrada devuelve el texto FINAL que ve el cliente.
 * ⚠️ Al sumar una salida de cara al cliente, agrégala acá Y sube TOTAL_SALIDAS.
 */
const SALIDAS: {
  nombre: string;
  render: (brand: BrandContext, markbox: string) => string;
}[] = [
  {
    nombre: "Etiqueta de la caja · formato compacto (A4-8up, el default)",
    render: (brand, markbox) =>
      renderToStaticMarkup(
        <Label
          format={{ id: "a4-8up", label: "A4 8up", cell: { w: 70, h: 65 }, cols: 2, rows: 4 } as never}
          client={clienteDe(brand, markbox)}
          warehouse={WAREHOUSE}
          boxIndex={1}
          totalBoxes={3}
          qr={false}
          brand={brand}
        />,
      ),
  },
  {
    nombre: "Etiqueta de la caja · formato grande",
    render: (brand, markbox) =>
      renderToStaticMarkup(
        <Label
          format={{ id: "a4-2up", label: "A4 2up", cell: { w: 190, h: 130 }, cols: 1, rows: 2 } as never}
          client={clienteDe(brand, markbox)}
          warehouse={WAREHOUSE}
          boxIndex={2}
          totalBoxes={3}
          qr={false}
          brand={brand}
        />,
      ),
  },
];

const TOTAL_SALIDAS = 2;

describe("white-label documental · SDD-0255", () => {
  it("el registro no perdió superficies", () => {
    // Sin este contador se puede reducir la cobertura sin que nada grite.
    expect(SALIDAS).toHaveLength(TOTAL_SALIDAS);
  });

  for (const salida of SALIDAS) {
    it(`⭐ ${salida.nombre} · cliente de aliado → SIN marca DTD`, () => {
      expect(salida.render(ALIADO, "DC-FA-1232")).not.toMatch(MARCA_DTD);
    });

    it(`${salida.nombre} · cliente directo → CON marca DTD`, () => {
      // La mitad que evita el daño colateral: el 100% de los clientes de hoy.
      // ⚠️ Se ancla al NOMBRE, no a un /DTD Cargo/ suelto: la línea en chino
      // también contiene "DTD Cargo", así que un match libre pasaba aunque el
      // nombre latino estuviera roto. Verificado con mutación el 2026-08-13.
      const html = salida.render(DIRECTO, "DTD-9058");
      expect(html).toContain("SHIPPING TO · DTD Cargo");
      expect(html).toContain("寄至：DTD Cargo 国际货运");
    });

    it(`${salida.nombre} · imprime la forma IMPRESA del Shipping Mark`, () => {
      const html = salida.render(ALIADO, "DC-FA-1232");
      expect(html).toContain("FA-1232");
      // Las dos mitades: sin ésta, un renderer que imprima la cadena entera pasa.
      expect(html).not.toContain("DC-FA-1232");
    });
  }

  it("un cliente directo conserva su código tal cual", () => {
    expect(SALIDAS[0].render(DIRECTO, "DTD-9058")).toContain("DTD-9058");
  });

  it("y un código de VENDEDOR del legado también", () => {
    // Los 361 DTD-<letra>NNN no son cadenas de aliado: se imprimen como siempre.
    expect(SALIDAS[0].render(DIRECTO, "DTD-A101")).toContain("DTD-A101");
  });
});
