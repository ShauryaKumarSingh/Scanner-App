// src/App.tsx
import DebugScanner from './components/DebugScanner';
import { AuthWrapper } from './components/AuthWrapper';
import { Gallery } from './components/Gallary';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

function App() {
  return (
    <ErrorBoundary>
      <div className="app-container">
        <AuthWrapper>
          <ErrorBoundary>
            <DebugScanner />
          </ErrorBoundary>
          <ErrorBoundary>
            <Gallery />
          </ErrorBoundary>
        </AuthWrapper>
      </div>
    </ErrorBoundary>
  );
}

export default App;