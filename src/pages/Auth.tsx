import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Loader2,
  Mail,
  UserX,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";

interface AuthProps {
  redirectAfterAuth?: string;
  /** Which face of the same flow to show. The backend is one email-code flow. */
  mode?: "login" | "signup";
}

/**
 * Where to send someone once they are signed in.
 *
 * Guards two redirect problems: an off-site target (`//evil.com`, or a scheme
 * we did not expect), and a loop back into the auth pages themselves. Without
 * the second guard, `?returnTo=/login` would navigate to /login, the effect
 * below would fire again, and the user would sit in a navigation loop.
 */
function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/app",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    const target = returnTo.split("?")[0].replace(/\/+$/, "");
    const authPages = ["/auth", "/login", "/signup"];
    if (target && !authPages.includes(target) && target !== "/") return returnTo;
  }
  return fallback;
}

/**
 * Auth failures are reported in plain language.
 *
 * The underlying error from the identity provider can carry provider names,
 * internal codes and request ids, none of which tell a reader what to do next.
 * It is logged to the console for diagnosis and never rendered.
 */
const SEND_FAILURE =
  "We couldn't send the code. Check the email address and try again.";
const VERIFY_FAILURE =
  "That code is not correct, or it has expired. Request a new one.";
const NETWORK_FAILURE =
  "We couldn't complete that request. Please try again.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The propagation chain shown on the visual panel — the product in four words. */
const CHAIN: { label: string; note: string }[] = [
  { label: "Event", note: "what happened" },
  { label: "Geography", note: "where it lands" },
  { label: "Impact", note: "how it travels" },
  { label: "Exposure", note: "who is affected" },
];

/**
 * The authentication surface.
 *
 * One backend flow — Convex Auth's email one-time code — presented as two
 * doors: sign in and create account. There is no password provider in this
 * deployment, so no password fields are drawn and no password recovery page
 * exists; inventing either would collect credentials the backend never uses.
 *
 * Signup additionally captures a display name, saved through
 * `account:setDisplayName` after the code verifies, which is the first piece of
 * the per-user architecture (watchlists, exposure profiles) later steps build
 * on.
 */
