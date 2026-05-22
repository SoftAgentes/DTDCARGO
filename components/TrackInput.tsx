"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowIcon } from "./Icon";

export function TrackInput({ defaultValue = "" }: { defaultValue?: string }) {
  const [code, setCode] = useState(defaultValue);
  const router = useRouter();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean) router.push(`/track/${encodeURIComponent(clean)}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex bg-white rounded-[12px] overflow-hidden max-w-[520px]"
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="BL / AWB / DTDU"
        aria-label="Código de tracking"
        className="flex-1 border-0 outline-none bg-transparent px-5 h-14 text-[16px] font-semibold tracking-[0.04em] text-ink placeholder:text-grey-500 uppercase"
      />
      <button type="submit" className="btn btn-primary rounded-none h-14 px-6">
        Rastrear <ArrowIcon />
      </button>
    </form>
  );
}
