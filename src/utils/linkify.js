import React from "react";
import { Link } from "react-router-dom";

// ── Regexes ──
// Hashtags: letters/digits/underscore only, matching common convention.
// Mentions: also allows dots, since usernames elsewhere in the app (e.g.
// auto-generated ones like "user_41859fe2") can contain underscores, and
// this keeps room for dotted handles without over-matching punctuation.
const HASHTAG_REGEX = /#([a-zA-Z0-9_]+)/g;
const MENTION_REGEX = /@([a-zA-Z0-9_.]+)/g;
// Same two patterns, but wrapped in a capturing group so String.split()
// keeps the matched tokens in the output array instead of discarding them.
const COMBINED_SPLIT_REGEX = /(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_.]+)/g;

const HASHTAG_TOKEN_TEST = /^#[a-zA-Z0-9_]+$/;
const MENTION_TOKEN_TEST = /^@[a-zA-Z0-9_.]+$/;

// NOTE / known limitation: this is a plain-text tokenizer, not a full
// parser — a URL containing "#" (e.g. "https://x.com/page#section") or
// "@" (e.g. an email address) will get partially linkified as if it were
// a hashtag/mention. None of the call sites in this app currently render
// raw URLs alongside hashtag/mention text in the same field, so this
// hasn't mattered in practice; worth revisiting if that changes.

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
 * Splits `text` into plain-text segments plus clickable <Link>s for every
 * #hashtag (→ /tag/:tag) and @mention (→ /user/:username) found in it.
 * Returns an array ready to drop straight into JSX (e.g. {linkifyText(...)}).
 *
 * className props let each call site style hashtags/mentions to match its
 * own theme (dark reel captions vs. light post text, etc.) without this
 * helper hardcoding any color itself.
 */
export const linkifyText = (
  text,
  { hashtagClassName = "", mentionClassName = "" } = {},
) => {
  if (!text) return null;

  const parts = text
    .split(COMBINED_SPLIT_REGEX)
    .filter((p) => p !== undefined && p !== "");

  return parts.map((part, i) => {
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