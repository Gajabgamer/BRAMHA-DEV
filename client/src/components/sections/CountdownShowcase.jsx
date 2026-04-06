import SectionHeader from "../ui/SectionHeader";

export default function CountdownShowcase({ countdown }) {
  const units = [
    { label: "Hours", value: countdown.hours },
    { label: "Minutes", value: countdown.minutes },
    { label: "Seconds", value: countdown.seconds }
  ];

  return (
    <section className="border-y border-white/10 bg-[linear-gradient(135deg,#0d111a,#131a27)] px-5 py-20 md:px-8">
      <div className="section-container grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,560px)] lg:items-center">
        <SectionHeader
          label="Core Feature"
          title="YOUR CLOCK IS"
          accent="TICKING"
          copy="A shared timer language runs through the product: cards, dashboard rows, and payment success all point to the same 24-hour access rule."
        />

        <div className="grid overflow-hidden rounded-[28px] border border-gold/20 bg-ink shadow-glow sm:grid-cols-3">
          {units.map((unit, index) => (
            <div
              key={unit.label}
              className={`px-6 py-8 text-center ${index < units.length - 1 ? "border-b border-white/10 sm:border-b-0 sm:border-r" : ""}`}
            >
              <div className="font-display text-[clamp(3rem,8vw,5rem)] leading-none text-gold">{unit.value}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.18em] text-muted">{unit.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
