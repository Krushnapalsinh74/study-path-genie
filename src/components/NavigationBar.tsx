import React from "react";
import { Button } from "@/components/ui/button";
import { Home, FileText, User, ShoppingBag } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDarkMode } from "@/contexts/DarkModeContext";

export default function NavigationBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode } = useDarkMode();

  console.log("NavigationBar - Current pathname:", location.pathname);

  const isActive = (path: string) => {
    return location.pathname === path || (path === "/" && location.pathname === "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg z-50 safe-area-pb">
      <div className="max-w-md mx-auto px-4 py-3">
        <div className="bg-white dark:bg-gray-800 rounded-t-3xl shadow-lg p-4">
          <div className="flex justify-around items-center">
            <Button
              variant={isActive("/") ? "default" : "ghost"}
              onClick={() => navigate("/")}
              className="flex flex-col items-center gap-1 px-4 py-2 h-auto min-w-0 flex-1 rounded-2xl"
            >
              <Home className="w-5 h-5" />
              <span className="text-xs font-medium">Home</span>
            </Button>
            <Button
              variant={isActive("/created-papers") ? "default" : "ghost"}
              onClick={() => navigate("/created-papers")}
              className="flex flex-col items-center gap-1 px-4 py-2 h-auto min-w-0 flex-1 rounded-2xl"
            >
              <FileText className="w-5 h-5" />
              <span className="text-xs font-medium">Papers</span>
            </Button>
            <Button
              variant={isActive("/purchases") ? "default" : "ghost"}
              onClick={() => navigate("/purchases")}
              className="flex flex-col items-center gap-1 px-4 py-2 h-auto min-w-0 flex-1 rounded-2xl"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="text-xs font-medium">My Purchases</span>
            </Button>
            <Button
              variant={isActive("/profile") ? "default" : "ghost"}
              onClick={() => navigate("/profile")}
              className="flex flex-col items-center gap-1 px-4 py-2 h-auto min-w-0 flex-1 rounded-2xl"
            >
              <User className="w-5 h-5" />
              <span className="text-xs font-medium">Profile</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
