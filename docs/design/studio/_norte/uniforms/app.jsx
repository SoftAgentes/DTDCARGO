/* global React, window */
/* ── DTD-Cargo · Uniformes · App (lookbook de tarjetas) ────────────
   3 variantes de espalda (A/B/C) + línea por rol. Frente constante:
   isólogo pecho. Medidas en texto, sin cotas encima de la prenda.     */

const { DesignCanvas, DCSection, DCArtboard } = window;
const C = window.UniCard;

const TELA = {
  tee: 'Algodón peinado 180 g · jersey',
  polo: 'Piqué algodón 200 g',
  shirt: 'Oxford 130 g · polialgodón',
  vest: 'Ripstop poliéster · forro malla',
  cap: '6 gajos · gabardina algodón',
};
const TEC = {
  serigrafia: 'Serigrafía plastisol · 1–2 tintas',
  bordado: 'Bordado directo (pecho) · serigrafía (espalda)',
  dtf: 'DTF / transfer · full color (incluye QR)',
};
const EST = {
  tee: 'Pecho izq. 9 cm · espalda 26 cm',
  polo: 'Pecho izq. 9 cm · espalda 24 cm',
  shirt: 'Pecho izq. 8 cm bordado · espalda 22 cm',
  vest: 'Pecho 9 cm · espalda 26 cm',
  cap: 'Frontal 7 cm · centrado',
};

const NAVY = { fill: '#0F1E3D', colorName: 'Navy', dark: true };
const CREMA = { fill: '#F2F0EC', colorName: 'Crema', dark: false };
const WHITE = { fill: '#FFFFFF', colorName: 'Blanco', dark: false };

const T = 'XS · S · M · L · XL · XXL';
const T2 = 'S · M · L · XL · XXL';

function App() {
  return (
    <DesignCanvas>
      {/* 3 variantes de espalda (misma camiseta navy) */}
      <DCSection id="sistema" title="Sistema · 3 variantes de espalda" subtitle="El FRENTE es constante (isólogo en el pecho). Cambia la ESPALDA. Elige la dirección — la aplico a toda la línea.">
        <DCArtboard id="var-a" label="A · Institucional" width={680} height={720}>
          <C codigo="DTD-UNI-A" prenda="Camiseta cuello redondo" rol="Variante A · wordmark + tagline" {...NAVY}
            garmentKey="tee" fabric={TELA.tee} tecnica={TEC.serigrafia} estampado={EST.tee} tallas={T} variant="A" />
        </DCArtboard>
        <DCArtboard id="var-b" label="B · Captación (QR)" width={680} height={720}>
          <C codigo="DTD-UNI-B" prenda="Camiseta cuello redondo" rol="Variante B · isólogo + QR + dominio" {...NAVY}
            garmentKey="tee" fabric={TELA.tee} tecnica={TEC.dtf} estampado={EST.tee} tallas={T} variant="B" />
        </DCArtboard>
        <DCArtboard id="var-c" label="C · Bilingüe (China)" width={680} height={720}>
          <C codigo="DTD-UNI-C" prenda="Camiseta cuello redondo" rol="Variante C · 门到门 + ruta bilingüe" {...NAVY}
            garmentKey="tee" fabric={TELA.tee} tecnica={TEC.serigrafia} estampado={EST.tee} tallas={T} variant="C" />
        </DCArtboard>
      </DCSection>

      {/* Línea por rol */}
      <DCSection id="roles" title="Línea por rol" subtitle="Mezcla de color por área: operario en navy, oficina en crema. El equipo de China lleva la variante bilingüe.">
        <DCArtboard id="rol-estiba" label="Estiba / Almacén" width={680} height={720}>
          <C codigo="DTD-UNI-OP-01" prenda="Camiseta cuello redondo" rol="Estiba / almacén · Venezuela" {...NAVY}
            garmentKey="tee" fabric={TELA.tee} tecnica={TEC.serigrafia} estampado={EST.tee} tallas={T2} variant="A" />
        </DCArtboard>
        <DCArtboard id="rol-chaleco" label="Estiba · Chaleco" width={680} height={720}>
          <C codigo="DTD-UNI-OP-02" prenda="Chaleco logístico" rol="Estiba / supervisión · alta visibilidad" {...NAVY}
            garmentKey="vest" fabric={TELA.vest} tecnica={TEC.bordado} estampado={EST.vest} tallas={T2} variant="A" />
        </DCArtboard>
        <DCArtboard id="rol-oficina" label="Oficina / Admin" width={680} height={720}>
          <C codigo="DTD-UNI-OF-01" prenda="Polo piqué" rol="Oficina / administración" {...CREMA}
            garmentKey="polo" fabric={TELA.polo} tecnica={TEC.bordado} estampado={EST.polo} tallas={T} variant="A" />
        </DCArtboard>
        <DCArtboard id="rol-comercial" label="Comercial / Ventas" width={680} height={720}>
          <C codigo="DTD-UNI-CO-01" prenda="Polo piqué" rol="Comercial / ventas · contacto con cliente" {...NAVY}
            garmentKey="polo" fabric={TELA.polo} tecnica={TEC.dtf} estampado={EST.polo} tallas={T} variant="B" />
        </DCArtboard>
        <DCArtboard id="rol-ceo" label="CEO / Dirección" width={680} height={720}>
          <C codigo="DTD-UNI-CEO-01" prenda="Camisa formal" rol="CEO / dirección · representación" {...WHITE}
            garmentKey="shirt" fabric={TELA.shirt} tecnica={TEC.bordado} estampado={EST.shirt} tallas={T2} variant="A" />
        </DCArtboard>
        <DCArtboard id="rol-china" label="Equipo China · Bilingüe" width={680} height={720}>
          <C codigo="DTD-UNI-CN-01" prenda="Camiseta cuello redondo" rol="Inspección / compras · China 中国" {...NAVY}
            garmentKey="tee" fabric={TELA.tee} tecnica={TEC.serigrafia} estampado={EST.tee} tallas={T2} variant="C" />
        </DCArtboard>
      </DCSection>

      {/* Accesorio */}
      <DCSection id="accesorio" title="Accesorio" subtitle="Gorra común a todos los equipos.">
        <DCArtboard id="gorra-navy" label="Gorra · Navy" width={680} height={560}>
          <C codigo="DTD-UNI-CAP-01" prenda="Gorra · 6 gajos" rol="Todos los equipos · accesorio" {...NAVY}
            garmentKey="cap" fabric={TELA.cap} tecnica={TEC.bordado} estampado={EST.cap} tallas="Única · ajuste posterior" variant="A" />
        </DCArtboard>
        <DCArtboard id="gorra-crema" label="Gorra · Crema" width={680} height={560}>
          <C codigo="DTD-UNI-CAP-02" prenda="Gorra · 6 gajos" rol="Todos los equipos · accesorio" {...CREMA}
            garmentKey="cap" fabric={TELA.cap} tecnica={TEC.bordado} estampado={EST.cap} tallas="Única · ajuste posterior" variant="A" />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
