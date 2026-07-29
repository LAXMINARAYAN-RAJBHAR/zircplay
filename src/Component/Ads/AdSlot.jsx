import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "./AdSlot.css";

const ADSENSE_CLIENT = "ca-pub-8117694407102446";

let scriptInjected = false;

// Injects the AdSense loader script once, no matter how many AdSlots
// mount. Safe to call from every AdSlot instance.
const ensureAdSenseScript = () => {
  if (scriptInjected || document.getElementById("adsbygoogle-script")) {
    scriptInjected = true;
    return;
  }
  const script = document.createElement("script");
  script.id = "adsbygoogle-script";
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
  scriptInjected = true;
};

/**
 * Reusable AdSense unit.
 *
 * variant: "banner" | "sidebar" | "in-feed" | "in-article" | "anchor"
 *   Controls sizing/layout only — you still need a real ad unit slot ID
 *   for each placement from your AdSense dashboard.
 * slot:    data-ad-slot ID from AdSense (per placement, not per page)
 */
const VARIANT_PROPS = {
  banner: { format: "auto", full: true },
  sidebar: { format: "auto", full: false },
  "in-feed": { format: "fluid", layout: "in-article" },
  "in-article": { format: "fluid", layout: "in-article" },
  anchor: { format: "auto", full: true },
};

const AdSlot = ({ slot, variant = "banner", className = "", style = {} }) => {
  const insRef = useRef(null);
  const location = useLocation();
  const [inView, setInView] = useState(variant === "anchor"); // anchor ads are always eligible immediately
  const wrapperRef = useRef(null);
  const pushedForKeyRef = useRef(null);

  // Lazy-load: only request the ad once the slot is actually near the
  // viewport. Matters most in the video/reels feed where a user may
  // never scroll far enough to see every slot.
  useEffect(() => {
    if (inView || !wrapperRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [inView]);

  useEffect(() => {
    if (!inView) return;
    ensureAdSenseScript();

    // Key by pathname+slot so a route change (React Router doesn't
    // reload the page) is treated as a fresh ad request instead of
    // silently no-op'ing on an already-filled <ins>.
    const key = `${location.pathname}:${slot}`;
    if (pushedForKeyRef.current === key) return;
    pushedForKeyRef.current = key;

    try {
      // eslint-disable-next-line no-undef
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      // AdSense throws if the script hasn't finished loading yet or the
      // slot already has content — safe to ignore, it'll retry on the
      // next route change / remount.
    }
  }, [inView, location.pathname, slot]);

  const variantProps = VARIANT_PROPS[variant] || VARIANT_PROPS.banner;

  return (
    <div
      ref={wrapperRef}
      className={`ad-slot ad-slot-${variant} ${className}`}
      style={style}
    >
      {inView && (
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: "block", ...(variantProps.full ? { width: "100%" } : {}) }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format={variantProps.format}
          data-full-width-responsive={variantProps.full ? "true" : undefined}
          data-ad-layout={variantProps.layout}
        />
      )}
    </div>
  );
};

export default AdSlot;