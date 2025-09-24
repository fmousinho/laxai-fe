'use client';

import { TooltipProvider } from '@/components/ui/tooltip';
import { Auth0Provider } from '@auth0/nextjs-auth0';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Auth0Provider>
      <TooltipProvider>{children}</TooltipProvider>
    </Auth0Provider>
  );
}
