import React, { useState, useRef, useEffect, useCallback } from "react";
import "./PhotoViewer.css";

// Minimum horizontal drag distance (px), as a fraction of the
// viewport's own width, before a released drag commits to the
// next/previous photo instead of snapping back to the current one.
const SWIPE_COMMIT_RATIO = 0.18;

// Total movement (px, straight-line distance from where the gesture
// started) under which a press-and-release counts as a "tap" rather
// than a drag — this is what triggers closing the viewer. Kept small
// so a genuine (even short) swipe attempt is never mistaken for a tap.
const TAP_MAX_MOVEMENT = 10;

/*
 * PhotoViewer — Instagram-style full-screen, one-photo-at-a-time image
 * viewer for multi-image (and single-image) posts. Clicking any tile in
 * ImageGrid opens this, landing directly on the tapped photo.
 *
 * No like/comment/share panel — this is deliberately just the image,
 * full screen, nothing else. Navigation: swipe (touch), click-and-drag
 * (mouse), the on-screen ‹ › buttons, or ArrowLeft/ArrowRight — all
 * move exactly one photo at a time. Tapping the image itself (a press
 * with negligible movement) closes the viewer, same as the ✕ button or
 * Escape.
 *
 * Implementation: all photos sit in a flex row (.pv-track), each
 * exactly 100% of the viewport wide. The track's transform is driven by
 * currentIndex (its resting position) plus, while a drag is in
 * progress, a live pixel offset that follows the finger/mouse — so the
 * photo visibly tracks the gesture instead of only responding on
 * release. Releasing past SWIPE_COMMIT_RATIO of the viewport's width
 * commits to the next/previous photo; releasing with barely any
 * movement at all (under TAP_MAX_MOVEMENT) closes the viewer instead;
 * anything in between just snaps back to the current photo. A CSS
 * transition is toggled on/off so mid-drag tracking is instant (no lag
 * behind the finger) while the settle/commit animation itself is
 * smoothly eased.
 */
const PhotoViewer = ({
  images,        // array of URL strings (post.image_urls, or [post.image_url])
  startIndex = 0,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(Math.max(startIndex, 0), images.length - 1),
  );

  const viewportRef = useRef(null);

  // ── Drag state ──
  // dragOffset: live px offset applied on top of currentIndex's resting
  // position while a gesture is in progress (0 when not dragging).
  // isDragging drives whether the CSS transition is active — off while
  // actively tracking the finger, on for the settle animation.
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(null); // { x, y } | null
  const axisLockRef = useRef(null); // "horizontal" | "vertical" | null

  const goTo = useCallback(
    (index) => {
      setCurrentIndex(Math.min(Math.max(index, 0), images.length - 1));
    },
    [images.length],
  );

  const navigate = useCallback(
    (direction) => {
      goTo(currentIndex + direction);
    },
    [currentIndex, goTo],
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") navigate(-1);
      else if (e.key === "ArrowRight") navigate(1);
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, navigate]);

  const getViewportWidth = () => viewportRef.current?.clientWidth || window.innerWidth;

  const settleDrag = (dx, dy) => {
    const width = getViewportWidth();
    const commitThreshold = width * SWIPE_COMMIT_RATIO;
    const totalMovement = Math.sqrt(dx * dx + dy * dy);

    setDragOffset(0);
    setIsDragging(false);

    if (totalMovement < TAP_MAX_MOVEMENT) {
      onClose();
      return;
    }
    if (Math.abs(dx) > commitThreshold) {
      navigate(dx < 0 ? 1 : -1);
    }
    // else: dragOffset already reset to 0 above, which snaps back to
    // the current photo now that isDragging is false.
  };

  // ── Touch handlers ──
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    dragStartRef.current = { x: t.clientX, y: t.clientY };
    axisLockRef.current = null;
  };

  const handleTouchMove = (e) => {
    if (!dragStartRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - dragStartRef.current.x;
    const dy = t.clientY - dragStartRef.current.y;

    if (!axisLockRef.current) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        axisLockRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
    }

    if (axisLockRef.current === "horizontal") {
      e.preventDefault();
      setIsDragging(true);
      const atStart = currentIndex === 0 && dx > 0;
      const atEnd = currentIndex === images.length - 1 && dx < 0;
      setDragOffset(atStart || atEnd ? dx / 2.5 : dx);
    }
  };

  const handleTouchEnd = (e) => {
    if (!dragStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - dragStartRef.current.x;
    const dy = t.clientY - dragStartRef.current.y;
    dragStartRef.current = null;
    axisLockRef.current = null;
    settleDrag(dx, dy);
  };

  // ── Mouse drag handlers (desktop) ──
  const handleMouseDown = (e) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    axisLockRef.current = "horizontal"; // mouse drag is always intentional
  };

  const handleMouseMoveGlobal = useCallback(
    (e) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      // Only start visually dragging once movement is clearly
      // deliberate — keeps a plain click feeling like a plain click.
      if (!isDragging && Math.sqrt(dx * dx + dy * dy) > 4) setIsDragging(true);
      const atStart = currentIndex === 0 && dx > 0;
      const atEnd = currentIndex === images.length - 1 && dx < 0;
      setDragOffset(atStart || atEnd ? dx / 2.5 : dx);
    },
    [currentIndex, images.length, isDragging],
  );

  const handleMouseUpGlobal = useCallback(
    (e) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      dragStartRef.current = null;
      axisLockRef.current = null;
      settleDrag(dx, dy);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentIndex],
  );

  // Mouse drag needs page-level listeners since the pointer can move
  // (and be released) outside the viewport element mid-drag. Attached
  // as soon as mousedown fires (not gated on isDragging, since that
  // itself only flips true after a few px of movement — we still need
  // to catch the eventual mouseup even for a movement-free click).
  useEffect(() => {
    const onMove = (e) => handleMouseMoveGlobal(e);
    const onUp = (e) => handleMouseUpGlobal(e);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [handleMouseMoveGlobal, handleMouseUpGlobal]);

  const trackStyle = {
    transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
    transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
  };

  return (
    <div className="pv-overlay">
      <button
        className="pv-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
      >
        ✕
      </button>

      {images.length > 1 && (
        <span className="pv-block-counter pv-block-counter--fixed">
          {currentIndex + 1} / {images.length}
        </span>
      )}

      {images.length > 1 && currentIndex > 0 && (
        <button
          type="button"
          className="pv-nav-btn pv-nav-btn--prev pv-nav-btn--fixed"
          onClick={(e) => {
            e.stopPropagation();
            navigate(-1);
          }}
          aria-label="Previous photo"
        >
          ‹
        </button>
      )}
      {images.length > 1 && currentIndex < images.length - 1 && (
        <button
          type="button"
          className="pv-nav-btn pv-nav-btn--next pv-nav-btn--fixed"
          onClick={(e) => {
            e.stopPropagation();
            navigate(1);
          }}
          aria-label="Next photo"
        >
          ›
        </button>
      )}

      <div
        className="pv-viewport"
        ref={viewportRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? "grabbing" : "zoom-out" }}
      >
        <div className="pv-track" style={trackStyle}>
          {images.map((src, i) => (
            <div className="pv-slide pv-slide--image-only" key={i}>
              <img
                src={src}
                alt={`Photo ${i + 1}`}
                className="pv-block-image pv-block-image--full"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PhotoViewer;