// src/App.tsx
import DebugScanner from './components/DebugScanner';
import { AuthWrapper } from './components/AuthWrapper';
import { Gallery } from './components/Gallary';
import './styles.css';

function App() {
  return (
    <div className="app-container">
      <AuthWrapper>
        <DebugScanner />
        <Gallery />
      </AuthWrapper>
    </div>
  );
}

export default App;