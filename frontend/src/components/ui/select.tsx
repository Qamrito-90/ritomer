import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "../../lib/classnames";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  label: string;
  name?: string;
  value?: string;
  placeholder?: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  description?: string;
  error?: string;
}

export function Select({
  label,
  name,
  value,
  placeholder,
  options,
  onValueChange,
  disabled = false,
  description,
  error
}: SelectProps) {
  const generatedId = React.useId();
  const triggerId = name ?? generatedId;
  const descriptionId = description ? `${triggerId}-description` : undefined;
  const errorId = error ? `${triggerId}-error` : undefined;

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-foreground" htmlFor={triggerId}>
        {label}
      </label>
      {description ? (
        <p className="text-sm text-muted-foreground" id={descriptionId}>
          {description}
        </p>
      ) : null}
      <SelectPrimitive.Root disabled={disabled} onValueChange={onValueChange} value={value}>
        <SelectPrimitive.Trigger
          aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? "true" : "false"}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted",
            error && "border-[hsl(var(--border-critical))]"
          )}
          id={triggerId}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon className="text-muted-foreground">v</SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-card text-card-foreground shadow-surface"
            position="popper"
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  className="relative flex cursor-default select-none items-center rounded-sm px-8 py-2 text-sm outline-none focus:bg-muted data-[state=checked]:bg-[hsl(var(--state-selected))]"
                  key={option.value}
                  value={option.value}
                >
                  <SelectPrimitive.ItemIndicator className="absolute left-2">*</SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error ? (
        <p className="text-sm text-[hsl(var(--error-default))]" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
