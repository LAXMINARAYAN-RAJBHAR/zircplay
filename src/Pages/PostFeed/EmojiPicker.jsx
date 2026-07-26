import React, { useEffect, useRef } from "react";

const EMOJI_LIST = [
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇",
  "😍","🥰","😘","😋","😛","😜","🤪","🤨","🧐","🤓","😎","🥳","😏",
  "😒","😞","😔","😟","🙁","😣","😖","😫","😩","🥺","😢","😭","😤",
  "😠","😡","🤯","😳","🥵","🥶","😱","😨","😰","🥱","😴","😵","🤐",
  "🥴","🤢","🤮","🤧","😷","🤒","🤠","👍","👎","👏","🙌","👌","✌️",
  "🤞","🤟","🤘","👊","✊","🤝","🙏","💪","❤️","🧡","💛","💚","💙",
  "💜","🖤","🤍","💔","💕","💞","💓","💗","💖","💘","🔥","✨","🎉",
  "🎊","💯","⭐","🌟","💫","🎈","🎁","👀","😂","🥲",
];

const EmojiPicker = ({ onSelect, onClose }) => {
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="pf-emoji-picker" ref={ref}>
      <div className="pf-emoji-picker-grid">
        {EMOJI_LIST.map((e, i) => (
          <button
            key={i}
            type="button"
            className="pf-emoji-picker-item"
            onClick={() => onSelect(e)}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;