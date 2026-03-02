import React, { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                disabled={isLoading || props.disabled}
                className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none',
                    {
                        // Variants
                        'bg-accent text-background shadow-accent-glow hover:brightness-110 active:scale-95 focus-visible:ring-accent': variant === 'primary',
                        'bg-surface-active text-text-primary border border-border-default hover:bg-surface-highlight focus-visible:ring-surface-highlight': variant === 'secondary',
                        'bg-transparent hover:bg-surface-hover text-text-secondary hover:text-white': variant === 'ghost',
                        'bg-transparent hover:bg-surface-hover text-text-secondary hover:text-accent rounded-xl': variant === 'icon',
                        // Sizes
                        'h-9 px-4 text-xs': size === 'sm' && variant !== 'icon',
                        'h-11 px-8 text-sm': size === 'md' && variant !== 'icon',
                        'h-14 px-10 text-base': size === 'lg' && variant !== 'icon',
                        'h-10 w-10 p-2': size === 'icon' || variant === 'icon',
                    },
                    className
                )}
                {...props}
            >
                {isLoading ? (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : null}
                {children}
            </button>
        );
    }
);
Button.displayName = 'Button';
