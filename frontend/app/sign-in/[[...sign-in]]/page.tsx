import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-700 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(at_50%_30%,rgba(255,255,255,0.2)_0%,transparent_70%)]"></div>
        
        <div className="relative z-10 text-center text-white max-w-md">
          <div className="mx-auto w-24 h-24 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-8">
            <span className="text-5xl">🔐</span>
          </div>
          
          <h1 className="text-5xl font-bold mb-4">Welcome Back</h1>
          <p className="text-xl text-blue-100">
            Sign in to access your dashboard and continue where you left off
          </p>
          
          <div className="mt-10 flex justify-center gap-8 text-sm opacity-75">
            <div>Secure</div>
            <div>Fast</div>
            <div>Reliable</div>
          </div>
        </div>
      </div>

      {/* Right Side - Sign In Form (Now Wider) */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6 lg:p-12">
        <div className="w-full max-w-lg">   {/* ← Increased from max-w-md to max-w-lg */}
          
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-10">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center mb-4">
              <span className="text-5xl">🔐</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome Back</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Sign in to continue</p>
          </div>

          <SignIn 
            appearance={{
              elements: {
                rootBox: "mx-auto w-full",
                card: "shadow-2xl bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-2",
                cardBox: "shadow-none",
                headerTitle: "text-3xl font-semibold text-gray-900 dark:text-white",
                headerSubtitle: "text-gray-600 dark:text-gray-400 text-lg",
                formButtonPrimary: 
                  "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3.5 rounded-2xl text-base",
                formButtonPrimary__loading: "bg-blue-700",
                formFieldInput: 
                  "rounded-2xl border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 h-12 dark:bg-gray-800",
                footerActionLink: "text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium",
                identityPreviewText: "text-gray-700 dark:text-gray-300",
                dividerLine: "bg-gray-200 dark:bg-gray-800",
                socialButtonsBlockButton: 
                  "border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-2xl py-3 text-base",
              },
              layout: {
                socialButtonsVariant: "iconButton",
                logoPlacement: "none",
              },
            }}
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            forceRedirectUrl="/dashboard"
            fallbackRedirectUrl="/dashboard"
          />
        </div>
      </div>
    </div>
  );
}