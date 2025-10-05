import { redirect } from 'next/navigation';
import { auth0 } from "@/lib/auth0";

export default async function DashboardPage() {
  // Check authentication
  const session = await auth0.getSession();

  if (!session) {
    // User not authenticated, redirect to login
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your dashboard. Use the navigation to access different features.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total Files</h3>
          </div>
          <div className="text-2xl font-bold">-</div>
          <p className="text-xs text-muted-foreground">
            Files uploaded
          </p>
        </div>
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Active Tasks</h3>
          </div>
          <div className="text-2xl font-bold">-</div>
          <p className="text-xs text-muted-foreground">
            Currently processing
          </p>
        </div>
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Completed</h3>
          </div>
          <div className="text-2xl font-bold">-</div>
          <p className="text-xs text-muted-foreground">
            Successfully processed
          </p>
        </div>
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Storage Used</h3>
          </div>
          <div className="text-2xl font-bold">-</div>
          <p className="text-xs text-muted-foreground">
            GB of storage
          </p>
        </div>
      </div>
    </div>
  );
}
