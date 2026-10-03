import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import type { Socket } from "socket.io-client";
import "./ChatBox.css";

export interface ChatMessage {
  id: string;
  roomId?: string;
  userId: string;
  username: string;
  role: string;
  message: string;
  timestamp: string;
}

export interface ChatBoxProps {
  socket: Socket;
  roomId: string;
  currentUser?: {
    userId?: string;
    username?: string;
    role?: string;
  } | null;
}

// Format ISO date or string to localized time (e.g., 12:45 PM)
const formatMessageTime = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
};

// Avatar background and border colors based on role and name
const getChatAvatarColor = (name: string, role: string) => {
  if (role === "Host") {
    return { bg: "#fef3c7", text: "#92400e", border: "#fde68a" };
  }
  if (role === "Moderator") {
    return { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" };
  }

  const palettes = [
    { bg: "#ede9fe", text: "#6d28d9", border: "#ddd6fe" },
    { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" },
    { bg: "#fae8ff", text: "#a21caf", border: "#f5d0fe" },
    { bg: "#ffedd5", text: "#c2410c", border: "#fed7aa" },
    { bg: "#f1f5f9", text: "#334155", border: "#cbd5e1" },
  ];

  let sum = 0;
  for (let i = 0; i < (name || "").length; i++) {
    sum += name.charCodeAt(i);
  }
  return palettes[sum % palettes.length];
};

export const ChatBox: React.FC<ChatBoxProps> = ({
  socket,
  roomId,
  currentUser,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setUnreadCount(0);
      setShowScrollBottom(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle auto-scroll logic
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setShowScrollBottom(false);
  };

  const handleScroll = () => {
    const container = messagesScrollRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setShowScrollBottom(!isAtBottom);
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket || !roomId) return;

    // Reset messages when room changes
    setMessages([]);
    setUnreadCount(0);

    const handleIncomingMessage = (newMsg: ChatMessage) => {
      if (!newMsg || !newMsg.message) return;

      setMessages((prev) => {
        // Avoid duplicate message if already added
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      const isFromSelf =
        newMsg.userId === socket.id ||
        (currentUser?.username &&
          newMsg.username.toLowerCase() ===
            currentUser.username.toLowerCase());

      if (!isOpenRef.current) {
        if (!isFromSelf) {
          setUnreadCount((c) => c + 1);
        }
      } else {
        const container = messagesScrollRef.current;
        const isNearBottom =
          !container ||
          container.scrollHeight -
            container.scrollTop -
            container.clientHeight <
            100;

        if (isNearBottom || isFromSelf) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 50);
        } else {
          setShowScrollBottom(true);
        }
      }
    };

    const handleChatHistory = (data: { messages: ChatMessage[] }) => {
      if (Array.isArray(data?.messages)) {
        setMessages(data.messages);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        }, 50);
      }
    };

    socket.on("receive_message", handleIncomingMessage);
    socket.on("chat_message", handleIncomingMessage);
    socket.on("chat_history", handleChatHistory);

    // Request history if joining existing room
    socket.emit("get_chat_history", { roomId });

    return () => {
      socket.off("receive_message", handleIncomingMessage);
      socket.off("chat_message", handleIncomingMessage);
      socket.off("chat_history", handleChatHistory);
    };
  }, [socket, roomId, currentUser?.username]);

  // Scroll to bottom when opening for the first time
  useLayoutEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [isOpen]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmed = inputText.trim();
    if (!trimmed || !socket || !roomId) return;

    const currentSenderName =
      currentUser?.username || "Participant";
    const currentSenderRole =
      currentUser?.role || "Participant";

    const payload = {
      roomId,
      message: trimmed,
      username: currentSenderName,
      role: currentSenderRole,
    };

    // Emit message to server
    socket.emit("send_message", payload);

    setInputText("");
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <aside
      className="chat-box-root"
      aria-label="Room Live Chat Widget"
    >
      {/* FLOATING LAUNCHER BUTTON */}
      {!isOpen && (
        <button
          type="button"
          className="chat-launcher-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Open chat"
          title="Open Watch Party Chat"
        >
          <span className="chat-launcher-icon-wrapper">
            <svg
              className="chat-bubble-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <span className="chat-launcher-label">Chat</span>
          {unreadCount > 0 && (
            <span
              className="chat-unread-badge"
              aria-label={`${unreadCount} unread messages`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* CHAT WINDOW / DRAWER */}
      {isOpen && (
        <div className="chat-window-card" role="dialog" aria-modal="false" aria-label="Room Chat">
          {/* HEADER */}
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-title-row">
                <span className="chat-title">Live Chat</span>
                <span className="chat-room-badge">#{roomId}</span>
              </div>
              <span className="chat-subtitle">Party discussion</span>
            </div>

            <div className="chat-header-actions">
              <button
                type="button"
                className="chat-header-btn"
                onClick={() => setIsOpen(false)}
                title="Minimize chat"
                aria-label="Minimize chat"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </div>

          {/* MESSAGES HISTORY CONTAINER */}
          <div
            className="chat-messages-container"
            ref={messagesScrollRef}
            onScroll={handleScroll}
          >
            <div className="chat-party-notice">
              <span className="party-notice-tag">Room Synced</span>
              <span>Say hi to everyone watching along with you! 👋</span>
            </div>

            {messages.length === 0 ? (
              <div className="chat-empty-state">
                <svg
                  className="chat-empty-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                <div className="chat-empty-title">No messages yet</div>
                <div className="chat-empty-desc">
                  Be the first to send a message in this watch room!
                </div>
              </div>
            ) : (
              <div className="chat-messages-list">
                {messages.map((msg) => {
                  const isSelf =
                    msg.userId === socket.id ||
                    (currentUser?.username &&
                      msg.username.toLowerCase() ===
                        currentUser.username.toLowerCase());
                  const avatarColor = getChatAvatarColor(
                    msg.username,
                    msg.role
                  );
                  const formattedTime = formatMessageTime(msg.timestamp);

                  return (
                    <div
                      key={msg.id}
                      className={`chat-message-row ${
                        isSelf ? "self" : "other"
                      }`}
                    >
                      {!isSelf && (
                        <span
                          className="chat-avatar"
                          style={{
                            backgroundColor: avatarColor.bg,
                            color: avatarColor.text,
                            borderColor: avatarColor.border,
                          }}
                          aria-hidden="true"
                        >
                          {(msg.username || "U")[0].toUpperCase()}
                        </span>
                      )}

                      <div className="chat-message-bubble-wrapper">
                        <div className="chat-message-header">
                          <span className="chat-sender-name">
                            {msg.username}
                            {isSelf && (
                              <span className="chat-you-pill">you</span>
                            )}
                          </span>

                          <span
                            className={`chat-role-chip ${
                              msg.role === "Host"
                                ? "host"
                                : msg.role === "Moderator"
                                ? "moderator"
                                : "participant"
                            }`}
                          >
                            {msg.role}
                          </span>

                          {formattedTime && (
                            <span className="chat-timestamp">
                              {formattedTime}
                            </span>
                          )}
                        </div>

                        <div className="chat-message-content">
                          {msg.message}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* JUMP TO BOTTOM BUTTON */}
            {showScrollBottom && (
              <button
                type="button"
                className="chat-scroll-bottom-btn"
                onClick={() => scrollToBottom("smooth")}
                aria-label="Scroll to newest messages"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                New messages
              </button>
            )}
          </div>

          {/* INPUT FORM */}
          <form className="chat-input-form" onSubmit={handleSendMessage}>
            <input
              ref={inputRef}
              type="text"
              className="chat-input-field"
              placeholder="Send a chat... (Enter)"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={500}
              aria-label="Chat message input"
            />
            <button
              type="submit"
              className="chat-send-btn"
              disabled={!inputText.trim()}
              title="Send message"
              aria-label="Send message"
            >
              <svg
                className="chat-send-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </aside>
  );
};

export default ChatBox;
