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

const AppContent = () => {
  const { isModalOpen } = useModal();
  const { isLoggedIn } = useAuth();
  
  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${isLoggedIn ? 'pb-20' : ''}`}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/created-papers" element={<CreatedPapersPage />} />
        <Route path="/profile" element={<Profile />} />
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
