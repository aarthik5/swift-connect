import { useState, useEffect, useCallback, useRef } from "react";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string;
  created_at?: string;
  updated_at?: string;
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
  title?: string;
  is_group?: boolean;
}

export const useChat = (userId: string | null) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedConvRef = useRef<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Ref to access current conversations in subscription callback without re-subscribing
  const conversationsRef = useRef<Conversation[]>([]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConvRef.current = selectedConversation;
  }, [selectedConversation]);

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

      await supabase
        .from("profiles")
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq("user_id", userId);
    };

    fetchProfile();
  }, [userId]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!userId) return;

    try {
      const { data: participantData, error: participantError } = await supabase
        .from("conversation_participants")
        .select("conversation_id, cleared_at")
        .eq("user_id", userId);

      if (participantError) throw participantError;

      const conversationIds = participantData?.map((p) => p.conversation_id) || [];
      const clearedAtMap = new Map(participantData?.map(p => [p.conversation_id, p.cleared_at]) || []);

      if (conversationIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const { data: convMetadata, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .in("id", conversationIds);

      if (convError) throw convError;

      const { data: allParticipants, error: allPartError } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", conversationIds);

      if (allPartError) throw allPartError;

      const allUserIds = new Set<string>();
      allParticipants?.forEach((p) => allUserIds.add(p.user_id));

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", Array.from(allUserIds));

      if (profilesError) throw profilesError;

      const { data: lastMessages, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });

      if (messagesError) throw messagesError;

      const convs: Conversation[] = conversationIds.map((convId) => {
        const metadata = convMetadata?.find((c) => c.id === convId) as any;
        const participants = allParticipants?.filter((p) => p.conversation_id === convId) || [];
        const otherParticipantIds = participants
          .filter((p) => p.user_id !== userId)
          .map((p) => p.user_id);

        const otherProfiles = profiles?.filter((p) => otherParticipantIds.includes(p.user_id)) || [];

        let primaryOtherUser = otherProfiles[0] as unknown as Profile;

        if (!primaryOtherUser) {
          primaryOtherUser = profiles?.find(p => p.user_id === userId) as unknown as Profile;
        }

        let convMessages = lastMessages?.filter((m) => m.conversation_id === convId);

        // Filter out cleared messages logic
        const clearedAt = clearedAtMap.get(convId);
        if (clearedAt && convMessages) {
          convMessages = convMessages.filter((m) => new Date(m.created_at) > new Date(clearedAt));
        }

        const lastMsg = convMessages?.[0];
        const unreadCount = convMessages?.filter(
          (m) => m.sender_id !== userId && !m.is_read
        ).length;

        return {
          id: convId,
          otherUser: primaryOtherUser,
          lastMessage: lastMsg?.content,
          lastMessageTime: lastMsg?.created_at,
          unreadCount,
          title: metadata?.title || undefined,
          is_group: metadata?.is_group || false,
        };
      })
        .filter((conv) => {
          if (conv.id === selectedConvRef.current) return true;
          const clearedAt = clearedAtMap.get(conv.id);
          if (clearedAt && conv.lastMessageTime) {
            return new Date(conv.lastMessageTime) > new Date(clearedAt);
          }
          return !clearedAt || conv.lastMessageTime;
        });

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
      const { data: participantData } = await supabase
        .from("conversation_participants")
        .select("cleared_at")
        .eq("conversation_id", selectedConversation)
        .eq("user_id", userId)
        .single();

      const clearedAt = participantData?.cleared_at;

      let query = supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConversation)
        .order("created_at", { ascending: true });

      if (clearedAt) {
        query = query.gt("created_at", clearedAt);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      setMessages(data || []);

      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", selectedConversation)
        .neq("sender_id", userId);
    };

    fetchMessages();
  }, [selectedConversation, userId]);

  const [typingState, setTypingState] = useState<Record<string, Set<string>>>({});

  // ... (refs) ...

  // Global Subscribe to real-time messages
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("global-messages")
      .on(
        "broadcast",
        { event: "typing" },
        ({ payload }) => {
          const { conversation_id, user_id, is_typing } = payload;
          if (user_id === userId) return; // Ignore self

          setTypingState((prev) => {
            const currentSet = new Set(prev[conversation_id] || []);
            if (is_typing) {
              currentSet.add(user_id);
            } else {
              currentSet.delete(user_id);
            }
            return { ...prev, [conversation_id]: currentSet };
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as Message;

          // Check known conversations
          const conversationExists = conversationsRef.current.some(c => c.id === newMessage.conversation_id);

          if (!conversationExists) {
            console.log("Message for new/hidden conversation received, refreshing list...");
            fetchConversations();
            return;
          }

          setConversations((prev) => {
            const updatedConvs = prev.map((conv) => {
              if (conv.id === newMessage.conversation_id) {
                const isSelected = selectedConvRef.current === newMessage.conversation_id;
                return {
                  ...conv,
                  lastMessage: newMessage.content,
                  lastMessageTime: newMessage.created_at,
                  unreadCount: isSelected ? 0 : (conv.unreadCount || 0) + (newMessage.sender_id !== userId ? 1 : 0)
                };
              }
              return conv;
            });

            return updatedConvs.sort((a, b) => {
              if (!a.lastMessageTime) return 1;
              if (!b.lastMessageTime) return -1;
              return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
            });
          });

          if (selectedConvRef.current === newMessage.conversation_id) {
            setMessages((prev) => [...prev, newMessage]);

            if (newMessage.sender_id !== userId) {
              supabase
                .from("messages")
                .update({ is_read: true, is_delivered: true })
                .eq("id", newMessage.id);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          if (selectedConvRef.current === updatedMessage.conversation_id) {
            setMessages((prev) =>
              prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
            );
          }
        }
      )
      .subscribe();

    const conversationChannel = supabase
      .channel("new-conversations")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log("New conversation detected, fetching...");
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(conversationChannel);
    };
  }, [userId, fetchConversations]);

  // Clear unread count when selecting a conversation
  useEffect(() => {
    if (selectedConversation) {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === selectedConversation
            ? { ...conv, unreadCount: 0 }
            : conv
        )
      );
    }
  }, [selectedConversation]);

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

  // Presence Subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel("online-users", {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const newState = channel.presenceState();
        const onlineIds = new Set<string>();

        Object.keys(newState).forEach((key) => {
          onlineIds.add(key);
        });

        setOnlineUsers(onlineIds);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

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

  // Create new conversation or rejoin existing one
  const createConversation = async (otherUserId: string) => {
    if (!userId) return null;

    try {
      console.log("Creating/finding conversation with:", otherUserId);

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
      const commonIds = myConvIds.filter((id) => otherConvIds.includes(id));

      if (commonIds.length > 0) {
        const { data: directConv } = await supabase
          .from("conversations")
          .select("id")
          .in("id", commonIds)
          .eq("is_group", false)
          .limit(1)
          .single();

        if (directConv) {
          console.log("Found existing conversation:", directConv.id);
          setSelectedConversation(directConv.id);
          fetchConversations();
          return directConv.id;
        }
      }

      console.log("Creating new conversation");
      const newConvId = crypto.randomUUID();

      const { error: convError } = await supabase
        .from("conversations")
        .insert({ id: newConvId, is_group: false });

      if (convError) throw convError;

      const { error: partError } = await supabase
        .from("conversation_participants")
        .insert([
          { conversation_id: newConvId, user_id: userId },
          { conversation_id: newConvId, user_id: otherUserId },
        ]);

      if (partError) throw partError;

      setSelectedConversation(newConvId);
      fetchConversations();
      return newConvId;
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      toast.error(`Failed to create conversation: ${error.message || 'Unknown error'}`);
      return null;
    }
  };

  const getOtherUser = () => {
    const conv = conversations.find((c) => c.id === selectedConversation);
    return conv?.otherUser || null;
  };

  const createGroupConversation = async (title: string, userIds: string[]) => {
    if (!userId) return null;

    try {
      const newConvId = crypto.randomUUID();

      const { error: convError } = await supabase
        .from("conversations")
        .insert({ id: newConvId, title, is_group: true });

      if (convError) throw convError;

      const participants = [userId, ...userIds].map(uid => ({
        conversation_id: newConvId,
        user_id: uid
      }));

      const { error: partError } = await supabase
        .from("conversation_participants")
        .insert(participants);

      if (partError) throw partError;

      fetchConversations();
      setSelectedConversation(newConvId);
      return newConvId;
    } catch (error) {
      console.error("Error creating group conversation:", error);
      toast.error("Failed to create group");
      return null;
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!userId) return;

    console.log("Clearing chat history for conversation:", conversationId);

    try {
      const { error } = await supabase.rpc('clear_chat_for_user', {
        p_conversation_id: conversationId,
        p_user_id: userId
      });

      if (error) {
        console.error("Clear chat error:", error);
        throw error;
      }

      console.log("Chat history cleared successfully");

      setConversations((prev) => {
        const newConvs = prev.filter((c) => c.id !== conversationId);
        if (selectedConversation === conversationId) {
          setSelectedConversation(null);
        }
        return newConvs;
      });

      toast.success("Chat deleted");
    } catch (error: any) {
      console.error("Error clearing chat:", error);
      toast.error(`Failed to delete: ${error.message || 'Unknown error'}`);
    }
  };

  // Send typing indicator
  const sendTyping = async (isTyping: boolean) => {
    if (!selectedConversation || !userId) return;
    await supabase.channel("global-messages").send({
      type: "broadcast",
      event: "typing",
      payload: { conversation_id: selectedConversation, user_id: userId, is_typing: isTyping },
    });
  };

  return {
    isTyping: !!(selectedConversation && typingState[selectedConversation]?.size > 0),
    sendTyping,
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
    loading,
    fetchConversations,
    onlineUsers,
  };
};
