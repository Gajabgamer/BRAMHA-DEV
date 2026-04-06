import { useState, useEffect } from "react";
import ModalShell from "../ui/ModalShell";
import { Eye, EyeOff } from "lucide-react";

export default function AuthModal({
  isOpen,
  mode,
  onModeChange,
  onClose,
  loginForm,
  signupForm,
  forgotForm,
  feedback,
  loading,
  onLoginChange,
  onSignupChange,
  onForgotChange,
  onLoginSubmit,
  onSignupSubmit,
  onForgotSubmit,
  resetForms // new prop to clear states
}) {
  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      if (resetForms) resetForms();
      setShowPassword(false);
      if (isForgot) onModeChange("login");
    }
  }, [isOpen, resetForms, isForgot, onModeChange]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} widthClass="max-w-[540px]">
      <div className="mb-6">
        <span className="section-label">Account Access</span>
        <h2 className="mt-2 font-display text-5xl leading-none tracking-[0.04em] text-white">
          {isForgot ? "RECOVER PASSWORD" : "LOG IN OR SIGN UP"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          {isForgot
            ? "Enter your email to receive a password reset token."
            : "Authenticate securely to access your movies."}
        </p>
      </div>

      {!isForgot && (
        <div className="grid grid-cols-2 gap-2 rounded-full bg-white/5 p-1">
          {["login", "signup"].map((tab) => (
            <button
              key={tab}
              className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                mode === tab ? "bg-gold text-ink" : "text-muted hover:text-white"
              }`}
              type="button"
              onClick={() => onModeChange(tab)}
            >
              {tab === "login" ? "Login" : "Signup"}
            </button>
          ))}
        </div>
      )}

      {isLogin && (
        <form className="mt-6 space-y-4" onSubmit={onLoginSubmit}>
          <label className="block">
            <span className="field-label">Email</span>
            <input
              className="field-input"
              type="email"
              value={loginForm.email}
              onChange={(event) => onLoginChange("email", event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="block relative">
            <span className="field-label">Password</span>
            <div className="relative">
              <input
                className="field-input pr-12"
                type={showPassword ? "text" : "password"}
                value={loginForm.password}
                onChange={(event) => onLoginChange("password", event.target.value)}
                placeholder="Minimum 6 characters"
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
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onModeChange("forgot")}
              className="text-xs text-gold hover:underline"
            >
              Forgot Password?
            </button>
          </div>
          <p className={`min-h-6 text-sm ${feedback.login.type === "error" ? "text-rose-300" : "text-emerald-300"}`}>
            {feedback.login.message}
          </p>
          <button className="btn-primary w-full justify-center" type="submit" disabled={loading.login}>
            {loading.login ? "Logging In..." : "Log In"}
          </button>
        </form>
      )}

      {isSignup && (
        <form className="mt-6 space-y-4" onSubmit={onSignupSubmit}>
          <label className="block">
            <span className="field-label">Name</span>
            <input
              className="field-input"
              type="text"
              value={signupForm.name}
              onChange={(event) => onSignupChange("name", event.target.value)}
              placeholder="Your full name"
            />
          </label>
          <label className="block">
            <span className="field-label">Email</span>
            <input
              className="field-input"
              type="email"
              value={signupForm.email}
              onChange={(event) => onSignupChange("email", event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="block relative">
            <span className="field-label">Password</span>
            <div className="relative">
              <input
                className="field-input pr-12"
                type={showPassword ? "text" : "password"}
                value={signupForm.password}
                onChange={(event) => onSignupChange("password", event.target.value)}
                placeholder="Minimum 6 characters"
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
          <p className={`min-h-6 text-sm ${feedback.signup.type === "error" ? "text-rose-300" : "text-emerald-300"}`}>
            {feedback.signup.message}
          </p>
          <button className="btn-primary w-full justify-center" type="submit" disabled={loading.signup}>
            {loading.signup ? "Creating Account..." : "Create Account"}
          </button>
        </form>
      )}

      {isForgot && (
        <form className="mt-6 space-y-4" onSubmit={onForgotSubmit}>
          <label className="block">
            <span className="field-label">Email</span>
            <input
              className="field-input"
              type="email"
              value={forgotForm?.email || ""}
              onChange={(event) => onForgotChange("email", event.target.value)}
              placeholder="Enter your registered email"
            />
          </label>
          
          <p className={`min-h-6 text-sm ${feedback.forgot?.type === "error" ? "text-rose-300" : "text-emerald-300"}`}>
            {feedback.forgot?.message}
          </p>
          
          <div className="flex gap-3">
            <button
              className="btn-secondary flex-1 justify-center"
              type="button"
              onClick={() => onModeChange("login")}
            >
              Back
            </button>
            <button className="btn-primary flex-[2] justify-center" type="submit" disabled={loading.forgot}>
              {loading.forgot ? "Requesting..." : "Send Reset Link"}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}
