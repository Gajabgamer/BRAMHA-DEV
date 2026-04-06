import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export default function PaymentSuccess() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!location.state?.movieId) {
      navigate("/", { replace: true });
    }
  }, [location.state, navigate]);

  const payment = useMemo(
    () => ({
      movieId: location.state?.movieId || "",
      movieTitle: location.state?.movieTitle || "Your Movie24 rental",
      pricePaid: Number(location.state?.pricePaid ?? 0),
      poster: location.state?.poster || "",
      paymentMethod: location.state?.paymentMethod || "upi"
    }),
    [location.state]
  );

  return (
    <main className="section-wrap grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,rgba(78,211,154,0.15),transparent_30%),linear-gradient(180deg,#08110f_0%,#101520_100%)] px-5 pt-28">
      <div className="surface-card grid max-w-5xl gap-8 p-6 md:p-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          {payment.poster ? (
            <img className="aspect-[2/3] h-full w-full object-cover" src={payment.poster} alt={`${payment.movieTitle} poster`} />
          ) : (
            <div className="grid aspect-[2/3] place-items-center text-center">
              <div>
                <div className="section-label">Payment Confirmed</div>
                <div className="mt-3 font-display text-5xl text-gold">24H</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <div className="grid h-20 w-20 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/15 text-3xl text-emerald-200">
            ✓
          </div>
          <div className="section-label mt-6">Payment Confirmed</div>
          <h1 className="mt-3 font-display text-5xl leading-none tracking-[0.04em] text-white">PAYMENT SUCCESSFUL</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
            {payment.movieTitle} is now unlocked for 24 hours. You can start watching right away or jump back to My Rentals any time.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="section-label">Title</div>
              <div className="mt-2 text-lg font-semibold text-white">{payment.movieTitle}</div>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="section-label">Payment Method</div>
              <div className="mt-2 text-lg font-semibold uppercase text-white">{payment.paymentMethod}</div>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="section-label">Amount Paid</div>
              <div className="mt-2 text-lg font-semibold text-gold">₹{payment.pricePaid || "--"}</div>
            </article>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              className="btn-primary"
              type="button"
              onClick={() => navigate("/", { state: { scrollTo: "my-rentals", refreshMovies: true } })}
            >
              Go to My Rentals
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => navigate("/", { state: { refreshMovies: true } })}
            >
              Browse More Movies
            </button>
            <Link className="btn-secondary" to="/">
              Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
