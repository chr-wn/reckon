"use client";

import { useActionState } from "react";
import { Button, ErrorText, Label } from "@/components/ui";
import { createGroup } from "@/lib/actions/groups";

export function CreateGroupForm() {
  const [state, action, pending] = useActionState(createGroup, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="g-name">Group name</Label>
        <input id="g-name" name="name" className="field" placeholder="e.g. Dorm 4B forecasters" maxLength={60} required />
      </div>
      <div>
        <Label htmlFor="g-desc">
          Description <span className="font-normal text-ink-3">(optional)</span>
        </Label>
        <input id="g-desc" name="description" className="field" placeholder="What do you predict about?" maxLength={300} />
      </div>
      <ErrorText>{state.error}</ErrorText>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create group"}
      </Button>
    </form>
  );
}
