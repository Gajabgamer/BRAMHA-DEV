export default function SectionHeader({ label, title, accent, copy }) {
  return (
    <div className="section-header">
      <div>
        <span className="section-label">{label}</span>
        <h2 className="section-title">
          {title} {accent ? <em className="text-gold not-italic">{accent}</em> : null}
        </h2>
      </div>
      {copy ? <p className="section-copy">{copy}</p> : null}
    </div>
  );
}
