import SectionHeader from "../ui/SectionHeader";

const pricingTiers = [
  {
    title: "Classic",
    price: "₹30",
    text: "Timeless hits and catalog favorites.",
    features: ["HD streaming", "1 device", "Subtitles included", "24 hour access"]
  },
  {
    title: "New Release",
    price: "₹49",
    text: "Fresh releases and weekend blockbusters.",
    badge: "Most Popular",
    featured: true,
    features: ["Full HD streaming", "2 devices", "Pause and resume", "Priority discovery placement"]
  },
  {
    title: "Premium 4K",
    price: "₹80",
    text: "Best picture, audio, and premium titles.",
    features: ["4K + Dolby audio", "3 devices", "Download support ready", "Premium release slate"]
  }
];

export default function PricingSection() {
  return (
    <section id="pricing" className="section-wrap">
      <div className="section-container">
        <SectionHeader
          label="Transparent Rates"
          title="SIMPLE"
          accent="PRICING"
          copy="Pricing stays in the ₹30 to ₹80 range with one promotional layer: night pricing on selected films."
        />

        <div className="grid gap-5 lg:grid-cols-3">
          {pricingTiers.map((tier) => (
            <article key={tier.title} className={`surface-card relative overflow-hidden p-7 ${tier.featured ? "border-gold/25 bg-card-raised" : ""}`}>
              {tier.badge ? (
                <div className="absolute left-1/2 top-0 -translate-x-1/2 rounded-b-xl bg-gold px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink">
                  {tier.badge}
                </div>
              ) : null}
              <h3 className="text-xl font-semibold text-white">{tier.title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted">{tier.text}</p>
              <div className="mt-5 font-display text-6xl leading-none tracking-[0.04em] text-gold">{tier.price}</div>
              <ul className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm text-muted">
                {tier.features.map((feature) => (
                  <li key={feature} className="relative pl-5 before:absolute before:left-0 before:text-gold before:content-['✓']">
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
