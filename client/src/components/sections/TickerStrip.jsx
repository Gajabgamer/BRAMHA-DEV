export default function TickerStrip() {
  const items = [
    "NO MONTHLY FEES",
    "PAY ONLY FOR WHAT YOU WATCH",
    "24 HOUR INSTANT ACCESS",
    "STARTING AT ₹30",
    "500+ MOVIES ON DEMAND",
    "UPI & CARD PAYMENTS",
    "NIGHT OFFERS ON SELECT TITLES"
  ];

  return (
    <div className="overflow-hidden bg-gold py-3 text-ink">
      <div className="ticker-track">
        {[...items, ...items].map((item, index) => (
          <span key={`${item}-${index}`} className="inline-flex items-center gap-4 px-6 font-display text-base tracking-[0.16em]">
            {item}
            <span className="h-1.5 w-1.5 rounded-full bg-ink/60" />
          </span>
        ))}
      </div>
    </div>
  );
}
