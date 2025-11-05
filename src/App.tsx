import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Feed from "./pages/Feed";
import AddCatch from "./pages/AddCatch";
import CatchDetail from "./pages/CatchDetail";
import Profile from "./pages/Profile";
import ProfileSettings from "./pages/ProfileSettings";
import NotFound from "./pages/NotFound";
import VenueDetail from "./pages/VenueDetail";
import Sessions from "./pages/Sessions";
import AdminReports from "./pages/AdminReports";
import AdminAuditLog from "./pages/AdminAuditLog";
import SearchPage from "./pages/Search";
import Insights from "./pages/Insights";
import LeaderboardPage from "./pages/LeaderboardPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
