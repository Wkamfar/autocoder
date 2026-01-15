import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../crm/ui/CrmDesignSystem";
import { useAuth } from "../contexts/AuthContext";

function parseHash(): Record<string, string> {
  const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export default function WireOidcCallbackPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshUser, refreshOrganization } = useAuth();

  useEffect(() => {
    const run = async () => {
      const h = parseHash();
      const accessToken = h["accessToken"];
      const returnTo = h["returnTo"] || "/intents";

      if (!accessToken) {
        toast.push({ tone: "danger", message: "SSO login failed (missing token)" });
        navigate("/login", { replace: true });
        return;
      }

      localStorage.setItem("wire_auth_token", accessToken);
      // Clear the fragment to avoid leaving tokens in history.
      window.history.replaceState({}, document.title, window.location.pathname);

      try {
        await Promise.all([refreshUser(), refreshOrganization()]);
        toast.push({ tone: "success", message: "Signed in with SSO" });
        navigate(returnTo, { replace: true });
      } catch (e: any) {
        localStorage.removeItem("wire_auth_token");
        toast.push({ tone: "danger", message: e?.message || "Failed to finalize SSO login" });
        navigate("/login", { replace: true });
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="min-h-screen bg-white" />;
}

