
'use client';
import { useUser } from '@auth0/nextjs-auth0';
import { Button } from '@/components/ui/button';

import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';


export default function User() {
  const { user, isLoading } = useUser();

  const handleSignOut = () => {
    console.log('[USER] Starting client-side logout cleanup');

    // Clear client-side caches
    localStorage.clear();
    sessionStorage.clear();

    console.log('[USER] Client-side cleanup complete, redirecting to API logout');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const returnTo = origin ? origin : '/';
    const logoutUrl = `/api/auth/logout?returnTo=${encodeURIComponent(returnTo)}`;

    window.location.href = logoutUrl;
  };

  if (isLoading) {
    return null; // Or a loading spinner
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="overflow-hidden rounded-full"
        >
          <Image
            src={user?.image ?? '/placeholder-user.jpg'}
            width={36}
            height={36}
            alt="Avatar"
            className="overflow-hidden rounded-full"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuItem>Support</DropdownMenuItem>
        <DropdownMenuSeparator />
        {user ? (
          <DropdownMenuItem onClick={handleSignOut}>
            Sign Out
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem>
            <Link href="/api/auth/login">Sign In</Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
