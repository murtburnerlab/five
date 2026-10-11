/* FIVE — passwordless email authentication.
 * Replace the existing five-password-recovery.js with this file.
 * Keeps the existing app.js, Google OAuth, account panel, and route persistence.
 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const authSection = $("auth");
  const emailInput = $("authEmail");
  const title = $("authTitle");
  const copy = $("authCopy");
  const submitButton = $("authSubmit");
  const modeButton = $("authModeSwitch");
  const messageBox = $("authMessage");

  if (!authSection || !emailInput || !submitButton || !modeButton || !title) {
    console.error("FIVE passwordless auth: required auth elements were not found.");
    return;
  }

  if (!window.supabase?.createClient || !window.FIVE_SUPABASE_URL || !window.FIVE_SUPABASE_KEY) {
    console.error("FIVE passwordless auth: Supabase configuration is missing.");
    return;
  }

  // Passwords are no longer part of the FIVE sign-in experience.
  $("authPassword")?.closest(".field")?.remove();
  $("authPasswordConfirmField")?.remove();
  $("authPasswordConfirm")?.closest(".field")?.remove();
  $("forgotPasswordButton")?.remove();

  emailInput.type = "email";
  emailInput.autocomplete = "email";
  emailInput.inputMode = "email";
  emailInput.required = true;
  emailInput.placeholder = "you@example.com";
  emailInput.setAttribute("aria-label", "Email address");

  let mode = "signin";
  let busy = false;

  const client = window.supabase.createClient(
    window.FIVE_SUPABASE_URL,
    window.FIVE_SUPABASE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  function showMessage(text, type = "") {
    if (!messageBox) return;
    messageBox.textContent = text || "";
    messageBox.className = "message" + (type ? " " + type : "");
    messageBox.classList.toggle("hidden", !text);
    messageBox.setAttribute("role", "status");
    messageBox.setAttribute("aria-live", "polite");
  }

  function setMode(nextMode) {
    mode = nextMode === "signup" ? "signup" : "signin";

    title.textContent = mode === "signup" ? "CREATE ACCOUNT" : "SIGN IN";
    if (copy) {
      copy.textContent = mode === "signup"
        ? "Enter your email. We’ll send you a one-time link to confirm your email and access FIVE."
        : "Enter the email linked to your FIVE account. We’ll send you a one-time sign-in link.";
    }

    submitButton.textContent = mode === "signup" ? "CREATE ACCOUNT" : "SIGN IN";
    modeButton.textContent = mode === "signup" ? "BACK TO SIGN IN" : "CREATE ACCOUNT";
    emailInput.autocomplete = "email";
    emailInput.disabled = false;
    submitButton.disabled = false;
    modeButton.disabled = false;
    showMessage("");
  }

  // app.js exposes this function and index.html's existing toggle calls it.
  window.setAuthMode = setMode;

  // Keep the existing index.html toggleAuthMode() behavior compatible.
  window.toggleAuthMode = function () {
    setMode(mode === "signup" ? "signin" : "signup");
  };

  function setBusy(value) {
    busy = value;
    emailInput.disabled = value;
    submitButton.disabled = value;
    modeButton.disabled = value;
    submitButton.textContent = value
      ? "SENDING LINK…"
      : (mode === "signup" ? "CREATE ACCOUNT" : "SIGN IN");
  }

  function normalizedEmail() {
    return String(emailInput.value || "").trim().toLowerCase();
  }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function submitPasswordlessAuth() {
    if (busy) return;

    const email = normalizedEmail();
    if (!email) {
      showMessage("Enter your email address.", "error");
      emailInput.focus();
      return;
    }
    if (!validEmail(email)) {
      showMessage("Enter a valid email address and try again.", "error");
      emailInput.focus();
      return;
    }

    setBusy(true);
    showMessage("");

    try {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          // Sign-in must not silently create a new account.
          // Sign-up may create a user if this email is not registered.
          shouldCreateUser: mode === "signup"
        }
      });

      if (error) {
        const raw = String(error.message || "");
        const lower = raw.toLowerCase();

        if (/rate limit|too many requests|email rate limit/i.test(lower)) {
          showMessage("Too many email requests. Wait a little and try again.", "error");
        } else if (/not found|no user|signups.*disabled|user.*not.*exist/i.test(lower) && mode === "signin") {
          // Avoid displaying detailed account-existence information.
          showMessage("If this email is registered with FIVE, a sign-in link can be sent. Check the address and try again.", "error");
        } else {
          showMessage(raw || "Could not send the email. Please try again.", "error");
        }
        return;
      }

      showMessage(
        mode === "signup"
          ? "Check your inbox for the one-time link to confirm your email and continue to FIVE. Also check your spam folder."
          : "If this email is registered with FIVE, a one-time sign-in link has been sent. Check your inbox and spam folder.",
        "success"
      );
    } catch (error) {
      console.error("FIVE passwordless email request failed:", error);
      showMessage("Something went wrong while sending the link. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  window.submitAuth = submitPasswordlessAuth;

  // Avoid native form submission/reload if Enter is pressed in the email field.
  emailInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitPasswordlessAuth();
    }
  });

  // A session may already exist after a magic-link redirect. Supabase restores
  // it from storage; app.js and five-account-ui.js keep their existing listeners.
  client.auth.getSession().then(({ data, error }) => {
    if (error) console.warn("FIVE could not inspect the current auth session:", error.message);
    if (data?.session?.user) {
      showMessage("You’re signed in. Your FIVE session is active.", "success");
    }
  }).catch((error) => console.warn("FIVE session restore check failed:", error));

  setMode("signin");
})();
