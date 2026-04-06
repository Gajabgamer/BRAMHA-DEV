import SectionHeader from "../ui/SectionHeader";

const steps = [
  {
    index: "01",
    title: "Create an Account",
    text: "Sign up with name, email, and password. The auth modal includes basic validation and mock POST /signup wiring."
  },
  {
    index: "02",
    title: "Browse and Preview",
    text: "Use search, genre filters, and trailer previews to find the exact title you want without any subscription pressure."
  },
  {
    index: "03",
    title: "Pay via UPI or Card",
    text: "The rental modal captures movie details, shows the live price, and simulates secure payment success for POST /rent-movie."
  },
  {
    index: "04",
    title: "Watch for 24 Hours",
    text: "Countdown badges appear on the grid, rentals dashboard, and the hero clock so the access window always feels tangible."
  }
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="section-wrap">
      <div className="section-container">
        <SectionHeader
          label="Simple Process"
          title="HOW IT"
          accent="WORKS"
          copy="The flow is intentionally short: create an account, rent one title, and watch instantly with a visible 24-hour expiry window."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <article key={step.index} className="surface-card relative overflow-hidden p-6">
              <div className="pointer-events-none absolute right-4 top-3 font-display text-7xl text-gold/5">{step.index}</div>
              <h3 className="relative text-xl font-semibold text-white">{step.title}</h3>
              <p className="relative mt-3 text-sm leading-7 text-muted">{step.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
