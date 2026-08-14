import React from "react";
import { useLinkPreview } from "../../utils/useLinkPreview";

// Shared link-preview card rendered under a chat bubble's linkified text.
// Used by both 1:1 chat (MessagesPanel, classPrefix="mp") and group chat
// (GroupChatWindow, classPrefix="gcw") — each surface keeps its own CSS
// classes/styling (mp-link-*, gcw-link-*) matching how the rest of this
// codebase keeps each chat window's stylesheet self-contained, while the
// data-fetching and markup logic itself is shared here.
const LinkPreviewCard = ({ url, mine, classPrefix }) => {
  const entry = useLinkPreview(url);
  const p = classPrefix;

  if (!entry || entry.status === "loading") {
    return (
      <div className={`${p}-link-loading${mine ? " mine" : ""}`}>
        Fetching link preview…
      </div>
    );
  }

  if (entry.status === "error" || !entry.data) return null;

  const { title, desc, image, domain } = entry.data;
  // Nothing worth showing (e.g. a plain non-HTML URL) — the inline
  // hyperlink in the message text is already enough in that case.
  if (!title && !image) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${p}-link-card${mine ? " mine" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      {image && (
        <img src={image} alt="" className={`${p}-link-image`} loading="lazy" />
      )}
      <div className={`${p}-link-body`}>
        {domain && <p className={`${p}-link-domain`}>{domain}</p>}
        {title && <p className={`${p}-link-title`}>{title}</p>}
        {desc && <p className={`${p}-link-desc`}>{desc}</p>}
      </div>
    </a>
  );
};

export default LinkPreviewCard;