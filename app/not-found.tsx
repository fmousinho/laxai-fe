import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="text-gray-600 mb-8 text-center">
        The page you're looking for doesn't exist.
      </p>
      <Link href="/(dashboard)">
        <Button>Go Home</Button>
      </Link>
    </div>
  );
}