"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./utils";
import { buttonVariants } from "./button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-3 text-[var(--text-primary)]", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium text-[var(--text-primary)]",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 border border-[var(--border-default)] bg-[var(--surface-ambient)] p-0 text-[var(--text-secondary)] opacity-100 hover:bg-[var(--surface-glow-hover)] hover:text-[var(--text-primary)]",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-x-1",
        head_row: "flex",
        head_cell:
          "w-8 rounded-md text-[0.8rem] font-normal text-[var(--text-tertiary)]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-[var(--brand-primary-muted)] [&:has([aria-selected].day-range-end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 rounded-lg p-0 font-normal text-[var(--text-secondary)] aria-selected:opacity-100 hover:bg-[var(--surface-glow-hover)] hover:text-[var(--text-primary)]",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-[var(--brand-primary)] aria-selected:text-[var(--text-on-brand)]",
        day_range_end:
          "day-range-end aria-selected:bg-[var(--brand-primary)] aria-selected:text-[var(--text-on-brand)]",
        day_selected:
          "bg-[var(--brand-primary)] text-[var(--text-on-brand)] hover:bg-[var(--brand-primary-hover)] hover:text-[var(--text-on-brand)] focus:bg-[var(--brand-primary-hover)] focus:text-[var(--text-on-brand)]",
        day_today: "border border-[var(--border-brand)] bg-[var(--brand-primary-muted)] text-[var(--text-primary)]",
        day_outside:
          "day-outside text-[var(--text-muted)] opacity-60 aria-selected:text-[var(--text-muted)]",
        day_disabled: "cursor-not-allowed text-[var(--text-muted)] opacity-35",
        day_range_middle:
          "aria-selected:bg-[var(--brand-primary-muted)] aria-selected:text-[var(--text-primary)]",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("size-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("size-4", className)} {...props} />
        ),
      }}
      {...props}
    />
  );
}

export { Calendar };
