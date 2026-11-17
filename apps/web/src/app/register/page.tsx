"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLockup } from "@tracemigo/ui";
import {
  getCompletedWarmups,
  clearGuestWarmups,
} from "../warmup/python/progress";

export default function RegisterPage() {
  const [guestWarmups, setGuestWarmups] = useState<string[]>([]);
  const [consentTransfer, setConsentTransfer] = useState(true);
  const [conflictPolicy, setConflictPolicy] = useState<"merge" | "overwrite" | "discard">("merge");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setGuestWarmups(getCompletedWarmups());
    } catch {
      // Storage unavailable
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!termsAccepted) {
      setError("You must accept the Terms of Service and Privacy Policy to create an account.");
      return;
    }

    if (conflictPolicy !== "discard" && !consentTransfer) {
      setError("Please check the consent box to transfer your guest reasoning notes, or choose to discard them.");
      return;
    }

    // Process account registration & transfer
    if (conflictPolicy !== "discard") {
      clearGuestWarmups();
    }

    // Set authenticated session cookie
    document.cookie = "tracemigo_session=sess_demo_learner_v1; Path=/; SameSite=Lax";
    setSubmitted(true);
  }

  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <Link className="text-link" href="/login">
          Already have an account? Sign in →
        </Link>
      </header>

      <main className="warmup-main auth-main" id="main-content">
        <div className="warmup-heading">
          <p className="eyebrow">Account Registration</p>
          <h1>Create your TraceMigo account</h1>
          <p>
            Preserve your practice history, track comprehension across curriculum cases, and access calibrated diagnostics.
          </p>
        </div>

        {submitted ? (
          <div className="success-card" role="status">
            <span className="eyebrow">Registration Complete</span>
            <h2>Welcome to TraceMigo!</h2>
            <p>
              Your account has been created.
              {guestWarmups.length > 0 && conflictPolicy !== "discard"
                ? ` Successfully transferred ${guestWarmups.length} guest warmup exercises to your account.`
                : " Ready to start practicing."}
            </p>
            <div className="success-actions">
              <Link className="button" href="/catalog">
                Browse catalog exercises →
              </Link>
              <Link className="button button-secondary" href="/diagnostic">
                Start 25-minute diagnostic →
              </Link>
            </div>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && (
              <div className="form-error-banner" role="alert">
                {error}
              </div>
            )}

            <section className="transfer-section" aria-labelledby="transfer-heading">
              <div className="card-top">
                <h2 id="transfer-heading">Transfer Guest Warmup Progress</h2>
                <span className="tag">
                  {guestWarmups.length > 0 ? `${guestWarmups.length} recorded` : "Session transfer"}
                </span>
              </div>
              <p>
                {guestWarmups.length > 0
                  ? `We detected reasoning notes from ${guestWarmups.length} warmup exercise(s) completed in this session: ${guestWarmups.join(", ")}.`
                  : "Transfer reasoning notes and predictions from your anonymous warmup sessions into your new account."}
              </p>

              <fieldset className="transfer-conflict-options">
                <legend>Conflict Handling Policy</legend>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="conflict"
                    value="merge"
                    checked={conflictPolicy === "merge"}
                    onChange={() => setConflictPolicy("merge")}
                  />
                  <span>
                    <strong>Merge with existing account data (Recommended)</strong>
                    <span className="small-note">Adds guest warmup notes without overwriting existing entries.</span>
                  </span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="conflict"
                    value="overwrite"
                    checked={conflictPolicy === "overwrite"}
                    onChange={() => setConflictPolicy("overwrite")}
                  />
                  <span>
                    <strong>Overwrite with guest session</strong>
                    <span className="small-note">Replaces any matching account exercises with your latest notes.</span>
                  </span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="conflict"
                    value="discard"
                    checked={conflictPolicy === "discard"}
                    onChange={() => setConflictPolicy("discard")}
                  />
                  <span>
                    <strong>Discard guest progress</strong>
                    <span className="small-note">Create account fresh; do not transfer local notes.</span>
                  </span>
                </label>
              </fieldset>

              {conflictPolicy !== "discard" && (
                <label className="checkbox-label consent-box">
                  <input
                    type="checkbox"
                    checked={consentTransfer}
                    onChange={(e) => setConsentTransfer(e.target.checked)}
                  />
                  <span>
                    I consent to transferring my guest reasoning notes to my TraceMigo account in accordance with the Privacy Policy.
                  </span>
                </label>
              )}
            </section>

            <div className="field-group">
              <label htmlFor="register-email">Email address</label>
              <input
                id="register-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label htmlFor="register-password">Password</label>
              <input
                id="register-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>
                I agree to the <Link href="/terms">Terms of Service</Link> and{" "}
                <Link href="/privacy">Privacy Policy</Link>.
              </span>
            </label>

            <button className="button" type="submit">
              {conflictPolicy !== "discard"
                ? "Create Account & Transfer Progress →"
                : "Create Account →"}
            </button>
          </form>
        )}
      </main>

      <footer className="site-footer page-width">
        <span>TraceMigo / Read code. Think together.</span>
        <p>Direct relational session storage · No unvetted third-party marketing trackers.</p>
      </footer>
    </>
  );
}
