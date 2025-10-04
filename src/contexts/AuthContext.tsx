import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isLoggedIn: boolean;
  setIsLoggedIn: (loggedIn: boolean) => void;
  userEmail: string | null;
  setUserEmail: (email: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Check for existing login session on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('spg_logged_in_email');
    if (savedEmail) {
      setUserEmail(savedEmail);
      setIsLoggedIn(true);
    }
  }, []);

  // Save login state to localStorage when it changes
  useEffect(() => {
    if (isLoggedIn && userEmail) {
      localStorage.setItem('spg_logged_in_email', userEmail);
    } else if (!isLoggedIn) {
      localStorage.removeItem('spg_logged_in_email');
    }
  }, [isLoggedIn, userEmail]);

  const handleSetIsLoggedIn = (loggedIn: boolean) => {
    setIsLoggedIn(loggedIn);
    if (!loggedIn) {
      setUserEmail(null);
    }
  };

  const handleSetUserEmail = (email: string | null) => {
    setUserEmail(email);
    if (email) {
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        isLoggedIn, 
        setIsLoggedIn: handleSetIsLoggedIn, 
        userEmail, 
        setUserEmail: handleSetUserEmail 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
