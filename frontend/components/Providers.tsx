'use client';

import { ReactNode } from 'react';
import { ToastProvider } from './Toast';
import { AuthProvider } from './AuthContext';
import ParticleBackground from './ParticleBackground';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ParticleBackground />
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}
