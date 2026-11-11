/**
 * Tarifario de Meta para WhatsApp Business, en USD (SDD-0585, paso 2.8).
 *
 * GENERADO: no se edita a mano. Sale de dos fuentes oficiales, leídas el 2026-10-30:
 *  - el archivo «USD list rates» de `developers.facebook.com/docs/whatsapp/pricing`
 *    («Cost per message in USD on the WhatsApp Business Platform, effective
 *    October 1, 2026»);
 *  - la tabla de prefijos «Pricing regions on the rate card — country calling codes» de
 *    la misma página.
 * Una tarifa nueva de Meta es un archivo nuevo con su fecha, no un cambio a este.
 *
 * Sin teléfonos ni datos de nadie: solo mercados, prefijos y precios publicados.
 */

export const FUENTE_TARIFA = {
  vigenteDesde: "2026-10-01",
  leidaEl: "2026-10-30",
  url: "https://developers.facebook.com/docs/whatsapp/pricing",
  archivo: "USD list rates",
} as const;

export interface TarifaMercado {
  marketing: number;
  utility: number;
  service: number;
}

/** Costo por mensaje en USD, por mercado del tarifario (47 filas, incluida «Other»). */
export const TARIFAS: Readonly<Record<string, TarifaMercado>> = {
  "Argentina": { marketing: 0.0618, utility: 0.026, service: 0.026 },
  "Bangladesh": { marketing: 0.0732, utility: 0.0037, service: 0.0037 },
  "Brazil": { marketing: 0.0625, utility: 0.0068, service: 0.0068 },
  "Chile": { marketing: 0.0889, utility: 0.02, service: 0.02 },
  "Colombia": { marketing: 0.0125, utility: 0.0008, service: 0.0008 },
  "Egypt": { marketing: 0.0644, utility: 0.0036, service: 0.0036 },
  "France": { marketing: 0.0859, utility: 0.03, service: 0.03 },
  "Germany": { marketing: 0.1365, utility: 0.055, service: 0.055 },
  "Hong Kong": { marketing: 0.0732, utility: 0.026, service: 0.026 },
  "Hungary": { marketing: 0.086, utility: 0.035, service: 0.035 },
  "India": { marketing: 0.0118, utility: 0.0014, service: 0.0014 },
  "Indonesia": { marketing: 0.0411, utility: 0.025, service: 0.025 },
  "Iraq": { marketing: 0.0341, utility: 0.0079, service: 0.0079 },
  "Israel": { marketing: 0.0353, utility: 0.0053, service: 0.0053 },
  "Italy": { marketing: 0.0795, utility: 0.03, service: 0.03 },
  "Kazakhstan": { marketing: 0.0604, utility: 0.018, service: 0.018 },
  "Kuwait": { marketing: 0.0792, utility: 0.044, service: 0.044 },
  "Malaysia": { marketing: 0.086, utility: 0.014, service: 0.014 },
  "Mexico": { marketing: 0.0397, utility: 0.0085, service: 0.0085 },
  "Morocco": { marketing: 0.0414, utility: 0.023, service: 0.023 },
  "Netherlands": { marketing: 0.1597, utility: 0.05, service: 0.05 },
  "Nepal": { marketing: 0.0732, utility: 0.0034, service: 0.0034 },
  "Nigeria": { marketing: 0.0516, utility: 0.0067, service: 0.0067 },
  "Oman": { marketing: 0.0341, utility: 0.0247, service: 0.0247 },
  "Pakistan": { marketing: 0.0473, utility: 0.015, service: 0.015 },
  "Peru": { marketing: 0.0703, utility: 0.03, service: 0.03 },
  "Poland": { marketing: 0.0366, utility: 0.0122, service: 0.0122 },
  "Qatar": { marketing: 0.0341, utility: 0.012, service: 0.012 },
  "Romania": { marketing: 0.086, utility: 0.029, service: 0.029 },
  "Russia": { marketing: 0.0802, utility: 0.04, service: 0.04 },
  "Saudi Arabia": { marketing: 0.0576, utility: 0.0107, service: 0.0107 },
  "Singapore": { marketing: 0.0732, utility: 0.016, service: 0.016 },
  "South Africa": { marketing: 0.0379, utility: 0.0095, service: 0.0095 },
  "Spain": { marketing: 0.0707, utility: 0.02, service: 0.02 },
  "Sri Lanka": { marketing: 0.0732, utility: 0.002, service: 0.002 },
  "Turkey": { marketing: 0.0109, utility: 0.0009, service: 0.0009 },
  "Ukraine": { marketing: 0.086, utility: 0.0298, service: 0.0298 },
  "United Arab Emirates": { marketing: 0.0576, utility: 0.0157, service: 0.0157 },
  "United Kingdom": { marketing: 0.0635, utility: 0.022, service: 0.022 },
  "North America": { marketing: 0.025, utility: 0.0034, service: 0.0034 },
  "Rest of Africa": { marketing: 0.0225, utility: 0.004, service: 0.004 },
  "Rest of Asia Pacific": { marketing: 0.0842, utility: 0.0113, service: 0.0113 },
  "Rest of Central & Eastern Europe": { marketing: 0.086, utility: 0.0212, service: 0.0212 },
  "Rest of Latin America": { marketing: 0.074, utility: 0.0113, service: 0.0113 },
  "Rest of Middle East": { marketing: 0.0392, utility: 0.0091, service: 0.0091 },
  "Rest of Western Europe": { marketing: 0.0592, utility: 0.0171, service: 0.0171 },
  "Other": { marketing: 0.0604, utility: 0.0077, service: 0.0077 },
};

