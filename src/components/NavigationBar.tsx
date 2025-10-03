import React from "react";
import { Button } from "@/components/ui/button";
import { Home, FileText } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export default function NavigationBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || (path === "/" && location.pathname === "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 safe-area-pb">
      <div className="max-w-md mx-auto px-4 py-3">
        <div className="bg-white rounded-t-3xl border border-gray-200 shadow-lg p-4">
          <div className="flex justify-around items-center">
            <Button
              variant={isActive("/") ? "default" : "ghost"}
              onClick={() => navigate("/")}
              className="flex flex-col items-center gap-1 px-6 py-2 h-auto min-w-0 flex-1 rounded-2xl"
            >
              <Home className="w-5 h-5" />
              <span className="text-xs font-medium">Home</span>
            </Button>
            <Button
              variant={isActive("/created-papers") ? "default" : "ghost"}
              onClick={() => navigate("/created-papers")}
              className="flex flex-col items-center gap-1 px-6 py-2 h-auto min-w-0 flex-1 rounded-2xl"
            >
              <FileText className="w-5 h-5" />
              <span className="text-xs font-medium">Created Papers</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
