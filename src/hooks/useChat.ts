import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_delivered: boolean;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  id: string;
  otherUser: Profile;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

export const useChat = (userId: string | null) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch current user's profile
  useEffect(() => {
    if (!userId) return;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }

      setCurrentProfile(data);

      // Update online status
      await supabase
        .from("profiles")
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq("user_id", userId);
    };

    fetchProfile();

    // Set offline on unmount
    return () => {
      if (userId) {
        supabase
          .from("profiles")
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq("user_id", userId);
      }
    };
  }, [userId]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!userId) return;

    try {
      // Get conversations where the user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId);

      if (participantError) throw participantError;

      const conversationIds = participantData?.map((p) => p.conversation_id) || [];

      if (conversationIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get all participants for these conversations
      const { data: allParticipants, error: allPartError } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", conversationIds);

      if (allPartError) throw allPartError;

      // Get other users' IDs
      const otherUserIds = allParticipants
        ?.filter((p) => p.user_id !== userId)
        .map((p) => ({ conversationId: p.conversation_id, userId: p.user_id })) || [];

      if (otherUserIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get profiles for other users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", otherUserIds.map((o) => o.userId));

      if (profilesError) throw profilesError;

      // Get last message for each conversation
      const { data: lastMessages, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });

      if (messagesError) throw messagesError;

      // Build conversations array
      const convs: Conversation[] = otherUserIds.map((item) => {
        const profile = profiles?.find((p) => p.user_id === item.userId);
        const convMessages = lastMessages?.filter(
          (m) => m.conversation_id === item.conversationId
        );
        const lastMsg = convMessages?.[0];
        const unreadCount = convMessages?.filter(
          (m) => m.sender_id !== userId && !m.is_read
        ).length;

        return {
          id: item.conversationId,
          otherUser: profile!,
          lastMessage: lastMsg?.content,
          lastMessageTime: lastMsg?.created_at,
          unreadCount,
        };
      });

      // Sort by last message time
      convs.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });

      setConversations(convs);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversation || !userId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConversation)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      setMessages(data || []);

      // Mark messages as read
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", selectedConversation)
        .neq("sender_id", userId);
    };

    fetchMessages();
  }, [selectedConversation, userId]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!selectedConversation) return;

    const channel = supabase
      .channel(`messages-${selectedConversation}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversation}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);

          // Mark as read if not from current user
          if (newMessage.sender_id !== userId) {
            supabase
              .from("messages")
              .update({ is_read: true, is_delivered: true })
              .eq("id", newMessage.id);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversation}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, userId]);

  // Subscribe to profile updates for online status
  useEffect(() => {
    const channel = supabase
      .channel("profiles-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          const updatedProfile = payload.new as Profile;
          setConversations((prev) =>
            prev.map((conv) =>
              conv.otherUser.user_id === updatedProfile.user_id
                ? { ...conv, otherUser: updatedProfile }
                : conv
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Send message
  const sendMessage = async (content: string) => {
    if (!selectedConversation || !userId) return;

    const { error } = await supabase.from("messages").insert({
      conversation_id: selectedConversation,
      sender_id: userId,
      content,
      is_delivered: true,
    });

    if (error) {
      console.error("Error sending message:", error);
      toast.error(`Failed to send message: ${error.message}`);
    }
  };

  // Create new conversation
  const createConversation = async (otherUserId: string) => {
    if (!userId) return null;

    try {
      // Check if conversation already exists
      const { data: myConvs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId);

      const { data: otherConvs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", otherUserId);

      const myConvIds = myConvs?.map((c) => c.conversation_id) || [];
      const otherConvIds = otherConvs?.map((c) => c.conversation_id) || [];
      const existingConvId = myConvIds.find((id) => otherConvIds.includes(id));

      if (existingConvId) {
        setSelectedConversation(existingConvId);
        return existingConvId;
      }

      // Fetch other user profile for optimistic update
      const { data: otherUserProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", otherUserId)
        .single();

      // Create new conversation
      const newConvId = crypto.randomUUID();

      const { error: convError } = await supabase
        .from("conversations")
        .insert({ id: newConvId });

      if (convError) throw convError;

      // Add participants
      const { error: partError } = await supabase
        .from("conversation_participants")
        .insert([
          { conversation_id: newConvId, user_id: userId },
          { conversation_id: newConvId, user_id: otherUserId },
        ]);

      if (partError) throw partError;

      // Optimistic update
      if (otherUserProfile) {
        const newConv: Conversation = {
          id: newConvId,
          otherUser: otherUserProfile,
          unreadCount: 0,
        };
        setConversations((prev) => [newConv, ...prev]);
      }

      setSelectedConversation(newConvId);
      fetchConversations(); // Background fetch to confirm
      return newConvId;
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast.error("Failed to create conversation");
      return null;
    }
  };

  const getOtherUser = () => {
    const conv = conversations.find((c) => c.id === selectedConversation);
    return conv?.otherUser || null;
  };

  return {
    conversations,
    messages,
    currentProfile,
    selectedConversation,
    setSelectedConversation,
    sendMessage,
    createConversation,
    getOtherUser,
    loading,
    fetchConversations,
  };
};
