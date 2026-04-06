import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

import { ToastType } from '../types';

interface ToastProps {
  message: string;
  type: ToastType;
  isVisible: boolean;
  onClose: () => void;
}

export default function Toast({ message, type, isVisible, onClose }: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          className="fixed bottom-8 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-xl border glass-panel shadow-2xl"
          style={{
            borderColor: type === 'success' ? 'var(--color-primary)' : type === 'error' ? 'var(--color-tertiary)' : 'var(--color-outline)',
          }}
        >
          {type === 'success' && <CheckCircle className="w-5 h-5 text-primary" />}
          {type === 'error' && <AlertCircle className="w-5 h-5 text-tertiary" />}
          
          <span className="text-sm font-headline font-medium text-on-surface">{message}</span>
          
          <button 
            onClick={onClose}
            className="ml-4 p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
