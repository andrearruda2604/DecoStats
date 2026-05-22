import { createContext, useContext, ReactNode } from 'react';
import { useUser } from '@clerk/clerk-react';

interface AuthContextType {
  user: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  return (
    <AuthContext.Provider value={{ user: user ?? null, loading: !isLoaded }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
