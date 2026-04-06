const STORAGE_KEY = "movie24-mvp-state-v1";
const NIGHT_OFFER_START_HOUR = 0;
const NIGHT_OFFER_END_HOUR = 5;

const movieCatalog = [
  {
    id: "stellar-echo",
    title: "Stellar Echo",
    genre: "sci-fi",
    genreLabel: "Sci-Fi",
    duration: "2h 14m",
    price: 80,
    nightPrice: 20,
    nightEligible: true,
    quality: "4K + Dolby",
    badge: "Premium",
    synopsis: "A deep-space rescue mission bends time, loyalty, and memory when a missing crew starts sending signals from the future.",
    palette: ["#10192f", "#243b71", "#f5c518"]
  },
  {
    id: "red-circuit",
    title: "Red Circuit",
    genre: "action",
    genreLabel: "Action",
    duration: "2h 06m",
    price: 49,
    nightPrice: 20,
    nightEligible: true,
    quality: "Full HD",
    badge: "New",
    synopsis: "A suspended racer uncovers a citywide smuggling ring hidden inside the midnight street league.",
    palette: ["#22090f", "#661826", "#ff764a"]
  },
  {
    id: "monsoon-city",
    title: "Monsoon City",
    genre: "drama",
    genreLabel: "Drama",
    duration: "2h 22m",
    price: 39,
    nightPrice: 20,
    nightEligible: false,
    quality: "HD",
    badge: "",
    synopsis: "Three strangers chasing one last chance cross paths during a rain-soaked night in Mumbai.",
    palette: ["#0f1d2c", "#27516d", "#8fd3ff"]
  },
  {
    id: "glass-route",
    title: "Glass Route",
    genre: "thriller",
    genreLabel: "Thriller",
    duration: "1h 58m",
    price: 49,
    nightPrice: 20,
    nightEligible: true,
    quality: "Full HD",
    badge: "Hot",
    synopsis: "An investigative podcaster tracks a vanished bus route and discovers a conspiracy stitched across three states.",
    palette: ["#16171d", "#38404e", "#d7e4ff"]
  },
  {
    id: "paper-hearts",
    title: "Paper Hearts",
    genre: "romance",
    genreLabel: "Romance",
    duration: "2h 09m",
    price: 30,
    nightPrice: 20,
    nightEligible: false,
    quality: "HD",
    badge: "",
    synopsis: "A songwriter and a calligrapher rediscover each other through unsigned letters left inside second-hand books.",
    palette: ["#311620", "#89375f", "#ffd4e8"]
  },
  {
    id: "afterparty-protocol",
    title: "Afterparty Protocol",
    genre: "comedy",
    genreLabel: "Comedy",
    duration: "1h 52m",
    price: 30,
    nightPrice: 20,
    nightEligible: false,
    quality: "HD",
    badge: "",
    synopsis: "A startup launch spirals into chaos when the office AI starts approving everyone’s wildest expense claims.",
    palette: ["#112118", "#335f40", "#d3ff7b"]
  },
  {
    id: "black-dune-files",
    title: "Black Dune Files",
    genre: "thriller",
    genreLabel: "Thriller",
    duration: "2h 18m",
    price: 80,
    nightPrice: 20,
    nightEligible: true,
    quality: "4K + Dolby",
    badge: "Premium",
    synopsis: "Buried state archives point a young lawyer toward a desert case nobody has survived reopening.",
    palette: ["#1a1309", "#5a3511", "#f5c76a"]
  },
  {
    id: "velocity-house",
    title: "Velocity House",
    genre: "action",
    genreLabel: "Action",
    duration: "2h 11m",
    price: 39,
    nightPrice: 20,
    nightEligible: true,
    quality: "HD",
    badge: "New",
    synopsis: "A delivery rider stumbles into a smart building controlled by mercenaries and has one night to get everyone out.",
    palette: ["#09161f", "#1a5168", "#82f2ff"]
  }
].map((movie) => ({
  ...movie,
  poster: createPosterData(movie)
}));

const state = {
  user: null,
  rentals: [],
  continueWatching: [],
  filters: {
    search: "",
    genre: "all"
  },
  selectedMovieId: null,
  pendingRentMovieId: null,
  authMode: "login",
  movieRenderTimer: null,
  toastTimer: null
};

