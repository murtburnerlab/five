/* FIVE — passwordless email authentication.
   Google OAuth stays in five-auth-buttons.js and is intentionally untouched. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  let sending = false;
  let client = null;

  function getClient() {
    if (client) return client;
    if (!window.supabase?.createClient || !window.FIVE_SUPABASE_URL || !window.FIVE_SUPABASE_KEY) {
      throw new Error("Authentication is temporarily unavailable. Please try again later.");
    }
    client = window.supabase.createClient(window.FIVE_SUPABASE_URL, window.FIVE_SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return client;
  }

  /* Remove the old password UI itself instead of relying only on CSS selectors. */
  function cleanAuthForm() {
    const password = $("authPassword");
    const confirm = $("authPasswordConfirm");
    const confirmField = $("authPasswordConfirmField");
    const forgot = $("forgotPasswordButton");

    if (password) password.closest(".field")?.remove();
    if (confirmField) confirmField.remove();
    else if (confirm) confirm.closest(".field")?.remove();
    forgot?.remove();

    const email = $("authEmail");
    if (email) {
      email.type = "email";
      email.autocomplete = "email";
      email.required = true;
      email.placeholder = "you@example.com";
      email.setAttribute("aria-label", "Email address");
    }

    const form = $("auth")?.querySelector(".form");
    if (form) {
      form.querySelectorAll(".field").forEach(field => {
        if (!field.querySelector("#authEmail")) field.remove();
      });
    }
    const copy = $("authCopy");
    if (copy) copy.textContent = "Enter the email address associated with your FIVE account. We’ll email you a secure sign-in link.";
  }

  function setMessage(text, type = "") {
    const el = $("authMessage");
    if (!el) return;
    el.textContent = text || "";
    el.className = "message" + (type ? " " + type : "");
    el.classList.toggle("hidden", !text);
  }

  function modeNow() {
    return $("authTitle")?.textContent?.trim().toUpperCase() === "CREATE ACCOUNT"
      ? "signup" : "signin";
  }

  function setMode(mode) {
    const signup = mode === "signup";
    const title = $("authTitle");
    const copy = $("authCopy");
    const submit = $("authSubmit");
    const switchButton = $("authModeSwitch");
    if (title) title.textContent = signup ? "CREATE ACCOUNT" : "SIGN IN";
    if (copy) copy.textContent = signup
      ? "Enter your email and we’ll send you a link to activate your FIVE account."
      : "Enter the email address associated with your FIVE account. We’ll email you a secure sign-in link.";
    if (submit) {
      submit.textContent = signup ? "CREATE ACCOUNT" : "SIGN IN";
      submit.disabled = false;
    }
    if (switchButton) switchButton.textContent = signup ? "BACK TO SIGN IN" : "CREATE ACCOUNT";
    setMessage("");
    cleanAuthForm();
  }

  window.setAuthMode = setMode;

  window.submitAuth = async function submitPasswordlessAuth() {
    if (sending) return;
    cleanAuthForm();

    const emailInput = $("authEmail");
    const email = (emailInput?.value || "").trim();
    const mode = modeNow();

    if (!email) {
      setMessage("Enter your email address.", "error");
      emailInput?.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("Enter a valid email address.", "error");
      emailInput?.focus();
      return;
    }

    const button = $("authSubmit");
    sending = true;
    if (button) {
      button.disabled = true;
      button.textContent = "SENDING LINK…";
    }
    setMessage("");

    try {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await getClient().auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: mode === "signup",
          emailRedirectTo: redirectTo
        }
      });

      if (error) {
        const raw = String(error.message || "");
        if (mode === "signin" && /signups not allowed|user not found|unable to validate email|email not found/i.test(raw)) {
          throw new Error("No FIVE account was found for this email. Choose CREATE ACCOUNT to register.");
        }
        throw error;
      }

      try {
        if (typeof window.trackEvent === "function") {
          window.trackEvent(mode === "signup" ? "account_signup_link_requested" : "account_login_link_requested");
        }
      } catch (_) {}

      setMessage(
        mode === "signup"
          ? "Check your inbox. Open the email from FIVE to activate your account. If it doesn’t arrive, check your spam folder."
          : "Check your inbox for your secure FIVE sign-in link. If it doesn’t arrive, check your spam folder.",
        "success"
      );
    } catch (error) {
      setMessage(error?.message || "Could not send the email link. Please try again.", "error");
    } finally {
      sending = false;
      if (button) {
        button.disabled = false;
        button.textContent = mode === "signup" ? "CREATE ACCOUNT" : "SIGN IN";
      }
    }
  };

  /* Execute immediately because this script is included at the end of body. */
  cleanAuthForm();
  setMode("signin");

  /* Keep the form passwordless if another UI module re-renders its markup. */
  const auth = $("auth");
  if (auth && window.MutationObserver) {
    const observer = new MutationObserver(() => cleanAuthForm());
    observer.observe(auth, { childList: true, subtree: true });
  }
})();
