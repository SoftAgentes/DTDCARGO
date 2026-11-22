/** SDD-0704 §8 · El motivo de cada cambio: queda en la auditoría para siempre, así que va sin datos personales. */
export function CampoMotivo({ id }: { id: string }) {
  return (
    <>
      <label className="studio-label" htmlFor={id}>
        Motivo
      </label>
      <input
        id={id}
        name="motivo"
        className="studio-input"
        required
        minLength={4}
        maxLength={200}
        autoComplete="off"
        aria-describedby={`${id}-ayuda`}
      />
      <p id={`${id}-ayuda`} style={{ font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
        Queda en la auditoría. Sin correos, teléfonos ni datos de clientes.
      </p>
    </>
  );
}
