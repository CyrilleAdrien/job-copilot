import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, className, id, ...props },
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
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary [&_svg]:size-4">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-10 w-full rounded-[10px] border border-border-strong bg-surface px-3 text-sm text-text",
            "placeholder:text-text-tertiary transition-[border-color,box-shadow] duration-150",
            "focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none",
            icon && "pl-9",
            error && "border-danger focus:border-danger focus:shadow-[0_0_0_3px_var(--danger-soft)]",
            className,
          )}
          {...props}
        />
      </div>
      {(error || hint) && (
        <p
          id={describedBy}
          className={cn("text-xs", error ? "text-danger" : "text-text-tertiary")}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
