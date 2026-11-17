"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { BrandLockup } from "@tracemigo/ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/catalog";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    // Set authenticated session cookie
    document.cookie = "tracemigo_session=sess_demo_learner_v1; Path=/; SameSite=Lax";
    router.push(returnTo);
  }

  return (
    <form className="auth-form" onSubmit={handleLogin}>
      <div className="field-group">
        <label htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field-group">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button className="button" type="submit">
        Sign in <span aria-hidden="true">→</span>
      </button>

      <div className="auth-footnote">
        <p>
          Don&apos;t have an account yet? <Link href="/register">Create an account</Link>
        </p>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <Link className="text-link" href="/">
          ← Back to home
        </Link>
      </header>

      <main className="warmup-main auth-main" id="main-content">
        <div className="warmup-heading">
          <p className="eyebrow">Sign In</p>
          <h1>Access your practice workspace</h1>
          <p>Sign in to continue saved case attempts and review diagnostic feedback.</p>
        </div>

        <Suspense fallback={<p>Loading login form…</p>}>
          <LoginForm />
        </Suspense>
      </main>

      <footer className="site-footer page-width">
        <span>TraceMigo / Read code. Think together.</span>
        <p>Encrypted session authority · Row-level relational security.</p>
      </footer>
    </>
  );
}
