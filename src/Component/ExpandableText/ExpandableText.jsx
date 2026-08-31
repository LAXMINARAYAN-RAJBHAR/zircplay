import React, { useState } from "react";
import { linkifyText } from "../../utils/linkify";

/**
 * Reusable "Show more / Show less" text truncator.
 * Used in PostCard (post text), Video (description), Reels (description).
 *
 * CHANGED: the displayed text is now run through linkifyText() so any
 * #hashtag becomes a link to /tag/:tag and any @mention becomes a link to
 * /user/:username — everywhere this component is already used gets this
 * for free with no call-site changes required. hashtagClassName /
 * mentionClassName are optional so each call site can theme them (e.g.
 * white-on-dark for reel captions vs. the default post-text color);
 * unset, they fall back to plain unstyled links.
 */
const ExpandableText = ({
  text,
  maxChars = 180,
  className = "",
  toggleClassName = "",
  hashtagClassName = "expandable-text-hashtag",
  mentionClassName = "expandable-text-mention",
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const isLong = text.length > maxChars;
  const displayText = expanded || !isLong ? text : text.slice(0, maxChars).trimEnd() + "…";

  return (
    <span className={className}>
      {linkifyText(displayText, { hashtagClassName, mentionClassName })}
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