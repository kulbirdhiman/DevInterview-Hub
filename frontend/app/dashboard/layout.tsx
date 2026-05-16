import { ClerkProvider } from '@clerk/nextjs';
import Navbar from '@/components/layout/Navbar';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MyApp',
  description: 'Next.js + Clerk Auth',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider 
      afterSignOutUrl="/"           // ← Add this here
      appearance={{
        // Optional: Global theme
      }}
    >
      <html lang="en">
        <body>
          <Navbar />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}