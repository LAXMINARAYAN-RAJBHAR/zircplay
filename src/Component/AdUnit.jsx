import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Reusable AdSense ad unit.
 *
 * Usage:
 *   <AdUnit slot="1234567890" />
 *   <AdUnit slot="1234567890" format="fluid" layout="in-article" />
 *
 * Get `slot` values from your AdSense dashboard > Ads > By ad unit,
 * after creating a display ad unit there.
 */
export default function AdUnit({ slot, format = 'auto', layout, style, className }) {
  const insRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    // Re-push on every route change so ads render on client-side navigation,
    // which AdSense's script doesn't detect on its own in an SPA.
    try {
      if (window.adsbygoogle && insRef.current) {
        // Avoid double-pushing into the same <ins> element
        if (!insRef.current.getAttribute('data-adsbygoogle-status')) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      }
    } catch (err) {
      console.error('AdSense push failed:', err);
    }
  }, [location.pathname]);

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle ${className || ''}`}
      style={style || { display: 'block' }}
      data-ad-client="ca-pub-8117694407102446"
      data-ad-slot={slot}
      data-ad-format={format}
      data-ad-layout={layout}
      data-full-width-responsive="true"
    />
  );
}