const elements = {
  cursor: document.getElementById("cursor"),
  siteHeader: document.getElementById("siteHeader"),
  navToggle: document.getElementById("navToggle"),
  navPanel: document.getElementById("navPanel"),
  searchInput: document.getElementById("searchInput"),
  genreFilter: document.getElementById("genreFilter"),
  filterPills: document.getElementById("filterPills"),
  resultsCount: document.getElementById("resultsCount"),
  movieGrid: document.getElementById("movieGrid"),
  continueWatchingGrid: document.getElementById("continueWatchingGrid"),
  rentalsList: document.getElementById("rentalsList"),
  summaryRentalsCount: document.getElementById("summaryRentalsCount"),
  summaryClosestExpiry: document.getElementById("summaryClosestExpiry"),
  heroCountdownHours: document.getElementById("heroCountdownHours"),
  heroCountdownMinutes: document.getElementById("heroCountdownMinutes"),
  heroCountdownSeconds: document.getElementById("heroCountdownSeconds"),
  countdownHours: document.getElementById("countdownHours"),
  countdownMinutes: document.getElementById("countdownMinutes"),
  countdownSeconds: document.getElementById("countdownSeconds"),
  nightOfferAmount: document.getElementById("nightOfferAmount"),
  nightOfferLabel: document.getElementById("nightOfferLabel"),
  nightOfferBanner: document.getElementById("nightOfferBanner"),
  authModal: document.getElementById("authModal"),
  rentModal: document.getElementById("rentModal"),
  trailerModal: document.getElementById("trailerModal"),
  loginForm: document.getElementById("loginForm"),
  signupForm: document.getElementById("signupForm"),
  loginFeedback: document.getElementById("loginFeedback"),
  signupFeedback: document.getElementById("signupFeedback"),
  authTabs: Array.from(document.querySelectorAll("[data-auth-tab]")),
  profileArea: document.getElementById("profileArea"),
  profileChip: document.getElementById("profileChip"),
  profileName: document.getElementById("profileName"),
  loginButtons: Array.from(document.querySelectorAll('[data-user-action="open-login"]')),
  signupButtons: Array.from(document.querySelectorAll('[data-user-action="open-signup"]')),
  rentPoster: document.getElementById("rentPoster"),
  rentGenre: document.getElementById("rentGenre"),
  rentMovieName: document.getElementById("rentMovieName"),
  rentMovieSynopsis: document.getElementById("rentMovieSynopsis"),
  rentDuration: document.getElementById("rentDuration"),
  rentPrice: document.getElementById("rentPrice"),
  rentPriceNote: document.getElementById("rentPriceNote"),
  rentForm: document.getElementById("rentForm"),
  rentFeedback: document.getElementById("rentFeedback"),
  payButton: document.getElementById("payButton"),
  upiFields: document.getElementById("upiFields"),
  cardFields: document.getElementById("cardFields"),
  rentModalFormView: document.getElementById("rentModalFormView"),
  rentModalSuccessView: document.getElementById("rentModalSuccessView"),
  successWatchButton: document.getElementById("successWatchButton"),
  trailerPoster: document.getElementById("trailerPoster"),
  trailerMeta: document.getElementById("trailerMeta"),
  trailerMovieName: document.getElementById("trailerMovieName"),
  trailerSynopsis: document.getElementById("trailerSynopsis"),
  trailerRentButton: document.getElementById("trailerRentButton"),
  toast: document.getElementById("toast")
};

const mockApi = {
  login(payload) {
    return mockRequest("/login", "POST", payload, () => ({
      id: `user_${slugify(payload.email)}`,
      name: payload.email.split("@")[0].replace(/[._-]/g, " "),
      email: payload.email
    }));
  },
  signup(payload) {
    return mockRequest("/signup", "POST", payload, () => ({
      id: `user_${slugify(payload.email)}`,
      name: payload.name,
      email: payload.email
    }));
  },
  rentMovie(payload) {
    return mockRequest("/rent-movie", "POST", payload, () => ({
      rentalId: `rent_${Date.now()}`,
      status: "paid",
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    }));
  },
  getMyRentals() {
    return mockRequest("/my-rentals", "GET", null, () => ({
      data: [...state.rentals]
    }));
  }
};

init();

function init() {
  loadState();
  cleanExpiredData();
  setupCursor();
  setupEvents();
  renderAll();
  startClock();
}

function setupCursor() {
  if (!elements.cursor || window.matchMedia("(max-width: 860px)").matches) {
    return;
  }

  document.addEventListener("pointermove", (event) => {
    elements.cursor.style.left = `${event.clientX}px`;
    elements.cursor.style.top = `${event.clientY}px`;
  });

  document.addEventListener("pointerover", (event) => {
    if (event.target.closest("a, button, .movie-card, .continue-card, .rental-card, .price-panel")) {
      elements.cursor.classList.add("is-big");
    }
  });

  document.addEventListener("pointerout", (event) => {
    if (event.target.closest("a, button, .movie-card, .continue-card, .rental-card, .price-panel")) {
      elements.cursor.classList.remove("is-big");
    }
  });
}

