import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AuthModal from "./components/modals/AuthModal";
import RentModal from "./components/modals/RentModal";
import TrailerModal from "./components/modals/TrailerModal";
import WatchModal from "./components/modals/WatchModal";
import Footer from "./components/layout/Footer";
import Header from "./components/layout/Header";
import CTASection from "./components/sections/CTASection";
import ContinueWatchingSection from "./components/sections/ContinueWatchingSection";
import CountdownShowcase from "./components/sections/CountdownShowcase";
import HeroSection from "./components/sections/HeroSection";
import HowItWorksSection from "./components/sections/HowItWorksSection";
import MoviesSection from "./components/sections/MoviesSection";
import PricingSection from "./components/sections/PricingSection";
import RentalsSection from "./components/sections/RentalsSection";
import TestimonialsSection from "./components/sections/TestimonialsSection";
import TickerStrip from "./components/sections/TickerStrip";
import WhySection from "./components/sections/WhySection";
import AppErrorBoundary from "./components/ui/AppErrorBoundary";
import Toast from "./components/ui/Toast";
import AdminPanel from "./pages/AdminPanel";
import PaymentSuccess from "./pages/PaymentSuccess";
import ResetPassword from "./pages/ResetPassword";
import {
  clearAuthToken,
  getAuthToken,
  getThumbnailUrl,
  movie24Api,
  setAuthToken
} from "./lib/api";
import {
  createPosterData,
  formatPlaybackPosition,
  formatRemaining,
  getInitials,
  isNightOfferActive,
  pad,
  splitRemaining,
  STORAGE_KEY
} from "./lib/utils";

const emptyFeedback = { message: "", type: "success" };
const initialPaymentForm = {
  paymentMethod: "upi",
  upiId: "",
  cardNumber: "",
  cardExpiry: "",
  cardCvv: ""
};

