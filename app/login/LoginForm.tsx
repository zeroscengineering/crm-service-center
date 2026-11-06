"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">อีเมล</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">รหัสผ่าน</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </label>
      {state.error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