function setupEvents() {
  window.addEventListener("scroll", () => {
    elements.siteHeader.classList.toggle("is-scrolled", window.scrollY > 60);
  });

  elements.navToggle.addEventListener("click", toggleNavigation);

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeOpenModals);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeOpenModals();
    }
  });

  elements.authTabs.forEach((tab) => {
    tab.addEventListener("click", () => switchAuthMode(tab.dataset.authTab));
  });

  elements.loginForm.addEventListener("submit", (event) => handleAuthSubmit(event, "login"));
  elements.signupForm.addEventListener("submit", (event) => handleAuthSubmit(event, "signup"));
  elements.rentForm.addEventListener("submit", handleRentSubmit);

  elements.searchInput.addEventListener("input", () => {
    state.filters.search = elements.searchInput.value.trim().toLowerCase();
    queueMovieRender();
  });

  elements.genreFilter.addEventListener("change", () => {
    state.filters.genre = elements.genreFilter.value;
    syncGenreControls();
    queueMovieRender();
  });

  elements.filterPills.addEventListener("click", (event) => {
    const pill = event.target.closest("[data-genre-pill]");
    if (!pill) {
      return;
    }

    state.filters.genre = pill.dataset.genrePill;
    syncGenreControls();
    queueMovieRender();
  });

  document.body.addEventListener("click", (event) => {
    const actionTrigger = event.target.closest("[data-user-action]");
    if (!actionTrigger) {
      return;
    }

    const { userAction, movieId } = actionTrigger.dataset;

    switch (userAction) {
      case "open-login":
        openAuthModal("login");
        break;
      case "open-signup":
        openAuthModal("signup");
        break;
      case "logout":
        logoutUser();
        break;
      case "watch-trailer":
        openTrailerModal(movieId);
        break;
      case "rent":
        if (actionTrigger === elements.payButton) {
          return;
        }
        openRentModal(movieId);
        break;
      case "resume":
      case "watch-rental":
        startWatching(movieId);
        break;
      default:
        break;
    }
  });

  elements.rentForm.addEventListener("change", (event) => {
    if (event.target.name === "paymentMethod") {
      syncPaymentFields();
    }
  });

  elements.successWatchButton.addEventListener("click", () => {
    if (state.selectedMovieId) {
      startWatching(state.selectedMovieId);
      closeOpenModals();
      scrollToSection("continue-watching");
    }
  });

  elements.trailerRentButton.addEventListener("click", () => {
    const movieId = elements.trailerRentButton.dataset.movieId;
    closeOpenModals();
    openRentModal(movieId);
  });
}

function renderAll() {
  syncGenreControls();
  syncAuthUI();
  syncNightOfferUI();
  renderMovies();
  renderContinueWatching();
  renderRentals();
  syncPaymentFields();
  updateLiveTimers();
}