export default function AppRoot() {
  const location = useLocation();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [movies, setMovies] = useState([]);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [moviesError, setMoviesError] = useState("");
  const [user, setUser] = useState(null);
  const [rentals, setRentals] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [filters, setFilters] = useState({ search: "", genre: "all" });
  const [searchLoading, setSearchLoading] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [rentModalOpen, setRentModalOpen] = useState(false);
  const [trailerModalOpen, setTrailerModalOpen] = useState(false);
  const [watchModalOpen, setWatchModalOpen] = useState(false);
  const [pendingRentMovieId, setPendingRentMovieId] = useState(null);
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "" });
  const [forgotForm, setForgotForm] = useState({ email: "" });
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [feedback, setFeedback] = useState({
    login: emptyFeedback,
    signup: emptyFeedback,
    forgot: emptyFeedback,
    rent: emptyFeedback
  });
  const [loading, setLoading] = useState({
    login: false,
    signup: false,
    forgot: false,
    rent: false,
    rentals: false
  });
  const [rentSuccess, setRentSuccess] = useState(false);
  const [paymentRedirecting, setPaymentRedirecting] = useState(false);
  const [toast, setToast] = useState("");

  const nightOfferActive = isNightOfferActive();
  const authToken = getAuthToken();
  const isAdmin = Boolean(authToken) && user?.email?.trim().toLowerCase() === "admin@gmail.com";
  const isAdminView = location.pathname === "/admin";

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (stored.user) {
        setUser({
          ...stored.user,
          initials: stored.user.initials || getInitials(stored.user.name)
        });
      }
      if (Array.isArray(stored.continueWatching)) {
        setContinueWatching(stored.continueWatching);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        user,
        continueWatching
      })
    );
  }, [user, continueWatching]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 60);
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener("scroll", onScroll);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearchLoading(false), 220);
    return () => window.clearTimeout(timeoutId);
  }, [filters]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    document.body.style.overflow =
      authModalOpen || rentModalOpen || trailerModalOpen || watchModalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [authModalOpen, rentModalOpen, trailerModalOpen, watchModalOpen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        closeAllModals();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    fetchMovies();
  }, []);

  useEffect(() => {
    if (location.pathname === "/" && location.state?.refreshMovies) {
      fetchMovies();
    }
  }, [location.pathname, location.state]);

  useEffect(() => {
    if (user && authToken) {
      fetchRentals();
    } else {
      setRentals([]);
    }
  }, [user, authToken]);

  useEffect(() => {
    const activeMovieIds = new Set(
      rentals.filter((rental) => new Date(rental.expiresAt).getTime() > now).map((rental) => rental.movieId)
    );
    const nextContinueWatching = continueWatching.filter((item) => activeMovieIds.has(item.movieId));
    if (nextContinueWatching.length !== continueWatching.length) {
      setContinueWatching(nextContinueWatching);
    }
  }, [now, rentals, continueWatching]);

  useEffect(() => {
    setMobileOpen(false);
    closeAllModals();
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === "/" && location.state?.scrollTo) {
      const targetId = location.state.scrollTo;
      window.setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
      }, 120);
    }
  }, [location.pathname, location.state]);

  const selectedMovie = movies.find((movie) => movie.id === selectedMovieId) || null;
  const activeRentals = useMemo(
    () => rentals.filter((rental) => new Date(rental.expiresAt).getTime() > now),
    [rentals, now]
  );

  const activeRentalMap = useMemo(
    () =>
      Object.fromEntries(
        activeRentals.map((rental) => [rental.movieId, formatRemaining(new Date(rental.expiresAt).getTime(), "short")])
      ),
    [activeRentals]
  );

  const visibleMovies = useMemo(
    () =>
      movies.filter((movie) => {
        const matchesGenre = filters.genre === "all" || movie.genre === filters.genre;
        const matchesSearch = !filters.search || movie.title.toLowerCase().includes(filters.search.toLowerCase());
        return matchesGenre && matchesSearch;
      }),
    [movies, filters]
  );

  const activeRentalItems = useMemo(
    () =>
      activeRentals
        .map((rental) => ({
          ...rental,
          movie: movies.find((movie) => movie.id === rental.movieId),
          remaining: formatRemaining(new Date(rental.expiresAt).getTime(), "long")
        }))
        .filter((rental) => rental.movie)
        .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()),
    [activeRentals, movies]
  );

  const continueItems = useMemo(
    () =>
      continueWatching
        .map((entry) => ({
          ...entry,
          movie: movies.find((movie) => movie.id === entry.movieId)
        }))
        .filter((entry) => entry.movie && activeRentalMap[entry.movie.id]),
    [continueWatching, movies, activeRentalMap]
  );

  const nextExpiry = activeRentals.length
    ? new Date([...activeRentals].sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))[0].expiresAt).getTime()
    : now + 24 * 60 * 60 * 1000;
  const countdown = splitRemaining(nextExpiry);
  const heroCountdown = {
    hours: pad(countdown.hours),
    minutes: pad(countdown.minutes),
    seconds: pad(countdown.seconds)
  };

  const rentalsSummary = {
    count: activeRentals.length,
    closestExpiry: activeRentals.length ? formatRemaining(nextExpiry, "long") : "--"
  };
  const genreOptions = useMemo(() => getGenreOptions(movies), [movies]);

  async function fetchMovies() {
    setMoviesLoading(true);
    setMoviesError("");
    try {
      console.log("[movies] fetching latest catalog");
      const response = await movie24Api.getMovies();
      setMovies(response.data.map((movie) => mapMovieForUi(movie, nightOfferActive)));
    } catch (error) {
      console.error("[movies] failed to fetch catalog", error);
      setMoviesError(error.response?.data?.message || "Unable to load movies right now.");
    } finally {
      setMoviesLoading(false);
    }
  }

  async function fetchRentals() {
    if (!authToken) {
      return;
    }

    setLoading((current) => ({ ...current, rentals: true }));
    try {
      const response = await movie24Api.getMyRentals();
      setRentals(
        response.data.map((rental) => ({
          ...rental,
          id: rental.id || rental._id,
          movieId: rental.movieId || rental.movie?.movieId,
          movie: rental.movie ? mapMovieForUi(rental.movie, nightOfferActive) : null
        }))
      );
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout();
      } else {
        setToast(error.response?.data?.message || "Could not refresh rentals.");
      }
    } finally {
      setLoading((current) => ({ ...current, rentals: false }));
    }
  }

  function updateLoginForm(field, value) {
    setLoginForm((current) => ({ ...current, [field]: value }));
  }

  function updateSignupForm(field, value) {
    setSignupForm((current) => ({ ...current, [field]: value }));
  }

  function updateForgotForm(field, value) {
    setForgotForm((current) => ({ ...current, [field]: value }));
  }

  function updatePaymentForm(field, value) {
    setPaymentForm((current) => ({ ...current, [field]: value }));
  }

  function openAuthModal(mode) {
    setAuthMode(mode);
    setAuthModalOpen(true);
    setMobileOpen(false);
  }

  function openTrailerModal(movieId) {
    setSelectedMovieId(movieId);
    setRentModalOpen(false);
    setWatchModalOpen(false);
    setTrailerModalOpen(true);
  }

  function openWatchModal(movieId) {
    if (!user) {
      setToast("Log in to watch your rented movie.");
      openAuthModal("login");
      return;
    }

    setSelectedMovieId(movieId);
    setTrailerModalOpen(false);
    setRentModalOpen(false);
    setWatchModalOpen(true);
  }

  function openRentModal(movieId) {
    if (!user) {
      setPendingRentMovieId(movieId);
      setToast("Log in or sign up to rent this movie.");
      openAuthModal("login");
      return;
    }

    setSelectedMovieId(movieId);
    setTrailerModalOpen(false);
    setWatchModalOpen(false);
    setAuthModalOpen(false);
    setRentModalOpen(true);
    setRentSuccess(false);
    setPaymentForm(initialPaymentForm);
    setFeedback((current) => ({ ...current, rent: emptyFeedback }));
  }

  function closeAllModals() {
    setAuthModalOpen(false);
    setRentModalOpen(false);
    setTrailerModalOpen(false);
    setWatchModalOpen(false);
    setRentSuccess(false);
  }

  function resetForms() {
    setLoginForm({ email: "", password: "" });
    setSignupForm({ name: "", email: "", password: "" });
    setForgotForm({ email: "" });
    setFeedback((current) => ({
      ...current,
      login: emptyFeedback,
      signup: emptyFeedback,
      forgot: emptyFeedback
    }));
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    const message = validateAuth(loginForm, "login");
    if (message) {
      setFeedback((current) => ({ ...current, login: { type: "error", message } }));
      return;
    }

    setLoading((current) => ({ ...current, login: true }));
    setFeedback((current) => ({ ...current, login: emptyFeedback }));

    try {
      const response = await movie24Api.login(loginForm);
      setAuthToken(response.token);
      setUser({ ...response.user, initials: getInitials(response.user.name) });
      setLoginForm({ email: "", password: "" });
      setAuthModalOpen(false);
      setToast("Welcome back to Movie24.");
      await fetchRentals();

      if (pendingRentMovieId) {
        const movieId = pendingRentMovieId;
        setPendingRentMovieId(null);
        window.setTimeout(() => openRentModal(movieId), 100);
      }
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        login: { type: "error", message: error.response?.data?.message || "Login failed." }
      }));
    } finally {
      setLoading((current) => ({ ...current, login: false }));
    }
  }

  async function handleSignupSubmit(event) {
    event.preventDefault();
    const message = validateAuth(signupForm, "signup");
    if (message) {
      setFeedback((current) => ({ ...current, signup: { type: "error", message } }));
      return;
    }

    setLoading((current) => ({ ...current, signup: true }));
    setFeedback((current) => ({ ...current, signup: emptyFeedback }));

    try {
      const response = await movie24Api.signup(signupForm);
      setAuthToken(response.token);
      setUser({ ...response.user, initials: getInitials(response.user.name) });
      setSignupForm({ name: "", email: "", password: "" });
      setAuthModalOpen(false);
      setToast("Your Movie24 account is ready.");
      await fetchRentals();

      if (pendingRentMovieId) {
        const movieId = pendingRentMovieId;
        setPendingRentMovieId(null);
        window.setTimeout(() => openRentModal(movieId), 100);
      }
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        signup: { type: "error", message: error.response?.data?.message || "Signup failed." }
      }));
    } finally {
      setLoading((current) => ({ ...current, signup: false }));
    }
  }

  async function handleForgotSubmit(event) {
    event.preventDefault();
    if (!/^\\S+@\\S+\\.\\S+$/.test(forgotForm.email)) {
      setFeedback((current) => ({ ...current, forgot: { type: "error", message: "Please enter a valid email address." } }));
      return;
    }
    
    setLoading((current) => ({ ...current, forgot: true }));
    setFeedback((current) => ({ ...current, forgot: emptyFeedback }));
    
    try {
      await movie24Api.forgotPassword({ email: forgotForm.email });
      setFeedback((current) => ({ ...current, forgot: { type: "success", message: "Password reset token generated! Check server console." } }));
      setForgotForm({ email: "" });
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        forgot: { type: "error", message: error.response?.data?.message || "Failed to initiate reset." }
      }));
    } finally {
      setLoading((current) => ({ ...current, forgot: false }));
    }
  }

  async function handleRentSubmit(event) {
    event.preventDefault();
    const message = validatePayment(paymentForm);
    if (message) {
      setFeedback((current) => ({ ...current, rent: { type: "error", message } }));
      return;
    }

    if (!selectedMovie) {
      return;
    }

    setLoading((current) => ({ ...current, rent: true }));
    setPaymentRedirecting(false);
    setFeedback((current) => ({ ...current, rent: emptyFeedback }));

    try {
      console.log("[payment] processing rental", {
        movieId: selectedMovie.id,
        paymentMethod: paymentForm.paymentMethod
      });
      await movie24Api.rentMovie(selectedMovie.id, {
        paymentMethod: paymentForm.paymentMethod
      });
      await Promise.all([fetchRentals(), fetchMovies()]);
      closeAllModals();
      setPaymentRedirecting(true);
      setToast(`${selectedMovie.title} rented successfully.`);
      navigate("/success", {
        state: {
          movieId: selectedMovie.id,
          movieTitle: selectedMovie.title,
          poster: selectedMovie.poster,
          pricePaid: selectedMovie.nightEligible && nightOfferActive ? selectedMovie.nightPrice : selectedMovie.price,
          paymentMethod: paymentForm.paymentMethod
        }
      });
    } catch (error) {
      console.error("[payment] rental failed", error);
      setFeedback((current) => ({
        ...current,
        rent: { type: "error", message: error.response?.data?.message || "Payment failed." }
      }));
    } finally {
      setLoading((current) => ({ ...current, rent: false }));
      setPaymentRedirecting(false);
    }
  }

  function handlePlaybackStarted(movieId) {
    const movie = movies.find((entry) => entry.id === movieId);
    if (!movie) {
      return;
    }

    setContinueWatching((current) => {
      const existing = current.find((item) => item.movieId === movieId);
      if (existing) {
        return current.map((item) =>
          item.movieId === movieId
            ? {
                ...item,
                progress: Math.min(item.progress + 12, 96),
                lastPosition: formatPlaybackPosition(movie.duration, Math.min(item.progress + 12, 96)),
                updatedAt: Date.now()
              }
            : item
        );
      }

      return [
        {
          movieId,
          progress: 18,
          lastPosition: formatPlaybackPosition(movie.duration, 18),
          updatedAt: Date.now()
        },
        ...current
      ];
    });
  }

  function handleLogout() {
    clearAuthToken();
    setUser(null);
    setRentals([]);
    setPendingRentMovieId(null);
    closeAllModals();
    setToast("You have been logged out.");
  }

  function resetFilters() {
    setFilters({ search: "", genre: "all" });
    setSearchLoading(false);
  }

  const streamUrl = selectedMovie ? movie24Api.getStreamUrl(selectedMovie.fileName || selectedMovie.file) : "";

  return (
    <div className="app-shell">
      <Header
        isScrolled={isScrolled}
        isAdminView={isAdminView}
        isAdmin={isAdmin}
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen((current) => !current)}
        user={user}
        onOpenLogin={() => openAuthModal("login")}
        onOpenSignup={() => openAuthModal("signup")}
        onLogout={handleLogout}
      />

      <AppErrorBoundary>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <main>
                  <HeroSection
                    nightOfferActive={nightOfferActive}
                    heroCountdown={heroCountdown}
                    onOpenSignup={() => openAuthModal("signup")}
                  />
                  <TickerStrip />
                  <ContinueWatchingSection
                    user={user}
                    items={continueItems}
                    onResume={openWatchModal}
                    onTrailer={openTrailerModal}
                    onLogin={() => openAuthModal("login")}
                    onBrowse={() => document.getElementById("movies")?.scrollIntoView({ behavior: "smooth" })}
                  />
                  <MoviesSection
                    genreOptions={genreOptions}
                    filters={filters}
                    onSearchChange={(search) => {
                      setFilters((current) => ({ ...current, search }));
                      setSearchLoading(true);
                    }}
                    onGenreChange={(genre) => {
                      setFilters((current) => ({ ...current, genre }));
                      setSearchLoading(true);
                    }}
                    visibleMovies={moviesError ? [] : visibleMovies}
                    activeRentalMap={activeRentalMap}
                    nightOfferActive={nightOfferActive}
                    isLoading={moviesLoading || searchLoading}
                    onTrailer={openTrailerModal}
                    onRent={openRentModal}
                    onWatch={openWatchModal}
                    onReset={resetFilters}
                  />
                  {moviesError ? (
                    <div className="section-container -mt-16 mb-16 px-5 text-sm text-rose-300 md:px-8">{moviesError}</div>
                  ) : null}
                  <RentalsSection
                    user={user}
                    rentals={activeRentalItems}
                    summary={rentalsSummary}
                    onWatch={openWatchModal}
                    onTrailer={openTrailerModal}
                    onSignup={() => openAuthModal("signup")}
                    onBrowse={() => document.getElementById("movies")?.scrollIntoView({ behavior: "smooth" })}
                  />
                  <HowItWorksSection />
                  <CountdownShowcase countdown={heroCountdown} />
                  <PricingSection />
                  <WhySection />
                  <TestimonialsSection />
                  <CTASection onOpenSignup={() => openAuthModal("signup")} />
                </main>

                <Footer />
              </>
            }
          />
          <Route path="/success" element={<><PaymentSuccess /><Footer /></>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/admin"
            element={
              isAdmin ? (
                <>
                  <AdminPanel user={user} onCatalogChanged={fetchMovies} />
                  <Footer />
                </>
              ) : (
                <Navigate replace to="/" />
              )
            }
          />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </AppErrorBoundary>

      <AuthModal
        isOpen={authModalOpen}
        mode={authMode}
        onModeChange={setAuthMode}
        onClose={closeAllModals}
        loginForm={loginForm}
        signupForm={signupForm}
        forgotForm={forgotForm}
        feedback={feedback}
        loading={loading}
        onLoginChange={updateLoginForm}
        onSignupChange={updateSignupForm}
        onForgotChange={updateForgotForm}
        onLoginSubmit={handleLoginSubmit}
        onSignupSubmit={handleSignupSubmit}
        onForgotSubmit={handleForgotSubmit}
        resetForms={resetForms}
      />

      <RentModal
        isOpen={rentModalOpen}
        movie={selectedMovie}
        price={selectedMovie ? (selectedMovie.nightEligible && nightOfferActive ? selectedMovie.nightPrice : selectedMovie.price) : 0}
        priceNote={
          selectedMovie?.nightEligible && nightOfferActive
            ? "Night pricing applied · 24 hour access included"
            : "24 hour access included"
        }
        paymentForm={paymentForm}
        feedback={feedback.rent}
        loading={loading.rent || paymentRedirecting}
        success={rentSuccess}
        onClose={closeAllModals}
        onChange={updatePaymentForm}
        onSubmit={handleRentSubmit}
        onWatchNow={() => {
          closeAllModals();
          openWatchModal(selectedMovie.id);
        }}
      />

      <TrailerModal
        isOpen={trailerModalOpen}
        movie={selectedMovie}
        price={selectedMovie ? (selectedMovie.nightEligible && nightOfferActive ? selectedMovie.nightPrice : selectedMovie.price) : 0}
        onClose={closeAllModals}
        onRent={openRentModal}
      />

      <WatchModal
        isOpen={watchModalOpen}
        movie={selectedMovie}
        streamUrl={streamUrl}
        onClose={closeAllModals}
        onPlaybackStarted={() => selectedMovie && handlePlaybackStarted(selectedMovie.id)}
      />

      <Toast message={toast || (loading.rentals ? "Refreshing your rentals..." : "")} />
    </div>
  );
}

