import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { PageLoadingFallback } from "@/components/LoadingSpinner";
import Index from "./pages/Index";
import Auth from "./pages/Auth";

const Feed = lazy(() => import("./pages/Feed"));
const AddCatch = lazy(() => import("./pages/AddCatch"));
const CatchDetail = lazy(() => import("./pages/CatchDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const VenueDetail = lazy(() => import("./pages/VenueDetail"));
const Sessions = lazy(() => import("./pages/Sessions"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminAuditLog = lazy(() => import("./pages/AdminAuditLog"));
const SearchPage = lazy(() => import("./pages/Search"));
const Insights = lazy(() => import("./pages/Insights"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/add-catch" element={<AddCatch />} />
              <Route path="/catch/:id" element={<CatchDetail />} />
              <Route path="/profile/:slug" element={<Profile />} />
              <Route path="/settings/profile" element={<ProfileSettings />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/audit-log" element={<AdminAuditLog />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/venues/:slug" element={<VenueDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