function renderMovies() {
  const visibleMovies = getFilteredMovies();
  elements.resultsCount.textContent = `${visibleMovies.length} title${visibleMovies.length === 1 ? "" : "s"} available`;

  if (!visibleMovies.length) {
    elements.movieGrid.innerHTML = createEmptyState({
      title: "No movies match this search",
      text: "Try another title or reset the genre filter to discover more films.",
      actionLabel: "Reset Filters",
      action: "reset-filters"
    });
    attachEmptyStateActions();
    return;
  }

  elements.movieGrid.innerHTML = visibleMovies
    .map((movie) => {
      const activeRental = getActiveRental(movie.id);
      const price = getDisplayPrice(movie);
      const offerBadge = movie.nightEligible
        ? `<span class="movie-card__offer-badge">${isNightOfferActive() ? "Night Offer Live" : "Night Offer ₹20"}</span>`
        : "";
      const badge = movie.badge
        ? `<span class="movie-card__badge">${escapeHtml(movie.badge)}</span>`
        : "";
      const timerBadge = activeRental
        ? `<span class="movie-card__timer-badge" data-expiry="${activeRental.expiresAt}" data-expiry-mode="short"></span>`
        : "";

      return `
        <article class="movie-card" data-movie-card="${movie.id}">
          <div class="movie-card__poster-wrap">
            <img class="movie-card__poster" src="${movie.poster}" alt="${escapeHtml(movie.title)} poster placeholder">
            ${timerBadge}
            ${badge}
            ${offerBadge}
            <div class="movie-card__overlay">
              <button
                class="button button--primary button--small"
                type="button"
                data-user-action="watch-trailer"
                data-movie-id="${movie.id}"
              >
                Quick Preview
              </button>
            </div>
          </div>
          <div class="movie-card__body">
            <span class="movie-card__eyebrow">${escapeHtml(movie.genreLabel)} · ${escapeHtml(movie.quality)}</span>
            <h3 class="movie-card__title">${escapeHtml(movie.title)}</h3>
            <div class="movie-card__info">
              <span class="movie-card__duration">${escapeHtml(movie.duration)}</span>
              <strong class="movie-card__price">₹${price}</strong>
            </div>
            <div class="movie-card__actions">
              <button
                class="button button--ghost button--small"
                type="button"
                data-user-action="watch-trailer"
                data-movie-id="${movie.id}"
              >
                Watch Trailer
              </button>
              <button
                class="button button--primary button--small"
                type="button"
                data-user-action="rent"
                data-movie-id="${movie.id}"
                ${activeRental ? "disabled" : ""}
              >
                ${activeRental ? "Already Rented" : "Rent Now"}
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderContinueWatching() {
  if (!state.user) {
    elements.continueWatchingGrid.innerHTML = createEmptyState({
      title: "Log in to continue watching",
      text: "Your progress bar UI, partial playback list, and last watched position appear here after authentication.",
      actionLabel: "Log In",
      action: "open-login"
    });
    attachEmptyStateActions();
    return;
  }

  if (!state.continueWatching.length) {
    elements.continueWatchingGrid.innerHTML = createEmptyState({
      title: "Nothing in progress yet",
      text: "Rent a movie and tap Start Watching to create a continue-watching state with progress bars and resume actions.",
      actionLabel: "Browse Movies",
      action: "jump-movies"
    });
    attachEmptyStateActions();
    return;
  }

  elements.continueWatchingGrid.innerHTML = state.continueWatching
    .map((entry) => {
      const movie = getMovie(entry.movieId);
      if (!movie) {
        return "";
      }

      return `
        <article class="continue-card">
          <img class="continue-card__poster" src="${movie.poster}" alt="${escapeHtml(movie.title)} continue watching poster">
          <div class="continue-card__body">
            <span class="movie-card__eyebrow">${escapeHtml(movie.genreLabel)} · ${escapeHtml(movie.duration)}</span>
            <h3 class="continue-card__title">${escapeHtml(movie.title)}</h3>
            <p class="continue-card__time">Progress: ${entry.progress}% · Last position ${entry.lastPosition}</p>
            <div class="progress" aria-label="${escapeHtml(movie.title)} watch progress">
              <div class="progress__bar" data-progress="${entry.progress}"></div>
            </div>
            <div class="continue-card__actions">
              <button
                class="button button--primary button--small"
                type="button"
                data-user-action="resume"
                data-movie-id="${movie.id}"
              >
                Resume Watching
              </button>
              <button
                class="button button--ghost button--small"
                type="button"
                data-user-action="watch-trailer"
                data-movie-id="${movie.id}"
              >
                Watch Trailer
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  applyProgressWidths();
}

function renderRentals() {
  if (!state.user) {
    elements.summaryRentalsCount.textContent = "0";
    elements.summaryClosestExpiry.textContent = "--";
    elements.rentalsList.innerHTML = createEmptyState({
      title: "Sign in to view your rentals",
      text: "The rentals dashboard is connected to a mock `GET /my-rentals` flow and will show active access windows once you log in.",
      actionLabel: "Create Account",
      action: "open-signup"
    });
    attachEmptyStateActions();
    return;
  }

  const activeRentals = getActiveRentals();
  elements.summaryRentalsCount.textContent = String(activeRentals.length);

  if (!activeRentals.length) {
    elements.summaryClosestExpiry.textContent = "--";
    elements.rentalsList.innerHTML = createEmptyState({
      title: "No active rentals",
      text: "Rent any title from the Browse section to see the 24-hour countdown, watch status, and payment metadata here.",
      actionLabel: "Browse Movies",
      action: "jump-movies"
    });
    attachEmptyStateActions();
    return;
  }

  const nextExpiry = [...activeRentals].sort((a, b) => a.expiresAt - b.expiresAt)[0];
  elements.summaryClosestExpiry.textContent = formatRemaining(nextExpiry.expiresAt, "short");

  elements.rentalsList.innerHTML = activeRentals
    .sort((a, b) => a.expiresAt - b.expiresAt)
    .map((rental) => {
      const movie = getMovie(rental.movieId);
      if (!movie) {
        return "";
      }

      return `
        <article class="rental-card">
          <img class="rental-card__poster" src="${movie.poster}" alt="${escapeHtml(movie.title)} rental poster">
          <div>
            <span class="rental-card__meta">${escapeHtml(movie.genreLabel)} · ${escapeHtml(movie.duration)} · Paid ₹${rental.pricePaid}</span>
            <h3 class="rental-card__title">${escapeHtml(movie.title)}</h3>
            <p class="rental-card__text">${escapeHtml(movie.synopsis)}</p>
            <div class="rental-card__status">Expires in <span data-expiry="${rental.expiresAt}" data-expiry-mode="long"></span></div>
            <p class="rental-card__expires">Payment: ${rental.paymentMethod.toUpperCase()} · Activated ${formatDateTime(rental.rentedAt)}</p>
          </div>
          <div class="continue-card__actions">
            <button
              class="button button--primary button--small"
              type="button"
              data-user-action="watch-rental"
              data-movie-id="${movie.id}"
            >
              Watch Now
            </button>
            <button
              class="button button--ghost button--small"
              type="button"
              data-user-action="watch-trailer"
              data-movie-id="${movie.id}"
            >
              Trailer
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function queueMovieRender() {
  clearTimeout(state.movieRenderTimer);
  elements.movieGrid.innerHTML = createSkeletonCards(6);
  state.movieRenderTimer = window.setTimeout(renderMovies, 220);
}

function syncGenreControls() {
  elements.genreFilter.value = state.filters.genre;
  Array.from(elements.filterPills.querySelectorAll("[data-genre-pill]")).forEach((pill) => {
    pill.classList.toggle("is-active", pill.dataset.genrePill === state.filters.genre);
  });
}

function syncAuthUI() {
  const isLoggedIn = Boolean(state.user);

  elements.loginButtons.forEach((button) => {
    button.classList.toggle("hidden", isLoggedIn);
  });

  elements.signupButtons.forEach((button) => {
    button.classList.toggle("hidden", isLoggedIn);
  });

  elements.profileArea.classList.toggle("profile--hidden", !isLoggedIn);

  if (state.user) {
    elements.profileName.textContent = state.user.name;
    elements.profileChip.textContent = getInitials(state.user.name);
  }
}

function syncNightOfferUI() {
  const active = isNightOfferActive();

  if (active) {
    elements.nightOfferAmount.textContent = "₹20";
    elements.nightOfferLabel.textContent = "Live now on selected titles until 5 AM";
    elements.nightOfferBanner.querySelector(".offer-chip__title").textContent = "Night Offer Live";
    elements.nightOfferBanner.querySelector(".offer-chip__note").textContent = "Selected titles are unlocked at ₹20 right now";
  } else {
    elements.nightOfferAmount.textContent = "₹20";
    elements.nightOfferLabel.textContent = "Selected titles between 12 AM and 5 AM";
    elements.nightOfferBanner.querySelector(".offer-chip__title").textContent = "Night Offer ₹20";
    elements.nightOfferBanner.querySelector(".offer-chip__note").textContent = "Returns daily between 12 AM and 5 AM";
  }
}

function openAuthModal(mode) {
  switchAuthMode(mode);
  openModal(elements.authModal);
}

function switchAuthMode(mode) {
  state.authMode = mode;
  elements.authTabs.forEach((tab) => {
    const isActive = tab.dataset.authTab === mode;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  elements.loginForm.classList.toggle("is-active", mode === "login");
  elements.signupForm.classList.toggle("is-active", mode === "signup");
  resetFeedback();
}

function openRentModal(movieId) {
  if (!movieId) {
    return;
  }

  if (!state.user) {
    state.pendingRentMovieId = movieId;
    showToast("Log in or sign up to rent this movie.");
    openAuthModal("login");
    return;
  }

  state.selectedMovieId = movieId;
  const movie = getMovie(movieId);
  if (!movie) {
    return;
  }

  elements.rentPoster.src = movie.poster;
  elements.rentGenre.textContent = `${movie.genreLabel} · ${movie.quality}`;
  elements.rentMovieName.textContent = movie.title;
  elements.rentMovieSynopsis.textContent = movie.synopsis;
  elements.rentDuration.textContent = movie.duration;
  elements.rentPrice.textContent = `₹${getDisplayPrice(movie)}`;
  elements.rentPriceNote.textContent = movie.nightEligible && isNightOfferActive()
    ? "Night pricing applied · 24 hour access included"
    : "24 hour access included";
  elements.payButton.dataset.movieId = movie.id;
  elements.trailerRentButton.dataset.movieId = movie.id;
  resetRentModal();
  openModal(elements.rentModal);
}

function openTrailerModal(movieId) {
  const movie = getMovie(movieId);
  if (!movie) {
    return;
  }

  state.selectedMovieId = movieId;
  elements.trailerPoster.src = movie.poster;
  elements.trailerMeta.textContent = `${movie.genreLabel} · ${movie.duration} · ₹${getDisplayPrice(movie)}`;
  elements.trailerMovieName.textContent = movie.title;
  elements.trailerSynopsis.textContent = movie.synopsis;
  elements.trailerRentButton.dataset.movieId = movie.id;
  openModal(elements.trailerModal);
}

function openModal(modalElement) {
  closeOpenModals();
  modalElement.classList.add("is-open");
  modalElement.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeOpenModals() {
  [elements.authModal, elements.rentModal, elements.trailerModal].forEach((modal) => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  });
  document.body.classList.remove("modal-open");
}

async function handleAuthSubmit(event, mode) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const feedback = mode === "login" ? elements.loginFeedback : elements.signupFeedback;
  const values = Object.fromEntries(new FormData(form).entries());
  const validationMessage = validateAuth(values, mode);

  if (validationMessage) {
    setFeedback(feedback, validationMessage, "error");
    return;
  }

  setFeedback(feedback, "", "neutral");
  setButtonLoading(submitButton, true);

  try {
    const response = mode === "login"
      ? await mockApi.login(values)
      : await mockApi.signup(values);

    state.user = {
      id: response.id,
      name: capitalizeWords(response.name),
      email: response.email
    };

    ensureDemoData();
    const rentalsResponse = await mockApi.getMyRentals();
    state.rentals = rentalsResponse.data;
    saveState();
    renderAll();

    setFeedback(feedback, mode === "login" ? "Login successful." : "Signup successful.", "success");
    showToast(mode === "login" ? "Welcome back to Movie24." : "Your Movie24 account is ready.");

    window.setTimeout(() => {
      closeOpenModals();
      form.reset();
      resetFeedback();

      if (state.pendingRentMovieId) {
        const pendingMovieId = state.pendingRentMovieId;
        state.pendingRentMovieId = null;
        openRentModal(pendingMovieId);
      }
    }, 500);
  } catch (error) {
    setFeedback(feedback, "Something went wrong. Please try again.", "error");
  } finally {
    setButtonLoading(submitButton, false);
  }
}

async function handleRentSubmit(event) {
  event.preventDefault();

  if (!state.user || !state.selectedMovieId) {
    openAuthModal("login");
    return;
  }

  const formData = new FormData(elements.rentForm);
  const paymentMethod = formData.get("paymentMethod") || "upi";
  const validationMessage = validatePayment(formData, paymentMethod);

  if (validationMessage) {
    setFeedback(elements.rentFeedback, validationMessage, "error");
    return;
  }

  setFeedback(elements.rentFeedback, "", "neutral");
  setButtonLoading(elements.payButton, true);

  const movie = getMovie(state.selectedMovieId);

  try {
    const payment = await mockApi.rentMovie({
      movieId: movie.id,
      userId: state.user.id,
      paymentMethod,
      price: getDisplayPrice(movie)
    });

    upsertRental({
      id: payment.rentalId,
      movieId: movie.id,
      rentedAt: Date.now(),
      expiresAt: payment.expiresAt,
      paymentMethod,
      pricePaid: getDisplayPrice(movie)
    });

    saveState();
    renderAll();
    showRentSuccess();
    showToast(`${movie.title} rented successfully.`);
  } catch (error) {
    setFeedback(elements.rentFeedback, "Payment could not be processed right now.", "error");
  } finally {
    setButtonLoading(elements.payButton, false);
  }
}

function showRentSuccess() {
  elements.rentModalFormView.classList.add("modal__content--hidden");
  elements.rentModalSuccessView.classList.remove("modal__content--hidden");
}

function resetRentModal() {
  elements.rentForm.reset();
  const defaultRadio = elements.rentForm.querySelector('input[name="paymentMethod"][value="upi"]');
  if (defaultRadio) {
    defaultRadio.checked = true;
  }
  elements.rentModalFormView.classList.remove("modal__content--hidden");
  elements.rentModalSuccessView.classList.add("modal__content--hidden");
  setFeedback(elements.rentFeedback, "", "neutral");
  syncPaymentFields();
}

function syncPaymentFields() {
  const paymentMethod = new FormData(elements.rentForm).get("paymentMethod") || "upi";
  elements.upiFields.classList.toggle("payment-fields--hidden", paymentMethod !== "upi");
  elements.cardFields.classList.toggle("payment-fields--hidden", paymentMethod !== "card");
}

function logoutUser() {
  state.user = null;
  state.pendingRentMovieId = null;
  saveState();
  renderAll();
  closeOpenModals();
  showToast("You have been logged out.");
}

function startWatching(movieId) {
  if (!state.user) {
    openAuthModal("login");
    return;
  }

  const movie = getMovie(movieId);
  if (!movie) {
    return;
  }

  const existingEntry = state.continueWatching.find((entry) => entry.movieId === movieId);
  const nextProgress = existingEntry ? Math.min(existingEntry.progress + 14, 96) : 18;

  if (existingEntry) {
    existingEntry.progress = nextProgress;
    existingEntry.lastPosition = formatPlaybackPosition(movie, nextProgress);
    existingEntry.updatedAt = Date.now();
  } else {
    state.continueWatching.unshift({
      movieId,
      progress: nextProgress,
      lastPosition: formatPlaybackPosition(movie, nextProgress),
      updatedAt: Date.now()
    });
  }

  saveState();
  renderAll();
  showToast(`Resume ready for ${movie.title}.`);
}

function upsertRental(rental) {
  const existingIndex = state.rentals.findIndex((entry) => entry.movieId === rental.movieId);
  if (existingIndex >= 0) {
    state.rentals.splice(existingIndex, 1, rental);
  } else {
    state.rentals.unshift(rental);
  }
}

function ensureDemoData() {
  if (state.rentals.length || state.continueWatching.length) {
    return;
  }

  const now = Date.now();

  state.rentals = [
    {
      id: `rent_seed_${now}`,
      movieId: "stellar-echo",
      rentedAt: now - 11 * 60 * 60 * 1000,
      expiresAt: now + 12 * 60 * 60 * 1000 + 20 * 60 * 1000,
      paymentMethod: "upi",
      pricePaid: getDisplayPrice(getMovie("stellar-echo"))
    },
    {
      id: `rent_seed_${now + 1}`,
      movieId: "glass-route",
      rentedAt: now - 17 * 60 * 60 * 1000,
      expiresAt: now + 6 * 60 * 60 * 1000 + 12 * 60 * 1000,
      paymentMethod: "card",
      pricePaid: getDisplayPrice(getMovie("glass-route"))
    }
  ];

  state.continueWatching = [
    {
      movieId: "stellar-echo",
      progress: 42,
      lastPosition: formatPlaybackPosition(getMovie("stellar-echo"), 42),
      updatedAt: now
    },
    {
      movieId: "glass-route",
      progress: 18,
      lastPosition: formatPlaybackPosition(getMovie("glass-route"), 18),
      updatedAt: now
    }
  ];
}

function startClock() {
  window.setInterval(() => {
    const changed = cleanExpiredData();
    if (changed) {
      saveState();
      renderAll();
      return;
    }

    updateLiveTimers();
  }, 1000);
}

function updateLiveTimers() {
  const activeRentals = getActiveRentals();
  const referenceExpiry = activeRentals.length
    ? [...activeRentals].sort((a, b) => a.expiresAt - b.expiresAt)[0].expiresAt
    : Date.now() + 24 * 60 * 60 * 1000;

  const countdown = splitRemaining(referenceExpiry);

  elements.heroCountdownHours.textContent = pad(countdown.hours);
  elements.heroCountdownMinutes.textContent = pad(countdown.minutes);
  elements.heroCountdownSeconds.textContent = pad(countdown.seconds);
  elements.countdownHours.textContent = pad(countdown.hours);
  elements.countdownMinutes.textContent = pad(countdown.minutes);
  elements.countdownSeconds.textContent = pad(countdown.seconds);

  document.querySelectorAll("[data-expiry]").forEach((node) => {
    const mode = node.dataset.expiryMode || "short";
    const expiry = Number(node.dataset.expiry);
    node.textContent = formatRemaining(expiry, mode);
  });

  if (!activeRentals.length) {
    elements.summaryClosestExpiry.textContent = "--";
  }
}

function cleanExpiredData() {
  const previousRentals = state.rentals.length;
  const activeMovieIds = new Set();

  state.rentals = state.rentals.filter((rental) => {
    const isActive = rental.expiresAt > Date.now();
    if (isActive) {
      activeMovieIds.add(rental.movieId);
    }
    return isActive;
  });

  state.continueWatching = state.continueWatching.filter((entry) => activeMovieIds.has(entry.movieId));

  return previousRentals !== state.rentals.length;
}

function attachEmptyStateActions() {
  document.querySelectorAll("[data-empty-action]").forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const action = button.dataset.emptyAction;

        if (action === "open-login") {
          openAuthModal("login");
        }

        if (action === "open-signup") {
          openAuthModal("signup");
        }

        if (action === "jump-movies") {
          scrollToSection("movies");
        }

        if (action === "reset-filters") {
          state.filters.search = "";
          state.filters.genre = "all";
          elements.searchInput.value = "";
          syncGenreControls();
          renderMovies();
        }
      },
      { once: true }
    );
  });
}

function applyProgressWidths() {
  document.querySelectorAll(".progress__bar[data-progress]").forEach((bar) => {
    bar.style.width = `${bar.dataset.progress}%`;
  });
}

function getFilteredMovies() {
  return movieCatalog.filter((movie) => {
    const matchesGenre = state.filters.genre === "all" || movie.genre === state.filters.genre;
    const matchesSearch = !state.filters.search || movie.title.toLowerCase().includes(state.filters.search);
    return matchesGenre && matchesSearch;
  });
}

function getMovie(movieId) {
  return movieCatalog.find((movie) => movie.id === movieId);
}

function getActiveRental(movieId) {
  return state.rentals.find((rental) => rental.movieId === movieId && rental.expiresAt > Date.now());
}

function getActiveRentals() {
  return state.rentals.filter((rental) => rental.expiresAt > Date.now());
}

function getDisplayPrice(movie) {
  return movie.nightEligible && isNightOfferActive() ? movie.nightPrice : movie.price;
}

function isNightOfferActive(date = new Date()) {
  const hour = date.getHours();
  return hour >= NIGHT_OFFER_START_HOUR && hour < NIGHT_OFFER_END_HOUR;
}

function validateAuth(values, mode) {
  if (mode === "signup" && (!values.name || values.name.trim().length < 2)) {
    return "Please enter your name.";
  }

  if (!values.email || !/^\S+@\S+\.\S+$/.test(values.email)) {
    return "Please enter a valid email address.";
  }

  if (!values.password || String(values.password).trim().length < 6) {
    return "Password must be at least 6 characters.";
  }

  return "";
}

function validatePayment(formData, paymentMethod) {
  if (paymentMethod === "upi") {
    const upiId = String(formData.get("upiId") || "").trim();
    if (!/^[\w.-]+@[\w.-]+$/.test(upiId)) {
      return "Please enter a valid UPI ID.";
    }
  }

  if (paymentMethod === "card") {
    const cardNumber = String(formData.get("cardNumber") || "").replace(/\s+/g, "");
    const cardExpiry = String(formData.get("cardExpiry") || "").trim();
    const cardCvv = String(formData.get("cardCvv") || "").trim();

    if (cardNumber.length < 16) {
      return "Please enter a valid 16-digit card number.";
    }

    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      return "Please enter card expiry in MM/YY format.";
    }

    if (!/^\d{3}$/.test(cardCvv)) {
      return "Please enter a valid 3-digit CVV.";
    }
  }

  return "";
}

function setFeedback(element, message, status) {
  element.textContent = message;
  element.classList.remove("is-error", "is-success");

  if (status === "error") {
    element.classList.add("is-error");
  }

  if (status === "success") {
    element.classList.add("is-success");
  }
}

function resetFeedback() {
  [elements.loginFeedback, elements.signupFeedback, elements.rentFeedback].forEach((node) => {
    setFeedback(node, "", "neutral");
  });
}

function setButtonLoading(button, isLoading) {
  button.classList.toggle("is-loading", isLoading);
  button.disabled = isLoading;
}

function toggleNavigation() {
  const isOpen = elements.navPanel.classList.toggle("is-open");
  elements.navToggle.setAttribute("aria-expanded", String(isOpen));
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2600);
}

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) {
    return;
  }
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.user = stored.user || null;
    state.rentals = Array.isArray(stored.rentals) ? stored.rentals : [];
    state.continueWatching = Array.isArray(stored.continueWatching) ? stored.continueWatching : [];
  } catch (error) {
    state.user = null;
    state.rentals = [];
    state.continueWatching = [];
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      user: state.user,
      rentals: state.rentals,
      continueWatching: state.continueWatching
    })
  );
}

function mockRequest(endpoint, method, payload, resolver) {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      console.info(`[mock-api] ${method} ${endpoint}`, payload || "");
      resolve(resolver());
    }, 700);
  });
}

function createEmptyState({ title, text, actionLabel, action }) {
  return `
    <div class="empty-state">
      <h3 class="empty-state__title">${escapeHtml(title)}</h3>
      <p class="empty-state__text">${escapeHtml(text)}</p>
      <button class="button button--primary button--small" type="button" data-empty-action="${action}">
        ${escapeHtml(actionLabel)}
      </button>
    </div>
  `;
}

function createSkeletonCards(count) {
  return Array.from({ length: count }, () => `
    <article class="skeleton-card" aria-hidden="true">
      <div class="skeleton-card__poster"></div>
      <div class="skeleton-card__body">
        <div class="skeleton-card__line"></div>
        <div class="skeleton-card__line"></div>
      </div>
    </article>
  `).join("");
}

function splitRemaining(expiry) {
  const totalSeconds = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}

function formatRemaining(expiry, mode) {
  const { hours, minutes, seconds } = splitRemaining(expiry);

  if (mode === "long") {
    return `${hours}h ${minutes}m`;
  }

  if (mode === "seconds") {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `⏳ ${hours}h left`;
}

function formatPlaybackPosition(movie, progress) {
  const totalMinutes = parseDurationToMinutes(movie.duration);
  const watchedMinutes = Math.max(1, Math.round((totalMinutes * progress) / 100));
  const hours = Math.floor(watchedMinutes / 60);
  const minutes = watchedMinutes % 60;
  return `${pad(hours)}:${pad(minutes)}:00`;
}

function formatDateTime(timestamp) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(timestamp);
}

function parseDurationToMinutes(duration) {
  const match = duration.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/i);
  if (!match) {
    return 120;
  }

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  return hours * 60 + minutes;
}

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function capitalizeWords(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createPosterData(movie) {
  const [start, end, accent] = movie.palette;
  const lines = wrapPosterTitle(movie.title);
  const titleTspans = lines
    .map((line, index) => `<tspan x="60" dy="${index === 0 ? 0 : 74}">${escapeHtml(line.toUpperCase())}</tspan>`)
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${start}" />
          <stop offset="100%" stop-color="${end}" />
        </linearGradient>
      </defs>
      <rect width="600" height="900" fill="url(#g)" />
      <circle cx="500" cy="150" r="140" fill="${accent}" opacity="0.14" />
      <circle cx="120" cy="760" r="190" fill="#ffffff" opacity="0.06" />
      <rect x="40" y="40" width="520" height="820" rx="28" fill="none" stroke="rgba(255,255,255,0.14)" />
      <text x="60" y="110" fill="#f5c518" font-size="26" font-family="Arial, sans-serif" letter-spacing="6">MOVIE24 PREMIERE</text>
      <text x="60" y="620" fill="#f0f2f5" font-size="74" font-weight="700" font-family="Arial, sans-serif">${titleTspans}</text>
      <text x="60" y="790" fill="#c8ccd6" font-size="24" font-family="Arial, sans-serif" letter-spacing="3">${escapeHtml(movie.genreLabel.toUpperCase())} • ${escapeHtml(movie.duration.toUpperCase())}</text>
      <text x="60" y="835" fill="#ffffff" font-size="20" font-family="Arial, sans-serif" opacity="0.75">${escapeHtml(movie.quality.toUpperCase())}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function wrapPosterTitle(title) {
  const words = title.split(" ");
  if (words.length === 1) {
    return [words[0]];
  }

  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}