/**
 * Prefijo E.164 (sin «+») → mercado del tarifario. Ordenado del más largo al más
 * corto: gana el primero que calza. Lo que no calza es «Other».
 */
export const PREFIJOS: ReadonlyArray<readonly [string, string]> = [
  ["1658", "Rest of Latin America"], // JM
  ["1787", "Rest of Latin America"], // PR
  ["1809", "Rest of Latin America"], // DO
  ["1829", "Rest of Latin America"], // DO
  ["1849", "Rest of Latin America"], // DO
  ["1876", "Rest of Latin America"], // JM
  ["1939", "Rest of Latin America"], // PR
  ["211", "Rest of Africa"], // SS
  ["212", "Morocco"], // MA
  ["213", "Rest of Africa"], // DZ
  ["216", "Rest of Africa"], // TN
  ["218", "Rest of Africa"], // LY
  ["220", "Rest of Africa"], // GM
  ["221", "Rest of Africa"], // SN
  ["222", "Rest of Africa"], // MR
  ["223", "Rest of Africa"], // ML
  ["225", "Rest of Africa"], // CI
  ["226", "Rest of Africa"], // BF
  ["227", "Rest of Africa"], // NE
  ["228", "Rest of Africa"], // TG
  ["229", "Rest of Africa"], // BJ
  ["231", "Rest of Africa"], // LR
  ["232", "Rest of Africa"], // SL
  ["233", "Rest of Africa"], // GH
  ["234", "Nigeria"], // NG
  ["235", "Rest of Africa"], // TD
  ["237", "Rest of Africa"], // CM
  ["241", "Rest of Africa"], // GA
  ["242", "Rest of Africa"], // CG
  ["244", "Rest of Africa"], // AO
  ["245", "Rest of Africa"], // GW
  ["249", "Rest of Africa"], // SD
  ["250", "Rest of Africa"], // RW
  ["251", "Rest of Africa"], // ET
  ["252", "Rest of Africa"], // SO
  ["254", "Rest of Africa"], // KE
  ["255", "Rest of Africa"], // TZ
  ["256", "Rest of Africa"], // UG
  ["257", "Rest of Africa"], // BI
  ["258", "Rest of Africa"], // MZ
  ["260", "Rest of Africa"], // ZM
  ["261", "Rest of Africa"], // MG
  ["263", "Rest of Africa"], // ZW
  ["264", "Rest of Africa"], // NA
  ["265", "Rest of Africa"], // MW
  ["266", "Rest of Africa"], // LS
  ["267", "Rest of Africa"], // BW
  ["268", "Rest of Africa"], // SZ
  ["291", "Rest of Africa"], // ER
  ["351", "Rest of Western Europe"], // PT
  ["353", "Rest of Western Europe"], // IE
  ["355", "Rest of Central & Eastern Europe"], // AL
  ["358", "Rest of Western Europe"], // FI
  ["359", "Rest of Central & Eastern Europe"], // BG
  ["370", "Rest of Central & Eastern Europe"], // LT
  ["371", "Rest of Central & Eastern Europe"], // LV
  ["373", "Rest of Central & Eastern Europe"], // MD
  ["374", "Rest of Central & Eastern Europe"], // AM
  ["375", "Rest of Central & Eastern Europe"], // BY
  ["380", "Ukraine"], // UA
  ["381", "Rest of Central & Eastern Europe"], // RS
  ["385", "Rest of Central & Eastern Europe"], // HR
  ["386", "Rest of Central & Eastern Europe"], // SI
  ["389", "Rest of Central & Eastern Europe"], // MK
  ["420", "Rest of Central & Eastern Europe"], // CZ
  ["421", "Rest of Central & Eastern Europe"], // SK
  ["502", "Rest of Latin America"], // GT
  ["503", "Rest of Latin America"], // SV
  ["504", "Rest of Latin America"], // HN
  ["505", "Rest of Latin America"], // NI
  ["506", "Rest of Latin America"], // CR
  ["507", "Rest of Latin America"], // PA
  ["509", "Rest of Latin America"], // HT
  ["591", "Rest of Latin America"], // BO
  ["593", "Rest of Latin America"], // EC
  ["595", "Rest of Latin America"], // PY
  ["598", "Rest of Latin America"], // UY
  ["675", "Rest of Asia Pacific"], // PG
  ["852", "Hong Kong"], // HK
  ["855", "Rest of Asia Pacific"], // KH
  ["856", "Rest of Asia Pacific"], // LA
  ["880", "Bangladesh"], // BD
  ["886", "Rest of Asia Pacific"], // TW
  ["961", "Rest of Middle East"], // LB
  ["962", "Rest of Middle East"], // JO
  ["964", "Iraq"], // IQ
  ["965", "Kuwait"], // KW
  ["966", "Saudi Arabia"], // SA
  ["967", "Rest of Middle East"], // YE
  ["968", "Oman"], // OM
  ["971", "United Arab Emirates"], // AE
  ["972", "Israel"], // IL
  ["973", "Rest of Middle East"], // BH
  ["974", "Qatar"], // QA
  ["976", "Rest of Asia Pacific"], // MN
  ["977", "Nepal"], // NP
  ["992", "Rest of Asia Pacific"], // TJ
  ["993", "Rest of Asia Pacific"], // TM
  ["994", "Rest of Central & Eastern Europe"], // AZ
  ["995", "Rest of Central & Eastern Europe"], // GE
  ["998", "Rest of Asia Pacific"], // UZ
  ["20", "Egypt"], // EG
  ["27", "South Africa"], // ZA
  ["30", "Rest of Central & Eastern Europe"], // GR
  ["31", "Netherlands"], // NL
  ["32", "Rest of Western Europe"], // BE
  ["33", "France"], // FR
  ["34", "Spain"], // ES
  ["36", "Hungary"], // HU
  ["39", "Italy"], // IT
  ["40", "Romania"], // RO
  ["41", "Rest of Western Europe"], // CH
  ["43", "Rest of Western Europe"], // AT
  ["44", "United Kingdom"], // GB
  ["45", "Rest of Western Europe"], // DK
  ["46", "Rest of Western Europe"], // SE
  ["47", "Rest of Western Europe"], // NO
  ["48", "Poland"], // PL
  ["49", "Germany"], // DE
  ["51", "Peru"], // PE
  ["52", "Mexico"], // MX
  ["54", "Argentina"], // AR
  ["55", "Brazil"], // BR
  ["56", "Chile"], // CL
  ["57", "Colombia"], // CO
  ["58", "Rest of Latin America"], // VE
  ["60", "Malaysia"], // MY
  ["61", "Rest of Asia Pacific"], // AU
  ["62", "Indonesia"], // ID
  ["63", "Rest of Asia Pacific"], // PH
  ["64", "Rest of Asia Pacific"], // NZ
  ["65", "Singapore"], // SG
  ["66", "Rest of Asia Pacific"], // TH
  ["76", "Kazakhstan"], // KZ
  ["77", "Kazakhstan"], // KZ
  ["81", "Rest of Asia Pacific"], // JP
  ["84", "Rest of Asia Pacific"], // VN
  ["86", "Rest of Asia Pacific"], // CN
  ["90", "Turkey"], // TR
  ["91", "India"], // IN
  ["92", "Pakistan"], // PK
  ["93", "Rest of Asia Pacific"], // AF
  ["94", "Sri Lanka"], // LK
  ["1", "North America"], // US
  ["7", "Russia"], // RU
];
