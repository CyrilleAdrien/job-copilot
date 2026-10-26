import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error || hint ? `${inputId}-help` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-medium text-text">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-24 w-full resize-y rounded-[10px] border border-border-strong bg-surface px-3 py-2.5 text-sm leading-relaxed text-text",
          "placeholder:text-text-tertiary transition-[border-color,box-shadow] duration-150",
          "focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none",
          error && "border-danger",
          className,
        )}
        {...props}
      />
      {(error || hint) && (
        <p id={describedBy} className={cn("text-xs", error ? "text-danger" : "text-text-tertiary")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
