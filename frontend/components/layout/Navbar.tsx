'use client';

import Link from 'next/link';

import {
  UserButton,
  SignInButton,
  SignUpButton,
  useUser,
} from '@clerk/nextjs';

export default function Navbar() {
  const { isSignedIn } = useUser();

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600">
            <span className="text-lg font-bold text-white">
              🔐
            </span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            MyApp
          </h1>
        </Link>

        {/* Navigation */}
        <div className="hidden items-center gap-8 text-sm font-medium md:flex">

          <Link
            href="/"
            className="text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Home
          </Link>

          <Link
            href="/dashboard"
            className="text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Dashboard
          </Link>

          <Link
            href="/profile"
            className="text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Profile
          </Link>

          <Link
            href="/about"
            className="text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            About
          </Link>
        </div>

        {/* Auth Section */}
        <div className="flex items-center gap-4">

          {/* Not Logged In */}
          {!isSignedIn && (
            <>
              <SignInButton mode="modal">
                <button className="rounded-2xl px-5 py-2 text-sm font-medium text-gray-700 transition hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                  Sign In
                </button>
              </SignInButton>

              <SignUpButton mode="modal">
                <button className="rounded-2xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
                  Sign Up
                </button>
              </SignUpButton>
            </>
          )}

          {/* Logged In */}
          {isSignedIn && (
            <>
              

              <UserButton
                appearance={{
                  elements: {
                    avatarBox:
                      'h-10 w-10 rounded-full ring-2 ring-gray-200 transition hover:ring-blue-500 dark:ring-gray-700',
                  },
                }}
              >
                <UserButton.MenuItems>

                  <UserButton.Link
                    label="Dashboard"
                    href="/dashboard"
                    labelIcon="📊"
                  />

                  <UserButton.Link
                    label="Profile"
                    href="/profile"
                    labelIcon="👤"
                  />

                </UserButton.MenuItems>
              </UserButton>
            </>
          )}

        </div>
      </div>
    </nav>
  );
}