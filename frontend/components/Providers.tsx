'use client';

import { ReactNode } from 'react';
import { ToastProvider } from './Toast';
import ParticleBackground from './ParticleBackground';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ToastProvider>
      {/* <ParticleBackground /> */}
      {children}
    </ToastProvider>
  );
}
