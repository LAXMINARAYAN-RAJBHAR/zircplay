const CLOUDINARY_QUALITY_TRANSFORMS = {
  low: "q_auto:low,w_426,h_240,c_limit",
  medium: "q_auto:good,w_640,h_360,c_limit",
  high: "q_auto:best,w_1280,h_720,c_limit",
};

/**
 * Injects a Cloudinary resolution/quality transform into a video URL.
 * Only touches Cloudinary-hosted URLs — external/hardcoded demo URLs
 * (w3schools, mixkit, pexels, etc.) are returned unchanged since we
 * have no control over their delivery pipeline.
 */
export const getAdaptiveVideoSrc = (src, quality = "high") => {
  if (!src || !src.includes("cloudinary.com") || !src.includes("/video/upload/")) {
    return src;
  }
  const transform = CLOUDINARY_QUALITY_TRANSFORMS[quality] || CLOUDINARY_QUALITY_TRANSFORMS.high;
  // Strip any existing transform segment right after /video/upload/ to avoid stacking
  const cleaned = src.replace(/\/video\/upload\/(?:[^/]+,)*[^/]+\//, "/video/upload/");
  return cleaned.replace("/video/upload/", `/video/upload/${transform}/`);
};