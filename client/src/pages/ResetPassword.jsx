import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { movie24Api } from "../lib/api";
import { Eye, EyeOff } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: null, message: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: null, message: "" });

    if (!token) {
      setFeedback({ type: "error", message: "Invalid or missing token." });
      return;
    }

    if (password.length < 6) {
      setFeedback({ type: "error", message: "Password must be at least 6 characters." });
      return;
    }

    try {
      setLoading(true);
      const res = await movie24Api.resetPassword({ token, newPassword: password });
      setFeedback({ type: "success", message: res.message || "Password updated successfully!" });
      setTimeout(() => navigate("/", { replace: true }), 3000);
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || "Failed to reset password."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="section-wrap grid min-h-screen place-items-center px-5 py-24">
      <div className="surface-card w-full max-w-md p-8">
        <div className="mb-6">
          <span className="section-label">Account Security</span>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-[0.04em] text-white">RESET PASSWORD</h1>
          <p className="mt-2 text-sm text-muted">Create a strong new password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block relative">
            <span className="field-label">New Password</span>
            <div className="relative">
              <input
                className="field-input pr-12"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                onClick={() => setShowPassword(!showPassword)}
                title="Toggle Password Visibility"
              >
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </label>

          <p className={`min-h-6 text-sm ${feedback.type === "error" ? "text-rose-300" : "text-emerald-300"}`}>
            {feedback.message}
          </p>

          <div className="flex gap-3 pt-2">
            <Link to="/" className="btn-secondary flex-1 justify-center align-middle text-center">
              Cancel
            </Link>
            <button className="btn-primary flex-[2] justify-center" type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
