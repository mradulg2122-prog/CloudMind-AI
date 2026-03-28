// app/page.tsx — Root redirect to /dashboard
// The actual dashboard UI lives under app/dashboard/layout.tsx + page.tsx
import { redirect } from 'next/navigation';
export default function RootPage() {
  redirect('/dashboard');
}
