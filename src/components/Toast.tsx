import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const iconMap = {
  success: { Icon: CheckCircle, color: 'text-green', glow: 'shadow-[0_0_20px_rgba(74,222,128,0.3)]' },
  error: { Icon: XCircle, color: 'text-red', glow: 'shadow-[0_0_20px_rgba(248,113,113,0.3)]' },
  info: { Icon: Info, color: 'text-accent', glow: 'shadow-[0_0_20px_rgba(245,197,24,0.3)]' },
};

const barColors = {
  success: 'bg-green',
  error: 'bg-red',
  info: 'bg-accent',
};

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const { Icon, color, glow } = iconMap[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="pointer-events-auto glass-panel-elevated rounded-2xl shadow-premium min-w-[320px] overflow-hidden"
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <div className={cn('shrink-0 p-2 rounded-xl bg-white/[0.04]', color, glow)}>
                  <Icon size={22} />
                </div>
                <p className="text-sm font-bold flex-1 leading-snug">{toast.message}</p>
                <button
                  onClick={() => onDismiss(toast.id)}
                  className="text-text-muted hover:text-white transition-colors p-1 rounded-lg hover:bg-white/[0.06]"
                >
                  <X size={16} />
                </button>
              </div>
              {/* Auto-dismiss progress bar */}
              <div className={cn('toast-progress', barColors[toast.type])} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
