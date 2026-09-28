"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { leaveGroup, removeMember } from "@/lib/actions/groups";

export function RemoveMemberButton({ groupId, userId, name }: { groupId: string; userId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="xs"
      disabled={pending}
      onClick={() => confirm(`Remove ${name} from the group?`) && start(async () => void (await removeMember(groupId, userId)))}
    >
      Remove
    </Button>
  );
}

export function LeaveGroupButton({ groupId }: { groupId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => confirm("Leave this group? Your forecasts stay, but you'll lose access to its questions.") && start(() => leaveGroup(groupId))}
    >
      Leave group
    </Button>
  );
}
