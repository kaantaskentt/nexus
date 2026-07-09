"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, BookOpen, CalendarPlus } from "lucide-react";
import brand from "@/lib/brand";

// Branded not-found for everything under a workspace (Kaan ruling, July 8: never a raw
// 404 inside the product — guide toward the action that creates the missing thing).
// Next gives not-found no params, so the slug comes from the pathname.
export default function WorkspaceNotFound() {
  const pathname = usePathname();
  const slug = pathname?.split("/")[2];
  const base = slug ? `/w/${slug}` : "/";
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-8 py-24 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent/20">
        <Compass className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <h1 className="mt-4 font-display text-xl text-ink">Nothing mapped here yet</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        There is no mapped workflow here yet. {brand.product_name} builds these from
        interviews. Add context or schedule an interview to map it.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={`${base}/context`}
          className="inline-flex items-center gap-2 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-raised"
        >
          <BookOpen className="h-4 w-4" strokeWidth={1.75} /> Add context
        </Link>
        <Link
          href={`${base}/plans?new=1`}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover"
        >
          <CalendarPlus className="h-4 w-4" strokeWidth={2} /> Schedule an interview
        </Link>
      </div>
    </div>
  );
}
