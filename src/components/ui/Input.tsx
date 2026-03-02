import React, { InputHTMLAttributes, useId } from 'react';
import { cn } from '../../utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: React.ReactNode;
    error?: string;
    icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, icon, id, ...props }, ref) => {
        const generatedId = useId();
        const inputId = id || generatedId;

        return (
            <div className="w-full space-y-2">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-[11px] font-black uppercase tracking-[0.3em] text-text-muted flex items-center gap-2"
                    >
                        {label}
                    </label>
                )}
                <div className="relative group">
                    {icon && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        aria-invalid={!!error}
                        className={cn(
                            "w-full bg-surface-elevated border border-border-default rounded-2xl py-4 text-base transition-all placeholder:text-text-muted",
                            "focus:outline-none focus:border-accent/50 focus:bg-surface-active focus-visible:ring-2 focus-visible:ring-accent/50 shadow-inner",
                            icon ? "pl-12 pr-4" : "px-6",
                            error ? "border-red focus:border-red focus-visible:ring-red/50" : "",
                            className
                        )}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="text-xs text-red mt-1 font-medium bg-red/10 px-2 py-1 rounded w-fit" role="alert">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);
Input.displayName = 'Input';
