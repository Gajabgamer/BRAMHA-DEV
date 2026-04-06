import ModalShell from "../ui/ModalShell";

export default function RentModal({
  isOpen,
  movie,
  price,
  priceNote,
  paymentForm,
  feedback,
  loading,
  success,
  onClose,
  onChange,
  onSubmit,
  onWatchNow
}) {
  if (!movie) {
    return null;
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      {success ? (
        <div className="grid place-items-center gap-4 py-6 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/15 text-3xl text-emerald-200">
            ✓
          </div>
          <span className="section-label">Payment Confirmed</span>
          <h2 className="font-display text-5xl leading-none tracking-[0.04em] text-white">PAYMENT SUCCESSFUL 🎉</h2>
          <p className="max-w-lg text-sm leading-7 text-muted">
            Your rental is active for the next 24 hours. The movie now appears in My Rentals and Continue Watching.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <button className="btn-primary" type="button" onClick={onWatchNow}>
              Start Watching
            </button>
            <button className="btn-secondary" type="button" onClick={onClose}>
              Maybe Later
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <span className="section-label">24 Hour Rental</span>
            <h2 className="mt-2 font-display text-5xl leading-none tracking-[0.04em] text-white">RENT THIS MOVIE</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Review the title, pick a payment method, and start your watch window after purchase.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
            <img className="aspect-[2/3] w-full rounded-3xl object-cover shadow-soft" src={movie.poster} alt={`${movie.title} poster`} />
            <div>
              <div className="text-xs uppercase tracking-[0.14em] text-muted">
                {movie.genreLabel} · {movie.quality}
              </div>
              <h3 className="mt-3 text-3xl font-semibold text-white">{movie.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted">{movie.synopsis}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.14em] text-text">
                  {movie.duration}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.14em] text-text">
                  Access starts on first play
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-ink/80 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="section-label">Rental Price</div>
              <div className="mt-2 font-display text-5xl leading-none text-gold">₹{price}</div>
            </div>
            <div className="max-w-sm text-sm leading-7 text-muted">{priceNote}</div>
          </div>

          <form className="mt-6 space-y-5" onSubmit={onSubmit}>
            <fieldset className="space-y-3">
              <legend className="mb-3 font-semibold text-white">Payment Options</legend>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { value: "upi", label: "UPI", copy: "Pay using any UPI ID" },
                  { value: "card", label: "Card", copy: "Credit or debit card" }
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-2xl border p-4 transition ${
                      paymentForm.paymentMethod === option.value
                        ? "border-gold/35 bg-gold/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="paymentMethod"
                      value={option.value}
                      checked={paymentForm.paymentMethod === option.value}
                      onChange={(event) => onChange("paymentMethod", event.target.value)}
                    />
                    <div className="font-semibold text-white">{option.label}</div>
                    <div className="mt-1 text-sm text-muted">{option.copy}</div>
                  </label>
                ))}
              </div>
            </fieldset>

            {paymentForm.paymentMethod === "upi" ? (
              <label className="block">
                <span className="field-label">UPI ID</span>
                <input
                  className="field-input"
                  type="text"
                  value={paymentForm.upiId}
                  onChange={(event) => onChange("upiId", event.target.value)}
                  placeholder="name@bank"
                />
              </label>
            ) : (
              <div className="space-y-4">
                <label className="block">
                  <span className="field-label">Card Number</span>
                  <input
                    className="field-input"
                    type="text"
                    value={paymentForm.cardNumber}
                    onChange={(event) => onChange("cardNumber", event.target.value)}
                    placeholder="1234 5678 9012 3456"
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="field-label">Expiry</span>
                    <input
                      className="field-input"
                      type="text"
                      value={paymentForm.cardExpiry}
                      onChange={(event) => onChange("cardExpiry", event.target.value)}
                      placeholder="MM/YY"
                    />
                  </label>
                  <label className="block">
                    <span className="field-label">CVV</span>
                    <input
                      className="field-input"
                      type="password"
                      value={paymentForm.cardCvv}
                      onChange={(event) => onChange("cardCvv", event.target.value)}
                      placeholder="123"
                    />
                  </label>
                </div>
              </div>
            )}

            <p className={`min-h-6 text-sm ${feedback.type === "error" ? "text-rose-300" : "text-emerald-300"}`}>
              {feedback.message}
            </p>

            <button
              className="btn-primary w-full justify-center"
              type="submit"
              disabled={loading}
              data-user-action="rent"
              data-movie-id={movie.id}
            >
              {loading ? "Processing Payment..." : "Proceed to Pay"}
            </button>
          </form>
        </>
      )}
    </ModalShell>
  );
}
