import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { GlassSelect } from "./glass-select";

const control =
  "block w-full rounded-sm border border-field bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-ink-muted/80 transition-colors focus-visible:border-cobalt aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger/[0.03] disabled:bg-sand-soft disabled:text-ink-muted";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(control, "min-h-11", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(control, "min-h-28", className)} {...props} />,
);
Textarea.displayName = "Textarea";

/** Select for forms: a real <select> underneath (forms, react-hook-form, no-JS), shown as the glass list that
 *  always opens under the field. Same props and <option> children as <select>. */
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <GlassSelect ref={ref} className={cn(control, "min-h-11", className)} {...props}>
    {children}
  </GlassSelect>
));
NativeSelect.displayName = "NativeSelect";

/** The browser's own select, for the admin (Ant Design surfaces keep native controls). */
export const PlainSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(control, "min-h-11", className)} {...props}>
    {children}
  </select>
));
PlainSelect.displayName = "PlainSelect";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-semibold text-ink", className)} {...props} />;
}

/**
 * Label + control + hint + inline error, wired with aria-describedby / aria-invalid.
 * Pass the control as children and spread `controlProps(id)` onto it.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-pomegranate">
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** aria wiring for a control inside <Field>. */
export function fieldAria(id: string, error?: string, hint?: boolean) {
  const describedBy = [error ? `${id}-error` : null, hint && !error ? `${id}-hint` : null].filter(Boolean).join(" ");
  return {
    id,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy || undefined,
  };
}
