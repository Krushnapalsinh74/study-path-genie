import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDarkMode } from "@/contexts/DarkModeContext";
import { 
  User, 
  Mail, 
  Calendar, 
  BookOpen, 
  FileText, 
  GraduationCap,
  Award,
  Clock
} from "lucide-react";

const Profile = () => {
  console.log("Profile component is rendering");
  const { isDarkMode } = useDarkMode();
  const [userStats, setUserStats] = useState({
    totalPapers: 0,
    totalQuestions: 0,
    joinDate: "",
    lastActive: ""
  });

  // Load user data from localStorage
  useEffect(() => {
    // Load user stats
    const savedEmail = localStorage.getItem('spg_logged_in_email');
    const savedPapers = localStorage.getItem('createdPapers');
    const papers = savedPapers ? JSON.parse(savedPapers) : [];
    
    setUserStats({
      totalPapers: papers.length,
      totalQuestions: papers.reduce((total: number, paper: any) => total + (paper.totalQuestions || 0), 0),
      joinDate: new Date().toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      lastActive: new Date().toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    });
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const userEmail = localStorage.getItem('spg_logged_in_email') || 'user@example.com';

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {getGreeting()}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Welcome to your profile
          </p>
        </div>

        {/* User Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              User Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900 dark:text-white">{userEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Member Since</p>
                <p className="font-medium text-gray-900 dark:text-white">{userStats.joinDate}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Last Active</p>
                <p className="font-medium text-gray-900 dark:text-white">{userStats.lastActive}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Your Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {userStats.totalPapers}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Papers Created
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <BookOpen className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {userStats.totalQuestions}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Questions Generated
                </p>
              </div>
            </div>
          </CardContent>
        </Card>


        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => window.location.href = '/#/'}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Create New Paper
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => window.location.href = '/#/created-papers'}
            >
              <FileText className="w-4 h-4 mr-2" />
              View All Papers
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
