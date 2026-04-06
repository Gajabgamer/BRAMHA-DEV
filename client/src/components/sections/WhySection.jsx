import SectionHeader from "../ui/SectionHeader";

const points = [
  {
    title: "No Wasted Money",
    text: "Users pay only when they watch, which makes the platform far more believable for student and casual-viewer segments."
  },
  {
    title: "Fast to Decision",
    text: "Movie cards carry the key details upfront: title, genre, runtime, price, trailer, and rent action in one compact layout."
  },
  {
    title: "Backend Ready",
    text: "Buttons and forms include integration hooks so the UI can transition from mock state to real APIs without a redesign."
  },
  {
    title: "Built Around the 24hr Window",
    text: "Timers, badges, and summary cards reinforce the platform's unique rule, which makes the experience feel product-specific instead of generic."
  }
];

export default function WhySection() {
  return (
    <section id="why-movie24" className="section-wrap">
      <div className="section-container grid gap-8 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <div className="surface-card relative min-h-[420px] overflow-hidden rounded-[28px] border-white/10 bg-[linear-gradient(150deg,rgba(17,22,33,0.96),rgba(13,17,26,0.96))] p-12 text-center">
          <div className="absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative">
            <div className="section-label">Viewer Signal</div>
            <div className="mt-4 font-display text-[8rem] leading-none text-gold">82%</div>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-muted">
              of casual viewers prefer pay-per-movie access over subscriptions for one-off watch nights.
            </p>
          </div>
        </div>

        <div>
          <SectionHeader label="Our Advantage" title="WHY" accent="MOVIE24?" />
          <div className="grid gap-4">
            {points.map((point) => (
              <article key={point.title} className="surface-card p-6">
                <h3 className="text-lg font-semibold text-white">{point.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted">{point.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
