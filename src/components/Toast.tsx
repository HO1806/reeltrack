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

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className={cn(
              "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 shadow-2xl glass-panel min-w-[300px]",
              toast.type === 'success' && "border-l-green-500",
              toast.type === 'error' && "border-l-red-500",
              toast.type === 'info' && "border-l-accent"
            )}
          >
            <div className={cn(
              "shrink-0",
              toast.type === 'success' && "text-green-500",
              toast.type === 'error' && "text-red-500",
              toast.type === 'info' && "text-accent"
            )}>
              {toast.type === 'success' && <CheckCircle size={20} />}
              {toast.type === 'error' && <XCircle size={20} />}
              {toast.type === 'info' && <Info size={20} />}
            </div>
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button 
              onClick={() => onDismiss(toast.id)}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