function Auth({ redirectAfterAuth, mode = "login" }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const setDisplayName = useMutation(api.account.setDisplayName);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();

  const reason = searchParams.get("reason");
  const returnTo = searchParams.get("returnTo");
  const redirect = resolveRedirectAfterAuth(returnTo, redirectAfterAuth);

  const isSignup = mode === "signup";

  // The two doors link to each other, preserving why the visitor came.
  const siblingAuthLink = (() => {
    const qs = new URLSearchParams();
    if (returnTo) qs.set("returnTo", returnTo);
    if (reason) qs.set("reason", reason);
    const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
    return isSignup ? `/login${suffix}` : `/signup${suffix}`;
  })();

  const [step, setStep] = useState<"form" | { email: string }>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
  }>({});

  // A signed-in visitor never sees the form: straight to their destination.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const validate = () => {
    const next: { name?: string; email?: string } = {};
    if (isSignup) {
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 80) {
        next.name = "Enter your name (2–80 characters).";
      }
    }
    if (!EMAIL_RE.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  /** Step 1 — send the code. */
  const handleFormSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (isLoading) return;
    if (!validate()) return;
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      const params = new FormData();
      params.set("email", email.trim());
      await signIn("email-otp", params);
      setStep({ email: email.trim() });
      setOtp("");
      setNotice("A 6-digit code is on its way. It expires in 15 minutes.");
    } catch (err) {
      console.error("[auth] send code failed:", err);
      setError(SEND_FAILURE);
    } finally {
      setIsLoading(false);
    }
  };

  /** Step 2 — verify the code, then (on signup) save the display name. */
  const handleOtpSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (isLoading || otp.length !== 6) return;
    // The OTP step is only reachable with an email in hand; this keeps the
    // union narrow for TypeScript without asserting.
    if (step === "form") return;
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      const params = new FormData();
      params.set("email", step.email);
      params.set("code", otp);
      await signIn("email-otp", params);
    } catch (err) {
      console.error("[auth] verify code failed:", err);
      setError(VERIFY_FAILURE);
      setIsLoading(false);
      setOtp("");
      return;
    }

    // The account exists now; the name is best-effort and must not block
    // a successful sign-in if it fails.
    if (isSignup && name.trim()) {
      try {
        await setDisplayName({ name: name.trim() });
      } catch (err) {
        console.error("[auth] display name not saved:", err);
      }
    }
    navigate(redirect);
  };

  /** Resend without leaving the code step. */
  const handleResend = async () => {
    if (isLoading) return;
    if (step === "form") return;
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      const params = new FormData();
      params.set("email", step.email);
      await signIn("email-otp", params);
      setOtp("");
      setNotice("A new code is on its way. It expires in 15 minutes.");
    } catch (err) {
      console.error("[auth] resend failed:", err);
      setError(SEND_FAILURE);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (err) {
      console.error("[auth] guest sign-in failed:", err);
      setError(NETWORK_FAILURE);
      setIsLoading(false);
    }
  };

  const entrance = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--exec-base)] text-[var(--exec-ink)] lg:flex-row">
      {/* ------------------------------------------------ Left: identity panel.
          Hidden below lg so the form owns small screens; nothing decorative
          stands between a phone and the code input. */}
      <aside className="relative hidden overflow-hidden border-r border-[var(--exec-hairline)] bg-[var(--exec-panel)] lg:flex lg:w-[46%] lg:flex-col lg:justify-between xl:w-1/2">
        <div className="p-10 xl:p-14">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5"
            aria-label="GlobalMatrix home"
          >
            <span
              className="size-2 shrink-0 rounded-sm bg-[var(--exec-cyan)]"
              aria-hidden
            />
            <span className="text-[14px] font-semibold tracking-[0.2em] uppercase">
              Globalmatrix
            </span>
          </Link>
        </div>

        <div className="px-10 pb-4 xl:px-14">
          <p className="t-hero text-[clamp(2rem,4vw,3.25rem)] text-[var(--exec-ink)]">
            See what changed.
            <br />
            <span className="text-[var(--exec-cyan)]">Trace the impact.</span>
          </p>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--exec-ink-dim)]">
            Global geopolitical and supply-chain exposure intelligence that
            connects events to the countries, flows, infrastructure, industries
            and businesses they affect.
          </p>

          {/* The product in four steps: a restrained chain, not a demo. */}
          <ol className="mt-10 max-w-sm">
            {CHAIN.map((node, i) => (
              <motion.li
                key={node.label}
                initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.09 }}
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full border border-[var(--exec-cyan)] bg-[var(--exec-cyan)]/30"
                    aria-hidden
                  />
                  <span className="w-24 shrink-0 text-[13px] font-semibold tracking-[0.14em] text-[var(--exec-ink)] uppercase">
                    {node.label}
                  </span>
                  <span
                    className="h-px min-w-0 flex-1 bg-[var(--exec-hairline)]"
                    aria-hidden
                  />
                  <span className="exec-label shrink-0">{node.note}</span>
                </div>
                {i < CHAIN.length - 1 ? (
                  <span
                    className="relative ml-[3.5px] block h-5 w-px overflow-hidden bg-[var(--exec-hairline)]"
                    aria-hidden
                  >
                    {/* One slow pulse travelling the path — the only ambient
                        motion on the page, and it stops for reduced motion. */}
                    {!reduceMotion ? (
                      <motion.span
                        className="absolute inset-x-0 top-0 h-2 bg-[var(--exec-cyan)]"
                        animate={{ y: [-8, 20] }}
                        transition={{
                          duration: 1.6,
                          repeat: Infinity,
                          delay: 0.4 + i * 0.35,
                          repeatDelay: 2.4,
                          ease: "easeInOut",
                        }}
                      />
                    ) : null}
                  </span>
                ) : null}
              </motion.li>
            ))}
          </ol>
        </div>

        <p className="px-10 pb-10 text-[12px] leading-relaxed text-[var(--exec-ink-muted)] xl:px-14">
          Evidence before decoration · every figure carries its source and
          freshness · scenarios are never presented as predictions.
        </p>
      </aside>

      {/* ------------------------------------------------ Right: the form. */}
      <main className="flex w-full min-w-0 flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:w-[54%] lg:py-14 xl:w-1/2">
        <div className="w-full max-w-[430px] min-w-0">
          <div className="mb-5 flex items-center justify-between gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[13px] text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
            >
              <ArrowLeft className="size-3.5" /> Home
            </Link>
            <span className="exec-label truncate text-[var(--exec-ink-dim)]">
              {step === "form"
                ? isSignup
                  ? "Create account"
                  : "Sign in"
                : "Verify code"}
            </span>
          </div>

          <motion.section
            {...entrance}
            className="card min-w-0 p-6 sm:p-8"
            aria-labelledby="auth-title"
          >
            {step === "form" ? (
              <>
                <p className="exec-label text-[var(--exec-cyan)]">
                  {reason ? "Restricted action" : isSignup ? "New account" : "Welcome"}
                </p>
                <h1
                  id="auth-title"
                  className="t-section mt-2 text-[var(--exec-ink)]"
                >
                  {reason
                    ? "Sign in to continue"
                    : isSignup
                      ? "Create your GlobalMatrix account"
                      : "Welcome back"}
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--exec-ink-dim)]">
                  {reason
                    ? `${reason}. Browsing GlobalMatrix stays free and needs no account.`
                    : isSignup
                      ? "Build your personal view of global events, exposure and emerging risks."
                      : "Continue to your global intelligence workspace."}
                </p>

                <form
                  onSubmit={handleFormSubmit}
                  noValidate
                  className="mt-6 flex flex-col gap-4"
                >
                  {isSignup ? (
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="auth-name"
                        className="text-[13px] font-medium text-[var(--exec-ink)]"
                      >
                        Full name
                      </label>
                      <Input
                        id="auth-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        placeholder="Alex Rivera"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isLoading}
                        aria-invalid={fieldErrors.name ? true : undefined}
                        aria-describedby={
                          fieldErrors.name ? "auth-name-error" : undefined
                        }
                        className="h-11"
                      />
                      {fieldErrors.name ? (
                        <p
                          id="auth-name-error"
                          role="alert"
                          className="flex items-center gap-1.5 text-[13px] text-[var(--exec-crimson)]"
                        >
                          <CircleAlert className="size-3.5 shrink-0" />
                          {fieldErrors.name}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="auth-email"
                      className="text-[13px] font-medium text-[var(--exec-ink)]"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--exec-ink-muted)]"
                        aria-hidden
                      />
                      <Input
                        id="auth-email"
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="name@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        aria-invalid={fieldErrors.email ? true : undefined}
                        aria-describedby={
                          fieldErrors.email ? "auth-email-error" : undefined
                        }
                        className="h-11 pl-9"
                      />
                    </div>
                    {fieldErrors.email ? (
                      <p
                        id="auth-email-error"
                        role="alert"
                        className="flex items-center gap-1.5 text-[13px] text-[var(--exec-crimson)]"
                      >
                        <CircleAlert className="size-3.5 shrink-0" />
                        {fieldErrors.email}
                      </p>
                    ) : null}
                  </div>

                  {error ? (
                    <p
                      role="alert"
                      className="flex items-start gap-2 rounded-lg border border-[var(--exec-crimson)]/40 bg-[var(--exec-crimson)]/10 px-3 py-2.5 text-[13px] leading-snug text-[var(--exec-ink)]"
                    >
                      <CircleAlert
                        className="mt-0.5 size-4 shrink-0 text-[var(--exec-crimson)]"
                        aria-hidden
                      />
                      {error}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    aria-busy={isLoading || undefined}
                    className="h-11 w-full rounded-full bg-[var(--exec-cyan)] text-[14px] font-semibold text-[var(--exec-base)] hover:opacity-90"
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : isSignup ? (
                      "Create account"
                    ) : (
                      <>
                        Send sign-in code
                        <ArrowRight className="size-4" aria-hidden />
                      </>
                    )}
                  </Button>
                </form>

                {!isSignup ? (
                  <>
                    <div className="my-5 flex items-center gap-3">
                      <span className="h-px flex-1 bg-[var(--exec-hairline)]" />
                      <span className="exec-label text-[var(--exec-ink-muted)]">
                        or
                      </span>
                      <span className="h-px flex-1 bg-[var(--exec-hairline)]" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGuestLogin}
                      disabled={isLoading}
                      className="h-11 w-full border-[var(--exec-hairline-strong)] text-[14px] text-[var(--exec-ink)] hover:border-[var(--exec-cyan)] hover:text-[var(--exec-ink)]"
                    >
                      <UserX className="size-4 mr-2" aria-hidden />
                      Continue as guest — no email needed
                    </Button>
                  </>
                ) : null}

                <p className="mt-6 text-[13px] text-[var(--exec-ink-dim)]">
                  {isSignup ? (
                    <>
                      Already have an account?{" "}
                      <Link
                        to={siblingAuthLink}
                        className="font-medium text-[var(--exec-cyan)] hover:underline"
                      >
                        Sign in
                      </Link>
                    </>
                  ) : (
                    <>
                      Don&apos;t have an account?{" "}
                      <Link
                        to={siblingAuthLink}
                        className="font-medium text-[var(--exec-cyan)] hover:underline"
                      >
                        Create account
                      </Link>
                    </>
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="exec-label text-[var(--exec-cyan)]">
                  Verification
                </p>
                <h1
                  id="auth-title"
                  className="t-section mt-2 text-[var(--exec-ink)]"
                >
                  Check your email
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--exec-ink-dim)]">
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-[var(--exec-ink)]">
                    {step.email}
                  </span>
                  . It expires in 15 minutes.
                </p>

                <form
                  onSubmit={handleOtpSubmit}
                  className="mt-6 flex flex-col gap-4"
                >
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      aria-label="6-digit verification code"
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          otp.length === 6 &&
                          !isLoading
                        ) {
                          const form = (e.target as HTMLElement).closest(
                            "form",
                          );
                          form?.requestSubmit();
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {error ? (
                    <p
                      role="alert"
                      className="flex items-start gap-2 rounded-lg border border-[var(--exec-crimson)]/40 bg-[var(--exec-crimson)]/10 px-3 py-2.5 text-[13px] leading-snug text-[var(--exec-ink)]"
                    >
                      <CircleAlert
                        className="mt-0.5 size-4 shrink-0 text-[var(--exec-crimson)]"
                        aria-hidden
                      />
                      {error}
                    </p>
                  ) : null}
                  {notice ? (
                    <p
                      role="status"
                      className="flex items-start gap-2 rounded-lg border border-[var(--exec-emerald)]/40 bg-[var(--exec-emerald)]/10 px-3 py-2.5 text-[13px] leading-snug text-[var(--exec-ink)]"
                    >
                      <span
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--exec-emerald)]"
                        aria-hidden
                      />
                      {notice}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    aria-busy={isLoading || undefined}
                    className="h-11 w-full rounded-full bg-[var(--exec-cyan)] text-[14px] font-semibold text-[var(--exec-base)] hover:opacity-90"
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <>
                        Verify and continue
                        <ArrowRight className="size-4" aria-hidden />
                      </>
                    )}
                  </Button>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isLoading}
                      className="text-[13px] text-[var(--exec-ink-dim)] underline-offset-4 transition-colors hover:text-[var(--exec-ink)] hover:underline disabled:opacity-50"
                    >
                      Resend code
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("form");
                        setOtp("");
                        setError(null);
                        setNotice(null);
                      }}
                      disabled={isLoading}
                      className="text-[13px] text-[var(--exec-ink-dim)] underline-offset-4 transition-colors hover:text-[var(--exec-ink)] hover:underline disabled:opacity-50"
                    >
                      Use a different email
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.section>

          <p className="mt-5 text-center text-[12px] leading-relaxed text-[var(--exec-ink-muted)]">
            Public intelligence needs no account — close this page and keep
            browsing. An account only saves your watchlist and notes.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense fallback={null}>
      <Auth {...props} />
    </Suspense>
  );
}
