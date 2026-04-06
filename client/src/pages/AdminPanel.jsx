import { useEffect, useMemo, useState } from "react";
import { createPosterData } from "../lib/utils";
import { getThumbnailUrl, movie24Api } from "../lib/api";

const initialForm = {
  title: "",
  description: "",
  movie: null,
  thumbnail: null
};

export default function AdminPanel({ user, onCatalogChanged }) {
  const [form, setForm] = useState(initialForm);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [editId, setEditId] = useState("");
  const [editForm, setEditForm] = useState({ title: "", description: "", thumbnail: null });
  const [actionLoadingId, setActionLoadingId] = useState("");

  useEffect(() => {
    fetchAdminMovies();
  }, []);

  async function fetchAdminMovies() {
    setLoading(true);
    try {
      console.log("[admin] fetching latest movie list");
      const response = await movie24Api.getAdminMovies();
      setMovies(response.data.map(mapAdminMovie));
    } catch (error) {
      console.error("[admin] failed to fetch movie list", error);
      setFeedback({
        type: "error",
        message: error.response?.data?.message || "Could not load admin movies."
      });
    } finally {
      setLoading(false);
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEditing(movie) {
    setEditId(movie.adminId);
    setEditForm({
      title: movie.title,
      description: movie.description || movie.synopsis || "",
      thumbnail: null
    });
  }

  function cancelEditing() {
    setEditId("");
    setEditForm({ title: "", description: "", thumbnail: null });
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!form.title.trim() || !form.description.trim() || !form.movie || !form.thumbnail) {
      setFeedback({ type: "error", message: "Please complete all upload fields." });
      return;
    }

    const payload = new FormData();
    payload.append("title", form.title.trim());
    payload.append("description", form.description.trim());
    payload.append("movie", form.movie);
    payload.append("thumbnail", form.thumbnail);

    setSaving(true);
    setFeedback({ type: "", message: "" });

    try {
      console.log("[admin] uploading movie", { title: form.title.trim() });
      await movie24Api.uploadAdminMovie(payload);
      setForm(initialForm);
      setFeedback({ type: "success", message: "Movie uploaded successfully." });
      await fetchAdminMovies();
      await onCatalogChanged?.();
    } catch (error) {
      console.error("[admin] upload failed", error);
      setFeedback({
        type: "error",
        message: error.response?.data?.message || "Upload failed."
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(movie) {
    if (!window.confirm(`Delete "${movie.title}" from Movie24?`)) {
      return;
    }

    setActionLoadingId(movie.adminId);
    setFeedback({ type: "", message: "" });

    try {
      console.log("[admin] deleting movie", { adminId: movie.adminId, title: movie.title });
      await movie24Api.deleteAdminMovie(movie.adminId);
      setMovies((current) => current.filter((entry) => entry.adminId !== movie.adminId));
      setFeedback({ type: "success", message: "Movie deleted successfully." });
      await onCatalogChanged?.();
      if (editId === movie.adminId) {
        cancelEditing();
      }
    } catch (error) {
      console.error("[admin] delete failed", error);
      setFeedback({
        type: "error",
        message: error.response?.data?.message || "Delete failed."
      });
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleEditSubmit(event) {
    event.preventDefault();

    if (!editForm.title.trim() || !editForm.description.trim()) {
      setFeedback({ type: "error", message: "Title and description are required." });
      return;
    }

    const payload = new FormData();
    payload.append("title", editForm.title.trim());
    payload.append("description", editForm.description.trim());
    if (editForm.thumbnail) {
      payload.append("thumbnail", editForm.thumbnail);
    }

    setActionLoadingId(editId);
    setFeedback({ type: "", message: "" });

    try {
      console.log("[admin] updating movie", { adminId: editId, title: editForm.title.trim() });
      await movie24Api.updateAdminMovie(editId, payload);
      setFeedback({ type: "success", message: "Movie updated successfully." });
      cancelEditing();
      await fetchAdminMovies();
      await onCatalogChanged?.();
    } catch (error) {
      console.error("[admin] update failed", error);
      setFeedback({
        type: "error",
        message: error.response?.data?.message || "Update failed."
      });
    } finally {
      setActionLoadingId("");
    }
  }

  const stats = useMemo(
    () => ({
      total: movies.length,
      withVideo: movies.filter((movie) => movie.fileName).length,
      withThumbnail: movies.filter((movie) => movie.thumbnail).length
    }),
    [movies]
  );

  return (
    <main className="section-wrap bg-[radial-gradient(circle_at_top_left,rgba(245,197,24,0.08),transparent_30%),linear-gradient(180deg,#080b12_0%,#111926_100%)] pt-28">
      <div className="section-container space-y-8">
        <section className="surface-card p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="section-label">Master Panel</div>
              <h1 className="mt-3 font-display text-5xl leading-none tracking-[0.04em] text-white">ADMIN CONTROL</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
                Upload new releases, manage thumbnails, and keep the storefront in sync with the protected streaming backend.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-muted">
              Signed in as <span className="font-semibold text-white">{user?.email}</span>
            </div>
          </div>

          <div className="dashboard-grid mt-8">
            <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="section-label">Movies Managed</div>
              <div className="mt-2 font-display text-5xl text-gold">{stats.total}</div>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="section-label">Video Files</div>
              <div className="mt-2 font-display text-5xl text-gold">{stats.withVideo}</div>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="section-label">Thumbnails</div>
              <div className="mt-2 font-display text-5xl text-gold">{stats.withThumbnail}</div>
            </article>
          </div>
        </section>

        <section className="grid gap-8 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <form className="surface-card p-6 md:p-8" onSubmit={handleUpload}>
            <div className="section-label">Upload Movie</div>
            <h2 className="mt-3 text-2xl font-semibold text-white">Add a new title</h2>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="field-label">Title</span>
                <input
                  className="field-input"
                  type="text"
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder="Enter movie title"
                />
              </label>

              <label className="block">
                <span className="field-label">Description</span>
                <textarea
                  className="field-input min-h-36 resize-y"
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  placeholder="Write a short description"
                />
              </label>

              <label className="block">
                <span className="field-label">Movie File (.mp4)</span>
                <input
                  className="field-input file:mr-4 file:rounded-full file:border-0 file:bg-gold file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
                  type="file"
                  accept=".mp4,video/mp4"
                  onChange={(event) => updateForm("movie", event.target.files?.[0] || null)}
                />
              </label>

              <label className="block">
                <span className="field-label">Thumbnail Image</span>
                <input
                  className="field-input file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
                  type="file"
                  accept="image/*"
                  onChange={(event) => updateForm("thumbnail", event.target.files?.[0] || null)}
                />
              </label>
            </div>

            {feedback.message ? (
              <div
                className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                  feedback.type === "error"
                    ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
                    : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                }`}
              >
                {feedback.message}
              </div>
            ) : null}

            <button className="btn-primary mt-6 w-full justify-center" type="submit" disabled={saving}>
              {saving ? "Uploading..." : "Upload to Movie24"}
            </button>
          </form>

          <section className="surface-card p-6 md:p-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="section-label">Admin Movies</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Catalog management</h2>
              </div>
              <button className="btn-secondary btn-small" type="button" onClick={fetchAdminMovies}>
                Refresh List
              </button>
            </div>

            {loading ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="aspect-[16/9] animate-pulse rounded-2xl bg-white/5" />
                    <div className="mt-4 h-4 rounded-full bg-white/5" />
                    <div className="mt-3 h-4 w-2/3 rounded-full bg-white/5" />
                  </div>
                ))}
              </div>
            ) : movies.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-muted">
                No admin uploads yet. Add your first movie to start populating the storefront.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {movies.map((movie) => {
                  const editing = editId === movie.adminId;
                  const busy = actionLoadingId === movie.adminId;

                  return (
                    <article key={movie.adminId} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <img
                        className="aspect-[16/9] w-full rounded-2xl object-cover"
                        src={movie.poster}
                        alt={`${movie.title} thumbnail`}
                      />
                      <div className="mt-4">
                        <div className="text-xs uppercase tracking-[0.14em] text-muted">
                          {movie.genreLabel} · {movie.quality}
                        </div>
                        <h3 className="mt-2 text-xl font-semibold text-white">{movie.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-muted">
                          {movie.description || movie.synopsis}
                        </p>
                        <p className="mt-3 text-xs text-muted">Files: {movie.fileName || "No video"} · {movie.thumbnail || "No thumbnail"}</p>
                      </div>

                      {editing ? (
                        <form className="mt-5 space-y-4" onSubmit={handleEditSubmit}>
                          <input
                            className="field-input"
                            type="text"
                            value={editForm.title}
                            onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                          />
                          <textarea
                            className="field-input min-h-28 resize-y"
                            value={editForm.description}
                            onChange={(event) =>
                              setEditForm((current) => ({ ...current, description: event.target.value }))
                            }
                          />
                          <input
                            className="field-input file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              setEditForm((current) => ({ ...current, thumbnail: event.target.files?.[0] || null }))
                            }
                          />
                          <div className="flex flex-wrap gap-3">
                            <button className="btn-primary btn-small" type="submit" disabled={busy}>
                              {busy ? "Saving..." : "Save Changes"}
                            </button>
                            <button className="btn-secondary btn-small" type="button" onClick={cancelEditing}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button className="btn-secondary btn-small" type="button" onClick={() => startEditing(movie)}>
                            Edit
                          </button>
                          <button className="btn-primary btn-small" type="button" onClick={() => handleDelete(movie)} disabled={busy}>
                            {busy ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function mapAdminMovie(movie) {
  const fallbackPoster = createPosterData(movie);
  return {
    ...movie,
    poster: movie.thumbnail ? getThumbnailUrl(movie.thumbnail) : fallbackPoster
  };
}
