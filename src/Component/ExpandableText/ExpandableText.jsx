import React, { useState } from "react";

/**
 * Reusable "Show more / Show less" text truncator.
 * Used in PostCard (post text), Video (description), Reels (description).
 */
const ExpandableText = ({
  text,
  maxChars = 180,
  className = "",
  toggleClassName = "",
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const isLong = text.length > maxChars;
  const displayText = expanded || !isLong ? text : text.slice(0, maxChars).trimEnd() + "…";

  return (
    <span className={className}>
      {displayText}
      {isLong && (
        <span
          className={`expandable-text-toggle ${toggleClassName}`}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? " Show less" : " Show more"}
        </span>
      )}
    </span>
  );
};

export default ExpandableText;