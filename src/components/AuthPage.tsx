import React, { useState } from 'react';
import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onAuthSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      onAuthSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.section}>
      <div style={styles.container}>
        <div style={styles.fullHeight}>
          <div style={styles.centerSection}>
            <h6 style={styles.heading}>
              <span>{isSignUp ? 'Sign Up' : 'Log In'}</span>
            </h6>
            <input
              type="checkbox"
              id="reg-log"
              checked={isSignUp}
              onChange={(e) => {
                setIsSignUp(e.target.checked);
                setError('');
              }}
              style={styles.checkbox}
            />
            <label htmlFor="reg-log" style={styles.label}></label>

            <div style={styles.card3dWrap}>
              <div style={{ ...styles.card3dWrapper, transform: isSignUp ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                {/* Login Card */}
                <div style={{ ...styles.cardFace, transform: 'rotateY(0deg)' }}>
                  <div style={styles.centerWrap}>
                    <form onSubmit={handleLogin}>
                      <h4 style={styles.cardTitle}>Log In</h4>

                      {error && <p style={styles.errorText}>{error}</p>}

                      <div style={styles.formGroup}>
                        <input
                          type="email"
                          placeholder="Your Email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          style={styles.formInput}
                          disabled={loading}
                        />
                        <i style={{ ...styles.inputIcon }}>@</i>
                      </div>

                      <div style={{ ...styles.formGroup, marginTop: '16px' }}>
                        <input
                          type="password"
                          placeholder="Your Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          style={styles.formInput}
                          disabled={loading}
                        />
                        <i style={{ ...styles.inputIcon }}>🔒</i>
                      </div>

                      <button
                        type="submit"
                        style={styles.submitBtn}
                        disabled={loading}
                        onMouseEnter={(e) => {
                          if (!loading) {
                            e.currentTarget.style.backgroundColor = '#102770';
                            e.currentTarget.style.color = '#ffeba7';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!loading) {
                            e.currentTarget.style.backgroundColor = '#ffeba7';
                            e.currentTarget.style.color = '#102770';
                          }
                        }}
                      >
                        {loading ? 'Logging in...' : 'submit'}
                      </button>

                      <p style={styles.forgotText}>
                        <a href="#" style={styles.link} onClick={(e) => e.preventDefault()}>
                          Forgot your password?
                        </a>
                      </p>
                    </form>
                  </div>
                </div>

                {/* Sign Up Card */}
                <div
                  style={{
                    ...styles.cardFace,
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <div style={styles.centerWrap}>
                    <form onSubmit={handleSignUp}>
                      <h4 style={styles.cardTitle}>Sign Up</h4>

                      {error && <p style={styles.errorText}>{error}</p>}

                      <div style={styles.formGroup}>
                        <input
                          type="text"
                          placeholder="Your Full Name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          style={styles.formInput}
                          disabled={loading}
                        />
                        <i style={{ ...styles.inputIcon }}>👤</i>
                      </div>

                      <div style={{ ...styles.formGroup, marginTop: '16px' }}>
                        <input
                          type="email"
                          placeholder="Your Email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          style={styles.formInput}
                          disabled={loading}
                        />
                        <i style={{ ...styles.inputIcon }}>@</i>
                      </div>

                      <div style={{ ...styles.formGroup, marginTop: '16px' }}>
                        <input
                          type="password"
                          placeholder="Your Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          style={styles.formInput}
                          disabled={loading}
                        />
                        <i style={{ ...styles.inputIcon }}>🔒</i>
                      </div>

                      <button
                        type="submit"
                        style={styles.submitBtn}
                        disabled={loading}
                        onMouseEnter={(e) => {
                          if (!loading) {
                            e.currentTarget.style.backgroundColor = '#102770';
                            e.currentTarget.style.color = '#ffeba7';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!loading) {
                            e.currentTarget.style.backgroundColor = '#ffeba7';
                            e.currentTarget.style.color = '#102770';
                          }
                        }}
                      >
                        {loading ? 'Signing up...' : 'submit'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  section: {
    position: 'relative' as const,
    width: '100%',
    display: 'block',
  },
  container: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  fullHeight: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSection: {
    textAlign: 'center' as const,
    width: '100%',
    padding: '20px',
  },
  heading: {
    marginBottom: '16px',
    fontSize: '14px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    color: '#c4c3ca',
  },
  checkbox: {
    position: 'absolute' as const,
    left: '-9999px',
  },
  label: {
    position: 'relative' as const,
    display: 'block',
    width: '60px',
    height: '16px',
    borderRadius: '8px',
    padding: '0',
    margin: '10px auto',
    cursor: 'pointer',
    backgroundColor: '#ffeba7',
    transition: 'all 0.5s ease',
  },
  card3dWrap: {
    position: 'relative' as const,
    width: '440px',
    maxWidth: '100%',
    height: '400px',
    margin: '60px auto 0',
    perspective: '800px',
  },
  card3dWrapper: {
    width: '100%',
    height: '100%',
    position: 'absolute' as const,
    top: 0,
    left: 0,
    transition: 'all 600ms ease-out',
    transformStyle: 'preserve-3d' as const,
  },
  cardFace: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2b38',
    backgroundImage: 'url("https://s3-us-west-2.amazonaws.com/s.cdpn.io/1462889/pat.svg")',
    backgroundPosition: 'bottom center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '300%',
    position: 'absolute' as const,
    borderRadius: '6px',
    left: 0,
    top: 0,
    WebkitBackfaceVisibility: 'hidden',
  } as React.CSSProperties,
  centerWrap: {
    position: 'absolute' as const,
    width: '100%',
    padding: '0 35px',
    top: '50%',
    left: 0,
    transform: 'translate3d(0, -50%, 35px)',
    zIndex: 20,
    display: 'block',
  },
  cardTitle: {
    marginBottom: '16px',
    marginTop: '8px',
    fontWeight: 600,
    color: '#c4c3ca',
    fontSize: '18px',
  },
  formGroup: {
    position: 'relative' as const,
    display: 'block',
    margin: '0',
    padding: '0',
  },
  formInput: {
    padding: '13px 20px 13px 55px',
    height: '48px',
    width: '100%',
    fontWeight: 500,
    borderRadius: '4px',
    fontSize: '14px',
    lineHeight: '22px',
    letterSpacing: '0.5px',
    outline: 'none',
    color: '#c4c3ca',
    backgroundColor: '#1f2029',
    border: 'none',
    transition: 'all 200ms linear',
    boxShadow: '0 4px 8px 0 rgba(21, 21, 21, 0.2)',
    fontFamily: 'Poppins, sans-serif',
  },
  inputIcon: {
    position: 'absolute' as const,
    top: 0,
    left: '18px',
    height: '48px',
    fontSize: '18px',
    lineHeight: '48px',
    textAlign: 'left' as const,
    color: '#ffeba7',
    transition: 'all 200ms linear',
  },
  submitBtn: {
    borderRadius: '4px',
    height: '44px',
    fontSize: '13px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    transition: 'all 200ms linear',
    padding: '0 30px',
    letterSpacing: '1px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    backgroundColor: '#ffeba7',
    color: '#102770',
    boxShadow: '0 8px 24px 0 rgba(255, 235, 167, 0.2)',
    cursor: 'pointer',
    marginTop: '16px',
    fontFamily: 'Poppins, sans-serif',
  },
  forgotText: {
    marginBottom: 0,
    marginTop: '16px',
    textAlign: 'center' as const,
    fontSize: '14px',
    fontWeight: 500,
  },
  link: {
    color: '#c4c3ca',
    cursor: 'pointer',
    transition: 'all 200ms linear',
    textDecoration: 'none',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: '13px',
    marginBottom: '12px',
    fontWeight: 500,
  },
};
