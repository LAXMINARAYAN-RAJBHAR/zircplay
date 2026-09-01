import React from "react";
import { Link } from "react-router-dom";

// ── Regexes ──
// Hashtags: letters/digits/underscore only, matching common convention.
// Mentions: also allows dots, since usernames elsewhere in the app (e.g.
// auto-generated ones like "user_41859fe2") can contain underscores, and
// this keeps room for dotted handles without over-matching punctuation.
// Bold: WhatsApp/Discord-style **text** — no nested/overlapping markers,
// no empty **content** allowed (requires at least one non-* character).
const HASHTAG_REGEX = /#([a-zA-Z0-9_]+)/g;
const MENTION_REGEX = /@([a-zA-Z0-9_.]+)/g;
const BOLD_REGEX = /\*\*([^*]+)\*\*/g;

// Same three patterns, but wrapped in a single capturing group so
// String.split() keeps every matched token in the output array instead
// of discarding them. Order matters here only in that bold is checked
// first below (see linkifyText) so "**@not_a_mention**" renders as bold
// rather than accidentally matching the mention pattern inside it.
const COMBINED_SPLIT_REGEX = /(\*\*[^*]+\*\*|#[a-zA-Z0-9_]+|@[a-zA-Z0-9_.]+)/g;

const BOLD_TOKEN_TEST = /^\*\*([^*]+)\*\*$/;
const HASHTAG_TOKEN_TEST = /^#[a-zA-Z0-9_]+$/;
const MENTION_TOKEN_TEST = /^@[a-zA-Z0-9_.]+$/;

// NOTE / known limitation: this is a plain-text tokenizer, not a full
// parser — a URL containing "#" (e.g. "https://x.com/page#section") or
// "@" (e.g. an email address) will get partially linkified as if it were
// a hashtag/mention. None of the call sites in this app currently render
// raw URLs alongside hashtag/mention/bold text in the same field, so
// this hasn't mattered in practice; worth revisiting if that changes.

/** Every unique hashtag (lowercased, no "#") found in `text`. */
export const extractHashtags = (text) => {
  if (!text) return [];
  const matches = text.match(HASHTAG_REGEX) || [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
};

/** Every unique @mentioned username (no "@", case preserved) found in `text`. */
export const extractMentions = (text) => {
  if (!text) return [];
  const matches = text.match(MENTION_REGEX) || [];
  return [...new Set(matches.map((m) => m.slice(1)))];
};

/**
 * Splits `text` on the closest incomplete **bold** marker so truncation
 * (e.g. ExpandableText's maxChars cut) never leaves a single dangling
 * "**" at the very end, which would otherwise render as two literal
 * asterisks instead of either finishing or dropping the bold span.
 * If the slice ends mid-bold-span, it closes the span right there so
 * whatever text made it into the truncated string still renders bold.
 */
export const closeDanglingBold = (text) => {
  const starPairs = (text.match(/\*\*/g) || []).length;
  if (starPairs % 2 === 1) return text + "**";
  return text;
};

/**
 * Splits `text` into plain-text segments plus:
 *   - <strong> for every **bold** span
 *   - <Link> to /tag/:tag for every #hashtag
 *   - <Link> to /user/:username for every @mention
 * Returns an array ready to drop straight into JSX (e.g. {linkifyText(...)}).
 *
 * className props let each call site style these to match its own theme
 * (dark reel captions vs. light post text, etc.) without this helper
 * hardcoding any color/weight itself beyond <strong>'s default boldness.
 */
export const linkifyText = (
  text,
  { hashtagClassName = "", mentionClassName = "", boldClassName = "" } = {},
) => {
  if (!text) return null;

  const parts = text
    .split(COMBINED_SPLIT_REGEX)
    .filter((p) => p !== undefined && p !== "");

  return parts.map((part, i) => {
    if (BOLD_TOKEN_TEST.test(part)) {
      const inner = part.slice(2, -2);
      return (
        <strong key={i} className={boldClassName}>
          {inner}
        </strong>
      );
    }
    if (HASHTAG_TOKEN_TEST.test(part)) {
      const tag = part.slice(1);
      return (
        <Link
          key={i}
          to={`/tag/${tag.toLowerCase()}`}
          className={hashtagClassName}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
      );
    }
    if (MENTION_TOKEN_TEST.test(part)) {
      const username = part.slice(1);
      return (
        <Link
          key={i}
          to={`/user/${username}`}
          className={mentionClassName}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};