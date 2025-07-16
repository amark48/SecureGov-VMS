// src/hooks/useAuth.ts
import { useAuthContext } from '../context/AuthContext';

// This hook now simply consumes the AuthContext
// All state management and logic are handled in AuthProvider
export const useAuth = () => {
  return useAuthContext();
};
