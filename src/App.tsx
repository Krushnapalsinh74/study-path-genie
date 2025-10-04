import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { DarkModeProvider } from "@/contexts/DarkModeContext";
import { ModalProvider, useModal } from "@/contexts/ModalContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import NavigationBar from "@/components/NavigationBar";
import Home from "./pages/Home";
import CreatedPapersPage from "./pages/CreatedPapersPage";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Admin Panel Component
const AdminPanel = () => {
  const { userEmail } = useAuth();
  
  React.useEffect(() => {
    // Get board and standard IDs from URL params
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const boardId = urlParams.get('boardId');
    const standardId = urlParams.get('standardId');
    
    console.log('Admin Panel loaded for user:', userEmail);
    console.log('Board ID:', boardId);
    console.log('Standard ID:', standardId);
    
    // Here you can redirect to your actual admin panel URL
    if (boardId && standardId) {
      const adminPanelUrl = `https://08m8v685-3002.inc1.devtunnels.ms/admin?boardId=${boardId}&standardId=${standardId}&userEmail=${encodeURIComponent(userEmail || '')}`;
      
      // Open admin panel in new tab/window
      window.open(adminPanelUrl, '_blank');
      
      // Or redirect in same window
      // window.location.href = adminPanelUrl;
    }
  }, [userEmail]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Admin Panel Access
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Redirecting you to the admin panel with your selected board and standard...
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AppContent = () => {
  const { isModalOpen } = useModal();
  const { isLoggedIn } = useAuth();
  
  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${isLoggedIn ? 'pb-20' : ''}`}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/created-papers" element={<CreatedPapersPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin-panel" element={<AdminPanel />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isModalOpen && isLoggedIn && <NavigationBar />}
    </div>
  );
};

const App = () => {
  console.log("App component rendering");
  return (
    <QueryClientProvider client={queryClient}>
      <DarkModeProvider>
        <AuthProvider>
          <ModalProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <HashRouter>
                <AppContent />
              </HashRouter>
            </TooltipProvider>
          </ModalProvider>
        </AuthProvider>
      </DarkModeProvider>
    </QueryClientProvider>
  );
};

export default App;
