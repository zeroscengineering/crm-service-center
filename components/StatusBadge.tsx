"use client";

import { badgeStyle } from "@/lib/status-def";
import { useStatuses } from "@/components/StatusProvider";

export default function StatusBadge({ status }: { status: string }) {
  const st = useStatuses();
  const s = st.get(status);
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={badgeStyle(s.color)}>
      {s.label}
    </span>
  );
}
