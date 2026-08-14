import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_URL } from "../../auth/api";

const BrandingContext = createContext({
  branding: null,
  assetUrl: (path) => path || "",
  refresh: async () => {},
});

const CACHE_KEY = "ct_branding_v1";

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function applyDom(branding) {
  if (!branding) return;
  const title = branding.nombre_sistema || "CrimeTrack";
  document.title = title;

  const href = branding.favicon_url
    ? branding.favicon_url.startsWith("http")
      ? branding.favicon_url
      : `${API_URL}${branding.favicon_url}`
    : null;

  let link = document.querySelector("link[rel='icon']");
  if (href) {
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }

  if (branding.color_principal) {
    document.documentElement.style.setProperty(
      "--ct-brand",
      branding.color_principal
    );
  }
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(() => readCache());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/saas/public/branding/`);
      if (!res.ok) return;
      const data = await res.json();
      setBranding(data);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      applyDom(data);
    } catch {
      /* silencioso: usa cache / defaults */
    }
  }, []);

  useEffect(() => {
    applyDom(branding);
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("crimetrack:branding-updated", onUpdate);
    return () => window.removeEventListener("crimetrack:branding-updated", onUpdate);
  }, [refresh]);

  function assetUrl(path) {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:")) {
      return path;
    }
    return `${API_URL}${path}`;
  }

  return (
    <BrandingContext.Provider value={{ branding, assetUrl, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}

export function notifyBrandingUpdated() {
  window.dispatchEvent(new Event("crimetrack:branding-updated"));
}