function mapMovieForUi(movie, nightOfferActive) {
  const poster = movie.thumbnail ? getThumbnailUrl(movie.thumbnail) : createPosterData(movie);

  return {
    ...movie,
    id: movie.movieId || movie.id,
    adminId: movie.adminId || movie._id || movie.movieId || movie.id,
    description: movie.description || movie.synopsis || "",
    synopsis: movie.synopsis || movie.description || "New release added to Movie24.",
    genre: movie.genre || "featured",
    genreLabel: movie.genreLabel || "Featured",
    duration: movie.duration || "2h 00m",
    price: Number(movie.price ?? 49),
    nightPrice: Number(movie.nightPrice ?? 20),
    nightEligible: Boolean(movie.nightEligible ?? false),
    quality: movie.quality || "HD",
    badge: movie.badge || "",
    file: movie.file || movie.fileName || "",
    fileName: movie.fileName || movie.file || "",
    poster,
    displayPrice: movie.nightEligible && nightOfferActive ? movie.nightPrice : movie.price
  };
}

function validateAuth(values, mode) {
  if (mode === "signup" && values.name.trim().length < 2) {
    return "Please enter your name.";
  }
  if (!/^\S+@\S+\.\S+$/.test(values.email)) {
    return "Please enter a valid email address.";
  }
  if (values.password.trim().length < 6) {
    return "Password must be at least 6 characters.";
  }
  return "";
}

function validatePayment(paymentForm) {
  if (paymentForm.paymentMethod === "upi" && !/^[\w.-]+@[\w.-]+$/.test(paymentForm.upiId.trim())) {
    return "Please enter a valid UPI ID.";
  }

  if (paymentForm.paymentMethod === "card") {
    const cardNumber = paymentForm.cardNumber.replace(/\s+/g, "");
    if (cardNumber.length < 16) {
      return "Please enter a valid 16-digit card number.";
    }
    if (!/^\d{2}\/\d{2}$/.test(paymentForm.cardExpiry.trim())) {
      return "Please enter card expiry in MM/YY format.";
    }
    if (!/^\d{3}$/.test(paymentForm.cardCvv.trim())) {
      return "Please enter a valid 3-digit CVV.";
    }
  }

  return "";
}

function getGenreOptions(movies) {
  const dynamicGenres = new Map();

  movies.forEach((movie) => {
    const genre = movie.genre || "featured";
    const label = movie.genreLabel || "Featured";
    dynamicGenres.set(genre, label);
  });

  return [
    { value: "all", label: "All genres" },
    ...Array.from(dynamicGenres.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }))
  ];
}
