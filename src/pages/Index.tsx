import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatWindow from "@/components/chat/ChatWindow";
import NewChatDialog from "@/components/chat/NewChatDialog";
import { useChat } from "@/hooks/useChat";
import { toast } from "sonner";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const {
    conversations,
    messages,
    currentProfile,
    selectedConversation,
    setSelectedConversation,
    sendMessage,
    createConversation,
    createGroupConversation,
    deleteConversation,
    getOtherUser,
    loading: chatLoading,
    onlineUsers,
    isTyping,
    sendTyping,
  } = useChat(user?.id || null);

  const activeConversations = conversations.map((c) => ({
    ...c,
    otherUser: {
      ...c.otherUser,
      is_online: onlineUsers.has(c.otherUser.user_id),
    },
  }));

  const activeOtherUser =
    activeConversations.find((c) => c.id === selectedConversation)?.otherUser || null;

  // If group, override activeOtherUser to display Group Name
  const selectedConv = activeConversations.find((c) => c.id === selectedConversation);
  const displayUser = selectedConv?.is_group
    ? {
      id: selectedConv.id,
      user_id: selectedConv.id, // dummy
      username: selectedConv.title || "Group Chat",
      avatar_url: null,
      is_online: false,
      last_seen: new Date().toISOString(),
    }
    : activeOtherUser;

  const handleLogout = async () => {
    await supabase
      .from("profiles")
      .update({ is_online: false, last_seen: new Date().toISOString() })
      .eq("user_id", user?.id);

    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const handleNewChat = (userId: string) => {
    createConversation(userId);
  };

  if (loading || chatLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center animate-pulse">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <ChatSidebar
        conversations={activeConversations}
        selectedConversation={selectedConversation}
        onSelectConversation={setSelectedConversation}
        onNewChat={() => setNewChatOpen(true)}
        onLogout={handleLogout}
        currentUser={currentProfile}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <ChatWindow
        messages={messages}
        currentUserId={user.id}
        otherUser={displayUser}
        onSendMessage={sendMessage}
        onClose={() => setSelectedConversation(null)}
        onDelete={() => selectedConversation && deleteConversation(selectedConversation)}
        isTyping={isTyping}
        onTyping={sendTyping}
      />
      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onSelectUser={handleNewChat}
        onCreateGroup={createGroupConversation}
        currentUserId={user.id}
        existingConversationUserIds={activeConversations.map((c) => c.otherUser.user_id)}
      />
    </div>
  );
};

export default Index;
