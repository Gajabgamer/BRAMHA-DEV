import SectionHeader from "../ui/SectionHeader";

const testimonials = [
  {
    stars: "★★★★★",
    quote: "I only wanted one movie for a Friday night. Paying ₹39 once felt way smarter than another monthly subscription.",
    author: "Alok Sharma · Student"
  },
  {
    stars: "★★★★★",
    quote: "The timer made the rental feel super clear. I knew exactly how long I had left and finished the film the next afternoon.",
    author: "Priya Mehta · Working Professional"
  },
  {
    stars: "★★★★☆",
    quote: "Search, rent, pay, and watch all happen in one flow. It feels like a real product, not just a concept page.",
    author: "Rahul Verma · Freelancer"
  }
];

export default function TestimonialsSection() {
  return (
    <section className="section-wrap bg-deep">
      <div className="section-container">
        <SectionHeader
          label="Happy Watchers"
          title="WHAT PEOPLE"
          accent="SAY"
          copy="Keeping social proof from the original concept helps the prototype still feel like a launch-ready consumer brand."
        />

        <div className="grid gap-5 lg:grid-cols-3">
          {testimonials.map((item) => (
            <article key={item.author} className="surface-card p-7">
              <div className="tracking-[0.2em] text-gold">{item.stars}</div>
              <p className="mt-4 font-serif text-base italic leading-8 text-text">{item.quote}</p>
              <div className="mt-5 text-sm text-white">{item.author}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
