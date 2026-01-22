// src/components/AuthWrapper.tsx
import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, type User, signOut } from 'firebase/auth';
import { AuthPage } from './AuthPage';

export const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#1f2029',
          color: '#c4c3ca',
          fontSize: '16px',
          fontFamily: 'Poppins, sans-serif',
        }}
      >
        Loading app...
      </div>
    );
  }

  if (user) {
    return (
      <>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            backgroundColor: '#2a2b38',
            borderBottom: '1px solid #444',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#ffeba7' }}>Scanner</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: '#c4c3ca', fontSize: '14px' }}>{user.email}</span>
            <button
              onClick={() => signOut(auth)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#102770',
                color: '#ffeba7',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 200ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ffeba7', e.currentTarget.style.color = '#102770')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#102770', e.currentTarget.style.color = '#ffeba7')}
            >
              Sign Out
            </button>
          </div>
        </header>
        {children}
      </>
    );
  }

  return <AuthPage onAuthSuccess={() => {}} />;
};