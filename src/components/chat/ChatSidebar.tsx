import { useState } from "react";
import { Search, Plus, LogOut, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string;
}

interface Conversation {
  id: string;
  otherUser: Profile;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onLogout: () => void;
  currentUser: Profile | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const ChatSidebar = ({
  conversations,
  selectedConversation,
  onSelectConversation,
  onNewChat,
  onLogout,
  currentUser,
  searchQuery,
  onSearchChange,
}: ChatSidebarProps) => {
  const filteredConversations = conversations.filter((conv) =>
    conv.otherUser.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="w-80 h-full bg-chat-sidebar border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Messages</h1>
              <p className="text-xs text-muted-foreground">
                {currentUser?.username || "Loading..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewChat}
              className="rounded-lg hover:bg-chat-sidebar-hover"
            >
              <Plus className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className="rounded-lg hover:bg-chat-sidebar-hover text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-muted border-0 focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </p>
            <Button
              variant="link"
              onClick={onNewChat}
              className="mt-2 text-primary"
            >
              Start a new chat
            </Button>
          </div>
        ) : (
          <div className="py-2">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={cn(
                  "w-full p-3 flex items-center gap-3 hover:bg-chat-sidebar-hover transition-colors",
                  selectedConversation === conv.id && "bg-chat-sidebar-hover"
                )}
              >
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={conv.otherUser.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(conv.otherUser.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-chat-sidebar",
                      conv.otherUser.is_online ? "bg-online pulse-online" : "bg-offline"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground truncate">
                      {conv.otherUser.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(conv.lastMessageTime)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {conv.lastMessage || "Start a conversation"}
                  </p>
                </div>
                {conv.unreadCount && conv.unreadCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
