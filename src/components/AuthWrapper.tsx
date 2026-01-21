// src/components/AuthWrapper.tsx
import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, type User, signOut } from 'firebase/auth';

export const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  // Listen for auth state changes (Senior pattern: avoids manual state management)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
    }
  };

  if (loading) return <div className="loading-text">Loading app...</div>;

  // If logged in, render the Scanner App (children) + a Logout button
  if (user) {
    return (
      <>
        <header className="app-header">
          <h1 className="app-logo">Scanner</h1>
          <div className="user-profile">
            <span className="user-email">{user.email}</span>
            <button className="btn btn-icon" onClick={() => signOut(auth)} title="Sign Out">
              &#8226;
            </button>
          </div>
        </header>
        {children}
      </>
    );
  }

  // If not logged in, show Login Form
  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">{isRegistering ? 'Create Account' : 'Login'}</h2>
        <form onSubmit={handleAuth} className="auth-form">
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            className="auth-input"
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            className="auth-input"
          />
          <button type="submit" className="btn btn-primary">
            {isRegistering ? 'Sign Up' : 'Sign In'}
          </button>
          {error && <p className="auth-error">{error}</p>}
        </form>
        
        <p className="auth-toggle">
          {isRegistering ? 'Already have an account?' : 'Need an account?'}
          <button 
            onClick={() => setIsRegistering(!isRegistering)} 
            className="auth-toggle-btn"
          >
            {isRegistering ? 'Login here' : 'Register here'}
          </button>
        </p>
      </div>
    </div>
  );
};