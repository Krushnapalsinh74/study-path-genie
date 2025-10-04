import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { DarkModeProvider } from "@/contexts/DarkModeContext";
import NavigationBar from "@/components/NavigationBar";
import Home from "./pages/Home";
import CreatedPapersPage from "./pages/CreatedPapersPage";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  console.log("App component rendering");
  return (
    <QueryClientProvider client={queryClient}>
      <DarkModeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <HashRouter>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/created-papers" element={<CreatedPapersPage />} />
                <Route path="/profile" element={<Profile />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <NavigationBar />
            </div>
          </HashRouter>
        </TooltipProvider>
      </DarkModeProvider>
    </QueryClientProvider>
  );
};

export default App;
