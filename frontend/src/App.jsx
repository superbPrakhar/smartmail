import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ConnectGmail from './pages/ConnectGmail';
import SetupPriorities from './pages/SetupPriorities';
import EmailDetailView from './pages/EmailDetailView';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/connect-gmail" element={<ConnectGmail />} />
        <Route path="/setup-priorities" element={<SetupPriorities />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/email-detail" element={<EmailDetailView />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
