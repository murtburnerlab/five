/* FIVE — passwordless email authentication
 * Replace the existing five-password-recovery.js with this file.
 * Google OAuth remains handled by five-auth-buttons.js and is not modified.
 */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  let sending = false;
  let magicLinkClient = null;

  const style = document.createElement("style");
  style.id = "five-passwordless-auth-styles";
  style.textContent = `
    /* Keep legacy password controls in the DOM for compatibility with app.js,
       but remove them completely from the visible authentication interface. */
    #authPassword,
    #authPasswordConfirm,
    #authPasswordConfirmField,
    #forgotPasswordButton {
      display: none !important;
    }
    #auth .form .field:has(#authPassword) {
      display: none !important;
    }
    #auth .form .field:has(#authPasswordConfirm) {
      display: none !important;
    }
    #auth .auth-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }
    #auth #authSubmit {
      width: 100%;
      min-height: 54px;
    }
    #auth #authModeSwitch {
      width: 100%;
      min-height: 50px;
    }
    #auth .auth-actions #signOutButton {
      width: 100%;
    }
  `;
  document.head.appendChild(style);

  function client() {
    if (magicLinkClient) return magicLinkClient;
    if (!window.supabase?.createClient || !window.FIVE_SUPABASE_URL || !window.FIVE_SUPABASE_KEY) {
      throw new Error("Authentication is temporarily unavailable. Please try again later.");
    }
    magicLinkClient = window.supabase.createClient(
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
    return magicLinkClient;
  }

  function setMessage(text, type = "") {
    const el = $("authMessage");
    if (!el) return;
    el.textContent = text || "";
    el.className = "message" + (type ? " " + type : "");
    el.classList.toggle("hidden", !text);
  }

  function setBusy(busy, mode) {
    const button = $("authSubmit");
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy
      ? (mode === "signup" ? "SENDING LINK..." : "SENDING LINK...")
      : (mode === "signup" ? "CREATE ACCOUNT" : "SIGN IN");
  }

  function currentMode() {
    return $("authTitle")?.textContent?.trim().toUpperCase() === "CREATE ACCOUNT"
      ? "signup"
      : "signin";
  }

  function normalizeMode(mode) {
    return mode === "signup" ? "signup" : "signin";
  }

  const originalSetAuthMode = window.setAuthMode;
  if (typeof originalSetAuthMode === "function") {
    window.setAuthMode = function(mode) {
      const normalized = normalizeMode(mode);
      const result = originalSetAuthMode(normalized);
      const title = $("authTitle");
      const copy = $("authCopy");
      const submit = $("authSubmit");
      if (title) title.textContent = normalized === "signup" ? "CREATE ACCOUNT" : "SIGN IN";
      if (copy) {
        copy.textContent = normalized === "signup"
          ? "Enter your email and we’ll send you a secure sign-in link."
          : "Enter the email address associated with your FIVE account. We’ll email you a secure sign-in link.";
      }
      if (submit) {
        submit.textContent = normalized === "signup" ? "CREATE ACCOUNT" : "SIGN IN";
        submit.disabled = false;
      }
      setMessage("");
      return result;
    };
  }

  window.submitAuth = async function() {
    if (sending) return;

    const emailInput = $("authEmail");
    const email = (emailInput?.value || "").trim();
    const mode = currentMode();

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

    sending = true;
    setBusy(true, mode);
    setMessage("");

    try {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await client().auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: mode === "signup",
          emailRedirectTo: redirectTo
        }
      });

      if (error) {
        const raw = String(error.message || "");
        if (mode === "signin" && /signups not allowed|user not found|unable to validate email/i.test(raw)) {
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
          ? "Check your inbox. Open the email from FIVE to confirm your address and activate your account. If it doesn’t arrive, check your spam folder."
          : "Check your inbox for your secure FIVE sign-in link. If it doesn’t arrive, check your spam folder.",
        "success"
      );
    } catch (error) {
      setMessage(error?.message || "Could not send the email link. Please try again.", "error");
    } finally {
      sending = false;
      setBusy(false, mode);
    }
  };

  // Keep the current page's existing mode switch and Google button.
  // Remove the obsolete password-recovery entry point and confirmation behavior.
  document.addEventListener("DOMContentLoaded", () => {
    $("forgotPasswordButton")?.remove();
    // Keep legacy password nodes in the DOM because app.js references them,
    // but hide them with CSS so the old mode switch remains compatible.

    const email = $("authEmail");
    if (email) {
      email.type = "email";
      email.autocomplete = "email";
      email.required = true;
      email.placeholder = "you@example.com";
    }

    if (typeof window.setAuthMode === "function") {
      window.setAuthMode("signin");
    } else {
      const title = $("authTitle");
      const copy = $("authCopy");
      if (title) title.textContent = "SIGN IN";
      if (copy) copy.textContent = "Enter the email address associated with your FIVE account. We’ll email you a secure sign-in link.";
    }
  });

  // The scripts are loaded at the end of body, after the auth markup exists.
  $("forgotPasswordButton")?.remove();
  // Do not remove legacy password nodes: app.js still references them.
  // They are hidden by the stylesheet injected above.

  const email = $("authEmail");
  if (email) {
    email.type = "email";
    email.autocomplete = "email";
    email.required = true;
    email.placeholder = "you@example.com";
  }

  // Set the initial copy without changing the existing Google OAuth implementation.
  const copy = $("authCopy");
  if (copy) copy.textContent = "Enter the email address associated with your FIVE account. We’ll email you a secure sign-in link.";
})();
