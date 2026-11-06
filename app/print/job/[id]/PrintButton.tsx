"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

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
      className="btn btn-primary"
    >
      <Printer size={16} /> พิมพ์ใบรับเครื่อง
    </button>
  );
}
