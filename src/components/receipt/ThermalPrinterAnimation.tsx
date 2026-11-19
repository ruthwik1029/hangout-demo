import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Order, CafeSettings } from '../../types';
import { DigitalReceipt } from './DigitalReceipt';
import { Button } from '../common/Button';
import {
  playThermalPrinterSound,
  playCompletionChime,
  isPrinterSoundMuted,
  setPrinterSoundMuted,
} from '../../lib/soundEffects';
import {
  Printer,
  CheckCircle2,
  Volume2,
  VolumeX,
  X,
  RotateCcw,
  FileText,
} from 'lucide-react';

export interface ThermalPrinterAnimationProps {
  order: Order;
  cafeSettings?: CafeSettings | null;
  isOpen: boolean;
  onClose: () => void;
  onPrintComplete?: () => void;
  autoStart?: boolean;
}

export const ThermalPrinterAnimation: React.FC<ThermalPrinterAnimationProps> = ({
  order,
  cafeSettings,
  isOpen,
  onClose,
  onPrintComplete,
  autoStart = true,
}) => {
  const [printingPhase, setPrintingPhase] = useState<'idle' | 'feeding' | 'completed'>('idle');
  const [isMuted, setIsMuted] = useState<boolean>(isPrinterSoundMuted());
  const [layoutMode, setLayoutMode] = useState<'thermal' | 'a4'>('thermal');
  const audioStopRef = useRef<(() => void) | null>(null);

  // Check prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const startPrintingAnimation = () => {
    if (prefersReducedMotion) {
      setPrintingPhase('completed');
      if (onPrintComplete) onPrintComplete();
      return;
    }

    setPrintingPhase('feeding');

    // Trigger synthesized stepper motor sound
    if (!isMuted) {
      audioStopRef.current = playThermalPrinterSound(2400);
    }

    // Phase progression
    const timer = setTimeout(() => {
      setPrintingPhase('completed');
      if (!isMuted) {
        playCompletionChime();
      }
      if (onPrintComplete) onPrintComplete();
    }, 2400);

    return () => {
      clearTimeout(timer);
      if (audioStopRef.current) {
        audioStopRef.current();
        audioStopRef.current = null;
      }
    };
  };

  useEffect(() => {
    if (isOpen && autoStart) {
      const cleanup = startPrintingAnimation();
      return cleanup;
    } else {
      setPrintingPhase('idle');
    }
  }, [isOpen, autoStart]);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    setPrinterSoundMuted(next);
  };

  const handleReplay = () => {
    startPrintingAnimation();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-2xl bg-brand-charcoal text-white rounded-3xl shadow-2xl border border-white/10 overflow-hidden my-6 flex flex-col max-h-[92vh]"
        >
          {/* Header Controls */}
          <div className="flex items-center justify-between p-4 sm:px-6 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-yellow/20 flex items-center justify-center text-brand-yellow">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-heading font-black text-base text-white">
                  HANGOUT Digital Bill & Thermal Preview
                </h3>
                <p className="text-[11px] text-gray-400">
                  Order #{order.order_number} • {order.order_type === 'DINING' ? 'Dine-In' : 'Takeaway'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleMute}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 transition-colors"
                title={isMuted ? 'Unmute Printer Sound' : 'Mute Printer Sound'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-start bg-gradient-to-b from-brand-charcoal to-[#18181b]">
            {/* PHYSICAL THERMAL PRINTER HARDWARE FRAME */}
            <div className="w-full max-w-[380px] flex flex-col items-center">
              {/* Printer Hardware Chassis (Black Matte Box) */}
              <div className="w-full bg-[#1c1c20] rounded-2xl border-2 border-[#2f2f35] p-3 shadow-xl relative z-20">
                {/* Top Status Panel */}
                <div className="flex items-center justify-between px-2 pb-2 text-[10px] font-mono text-gray-400 border-b border-white/5">
                  <span className="font-bold tracking-widest text-brand-yellow">HANGOUT-TP80</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          printingPhase === 'feeding'
                            ? 'bg-amber-400 animate-ping'
                            : printingPhase === 'completed'
                            ? 'bg-emerald-400'
                            : 'bg-emerald-500'
                        }`}
                      />
                      {printingPhase === 'feeding' ? 'PRINTING' : 'ONLINE'}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      80MM
                    </span>
                  </div>
                </div>

                {/* Paper Ejection Slot (Slit in printer chassis) */}
                <div className="relative mt-2 h-3 bg-[#0d0d10] rounded-sm border-t border-b border-black shadow-inner flex items-center justify-center">
                  <div className="w-4/5 h-0.5 bg-[#000000]" />
                </div>
              </div>

              {/* PERFORATED RECEIPT PAPER FEEDING DOWN FROM SLOT */}
              <div className="w-full max-w-[340px] relative -mt-1 z-10 flex flex-col items-center">
                <motion.div
                  initial={
                    prefersReducedMotion
                      ? { height: 'auto', opacity: 1 }
                      : { height: 40, opacity: 0.6 }
                  }
                  animate={
                    printingPhase === 'feeding'
                      ? {
                          height: 'auto',
                          opacity: 1,
                          transition: { duration: 2.2, ease: 'easeOut' },
                        }
                      : { height: 'auto', opacity: 1 }
                  }
                  className="w-full overflow-hidden shadow-2xl rounded-b-xl border border-t-0 border-gray-300"
                >
                  {/* Perforated Tear Edge Graphic */}
                  <div className="w-full h-3 bg-white flex items-center justify-between px-1 border-b border-dashed border-gray-400">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <span key={i} className="w-1.5 h-1 bg-[#1c1c20] rounded-xs" />
                    ))}
                  </div>

                  {/* Actual Digital Receipt Component in Thermal 80mm format */}
                  <DigitalReceipt
                    order={order}
                    cafeSettings={cafeSettings}
                    layoutMode={layoutMode}
                    showActions={false}
                  />
                </motion.div>
              </div>
            </div>

            {/* Print Completed Badge */}
            {printingPhase === 'completed' && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="mt-6 flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Digital Bill Formatted & Ready to Print</span>
              </motion.div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:px-6 bg-white/5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-gray-300 border-white/20 hover:bg-white/10 hover:text-white"
                onClick={handleReplay}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Feed Again
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-gray-300 border-white/20 hover:bg-white/10 hover:text-white"
                onClick={() => setLayoutMode((m) => (m === 'thermal' ? 'a4' : 'thermal'))}
                leftIcon={<FileText className="w-3.5 h-3.5" />}
              >
                Switch to {layoutMode === 'thermal' ? 'A4 Invoice' : '80mm Thermal'}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                Print to Hardware Printer
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                className="text-gray-300 border-white/20 hover:bg-white/10"
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
