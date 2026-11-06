"use client";

import { useEffect } from "react";

export default function PrintButton({ autoPrint }: { autoPrint?: boolean }) {
  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [autoPrint]);

  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
    >
      🖨️ พิมพ์ใบรับเครื่อง
    </button>
  );
}
