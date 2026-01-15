import React from "react";

type Variant = "primary" | "secondary" | "danger";

export function WireActionButton({
  onClick,
  disabled,
  disabledReason,
  variant = "primary",
  className = "",
  children,
  type = "button",
}: {
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  const styles: Record<Variant, string> = {
    primary: "bg-black text-white hover:bg-gray-800",
    secondary: "bg-white border-2 border-black hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <div className="w-full">
      <button
        type={type}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`${base} ${styles[variant]} ${className}`}
        title={disabled && disabledReason ? disabledReason : undefined}
      >
        {children}
      </button>
      {disabled && disabledReason && (
        <div className="mt-1 text-[11px] leading-snug text-gray-500">{disabledReason}</div>
      )}
    </div>
  );
}

