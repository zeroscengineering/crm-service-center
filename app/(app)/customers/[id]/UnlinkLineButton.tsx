"use client";

import { useTransition } from "react";
import { unlinkLine } from "./actions";

export default function UnlinkLineButton({ customerId }: { customerId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("ยกเลิกการเชื่อม LINE ของลูกค้าคนนี้?")) start(async () => void (await unlinkLine(customerId)));
      }}
      className="ml-2 text-xs text-rose-600 hover:underline disabled:opacity-50"
    >
      {pending ? "..." : "ยกเลิกการเชื่อม"}
    </button>
  );
}
