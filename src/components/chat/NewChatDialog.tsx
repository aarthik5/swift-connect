import { useState, useEffect } from "react";
import { Search, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string;
}

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectUser: (userId: string) => void;
  onCreateGroup: (title: string, userIds: string[]) => void;
  currentUserId: string;
  existingConversationUserIds: string[];
}

const NewChatDialog = ({
  open,
  onOpenChange,
  onSelectUser,
  onCreateGroup,
  currentUserId,
  existingConversationUserIds,
}: NewChatDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("user_id", currentUserId);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSelectUser = (userId: string) => {
    if (isGroupMode) {
      setSelectedUserIds(prev =>
        prev.includes(userId)
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
    } else {
      onSelectUser(userId);
      onOpenChange(false);
      setSearchQuery("");
    }
  };

  const handleCreateGroup = () => {
    if (selectedUserIds.length === 0) return;
    const title = groupName.trim() || "New Group";
    onCreateGroup(title, selectedUserIds);
    onOpenChange(false);
    setGroupName("");
    setSelectedUserIds([]);
    setIsGroupMode(false);
  };

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setGroupName("");
      setSelectedUserIds([]);
      setIsGroupMode(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              {isGroupMode ? "New Group" : "New Chat"}
            </div>
            <button
              onClick={() => setIsGroupMode(!isGroupMode)}
              className="text-xs text-primary hover:underline"
            >
              {isGroupMode ? "Switch to Direct" : "Create Group"}
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isGroupMode && (
            <Input
              placeholder="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {searchQuery ? "No users found" : "No new users to chat with"}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredUsers.map((user) => {
                  const isSelected = selectedUserIds.includes(user.user_id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user.user_id)}
                      className={cn(
                        "w-full p-3 flex items-center gap-3 rounded-lg hover:bg-muted transition-colors",
                        isSelected && "bg-muted border border-primary/20"
                      )}
                    >
                      <div className="relative">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {getInitials(user.username)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background",
                            user.is_online ? "bg-online" : "bg-offline"
                          )}
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-foreground">{user.username}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.is_online ? "Online" : "Offline"}
                        </p>
                      </div>
                      {isGroupMode && (
                        <div className={cn(
                          "w-4 h-4 rounded-full border flex items-center justify-center",
                          isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                        )}>
                          {isSelected && <span className="text-white text-[10px]">✓</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {isGroupMode && (
            <button
              onClick={handleCreateGroup}
              disabled={selectedUserIds.length === 0}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
            >
              Create Group
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewChatDialog;
