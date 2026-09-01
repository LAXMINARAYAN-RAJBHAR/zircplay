import React, { useState } from "react";
import { linkifyText, closeDanglingBold } from "../../utils/linkify";

/**
 * Reusable "Show more / Show less" text truncator.
 * Used in PostCard (post text), Video (description), Reels (description).
 *
 * The displayed text is run through linkifyText() so any **bold** span
 * renders bold, any #hashtag links to /tag/:tag, and any @mention links
 * to /user/:username — everywhere this component is already used gets
 * this for free with no call-site changes required.
 *
 * closeDanglingBold() runs on the truncated string BEFORE linkifying —
 * slicing raw text at maxChars can land in the middle of a **bold**
 * span, leaving one unmatched "**" that would otherwise render as two
 * literal asterisks instead of finishing the bold run cleanly.
 */
const ExpandableText = ({
  text,
  maxChars = 180,
  className = "",
  toggleClassName = "",
  hashtagClassName = "expandable-text-hashtag",
  mentionClassName = "expandable-text-mention",
  boldClassName = "",
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const isLong = text.length > maxChars;
  const rawDisplayText = expanded || !isLong ? text : text.slice(0, maxChars).trimEnd() + "…";
  const displayText = isLong && !expanded ? closeDanglingBold(rawDisplayText) : rawDisplayText;

  return (
    <span className={className}>
      {linkifyText(displayText, { hashtagClassName, mentionClassName, boldClassName })}
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