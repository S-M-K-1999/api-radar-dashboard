import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// 1. Match everything except internal Next.js files and static assets
const isProtectedRoute = createRouteMatcher([
  '/((?!api|trpc|_next/static|_next/image|favicon.ico).*)',
]);

export default clerkMiddleware(async (auth, req) => { // <-- Add 'async' here
  if (isProtectedRoute(req)) {
    await auth.protect(); // <-- Add 'await' here and remove the () from auth
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};