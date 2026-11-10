"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_STATUSES, statusHelpers, type StatusDef, type StatusHelpers } from "@/lib/status-def";

const Ctx = createContext<StatusDef[] | null>(null);

/** ส่งรายการสถานะ (จาก server) ให้ทุก client component ในแอป */
export function StatusProvider({ statuses, children }: { statuses: StatusDef[]; children: ReactNode }) {
  return <Ctx.Provider value={statuses}>{children}</Ctx.Provider>;
}

export function useStatuses(): StatusHelpers {
  const list = useContext(Ctx);
  return useMemo(() => statusHelpers(list ?? DEFAULT_STATUSES), [list]);
}
