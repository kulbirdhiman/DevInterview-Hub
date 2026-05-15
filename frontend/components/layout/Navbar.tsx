'use client';

import { UserButton, Show, SignInButton, SignUpButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center">
            <span className="text-white text-xl font-bold">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MyApp</h1>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
            Dashboard
          </Link>
          <Link href="/about" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
            About
          </Link>
        </div>

        {/* Auth Section */}
        <div className="flex items-center gap-4">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="px-5 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                Sign In
              </button>
            </SignInButton>

            <SignUpButton mode="modal">
              <button className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-2xl">
                Sign Up
              </button>
            </SignUpButton>
          </Show>

          <Show when="signed-in">
            <UserButton 
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10 rounded-full ring-2 ring-gray-200 dark:ring-gray-700 hover:ring-blue-500 transition",
                }
              }}
            />
          </Show>
        </div>
      </div>
    </nav>
  );
}