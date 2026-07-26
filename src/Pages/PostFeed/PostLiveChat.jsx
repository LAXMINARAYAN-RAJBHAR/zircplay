import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../config/supabase";

const timeShort = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const PostLiveChat = ({ postId, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef();

  useEffect(() => {
    let active = true;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("post_live_chat")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (active) {
        setMessages(data || []);
        setLoading(false);
      }
    };
    fetchMessages();

    const channel = supabase
      .channel(`post-live-chat-${postId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_live_chat", filter: `post_id=eq.${postId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [postId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    setSending(true);
    const trimmed = text.trim();
    setText("");
    const { error } = await supabase
      .from("post_live_chat")
      .insert({ post_id: postId, username: currentUser, text: trimmed });
    if (error) setText(trimmed);
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="plc-wrap">
      <div className="plc-header">🟢 Live Chat</div>

      <div className="plc-messages">
        {loading ? (
          <p className="plc-empty">Loading chat…</p>
        ) : messages.length === 0 ? (
          <p className="plc-empty">No messages yet. Say hi!</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`plc-msg ${m.username === currentUser ? "plc-msg-mine" : ""}`}
            >
              <span className="plc-msg-user">{m.username}</span>
              <span className="plc-msg-text">{m.text}</span>
              <span className="plc-msg-time">{timeShort(m.created_at)}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="plc-input-row">
        <input
          className="plc-input"
          placeholder={
            !currentUser || currentUser === "anonymous"
              ? "Login to chat…"
              : "Type a message…"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!currentUser || currentUser === "anonymous"}
        />
        <button
          className="plc-send-btn"
          onClick={handleSend}
          disabled={!text.trim() || sending}
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default PostLiveChat;