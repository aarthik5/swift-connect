import { useState, useRef, useEffect } from "react";
import { Send, Phone, Video, MoreVertical, Check, CheckCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_delivered: boolean;
  is_read: boolean;
}

interface Profile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string;
}

interface ChatWindowProps {
  messages: Message[];
  currentUserId: string;
  otherUser: Profile | null;
  onSendMessage: (content: string) => void;
  isTyping?: boolean;
}

const ChatWindow = ({
  messages,
  currentUserId,
  otherUser,
  onSendMessage,
  isTyping,
}: ChatWindowProps) => {
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage("");
      inputRef.current?.focus();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatLastSeen = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";

    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toLocaleDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
  };

  if (!otherUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Send className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Select a conversation
          </h2>
          <p className="text-muted-foreground">
            Choose a chat from the sidebar to start messaging
          </p>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="h-16 px-4 border-b border-border flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="w-10 h-10">
              <AvatarImage src={otherUser.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(otherUser.username)}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card",
                otherUser.is_online ? "bg-online" : "bg-offline"
              )}
            />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{otherUser.username}</h2>
            <p className="text-xs text-muted-foreground">
              {otherUser.is_online
                ? "Online"
                : `Last seen ${formatLastSeen(otherUser.last_seen)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="rounded-lg">
            <Phone className="w-5 h-5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-lg">
            <Video className="w-5 h-5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-lg">
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {messageGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* Date header */}
            <div className="flex items-center justify-center my-4">
              <span className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded-full">
                {formatDateHeader(group.date)}
              </span>
            </div>

            {/* Messages for this date */}
            {group.messages.map((message, index) => {
              const isSent = message.sender_id === currentUserId;
              const showAvatar =
                !isSent &&
                (index === 0 ||
                  group.messages[index - 1].sender_id !== message.sender_id);

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex mb-1 message-enter",
                    isSent ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-end gap-2 max-w-[70%]",
                      isSent && "flex-row-reverse"
                    )}
                  >
                    {!isSent && showAvatar ? (
                      <Avatar className="w-7 h-7 mb-1">
                        <AvatarImage src={otherUser.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(otherUser.username)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      !isSent && <div className="w-7" />
                    )}

                    <div
                      className={cn(
                        "px-4 py-2 max-w-full",
                        isSent ? "chat-bubble-sent" : "chat-bubble-received"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      <div
                        className={cn(
                          "flex items-center gap-1 mt-1",
                          isSent ? "justify-end" : "justify-start"
                        )}
                      >
                        <span
                          className={cn(
                            "text-[10px]",
                            isSent ? "text-white/70" : "text-muted-foreground"
                          )}
                        >
                          {formatMessageTime(message.created_at)}
                        </span>
                        {isSent && (
                          <span className="text-white/70">
                            {message.is_read ? (
                              <CheckCheck className="w-3.5 h-3.5" />
                            ) : message.is_delivered ? (
                              <CheckCheck className="w-3.5 h-3.5 opacity-60" />
                            ) : (
                              <Check className="w-3.5 h-3.5 opacity-60" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 mb-2">
            <Avatar className="w-7 h-7">
              <AvatarImage src={otherUser.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials(otherUser.username)}
              </AvatarFallback>
            </Avatar>
            <div className="chat-bubble-received px-4 py-3">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-background border-input focus-visible:ring-1 focus-visible:ring-primary"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!newMessage.trim()}
            className="gradient-primary hover:gradient-primary-hover h-10 w-10 rounded-xl"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatWindow;
