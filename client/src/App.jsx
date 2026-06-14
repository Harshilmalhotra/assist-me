import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AgentLogin from './pages/AgentLogin';
import AgentDashboard from './pages/AgentDashboard';
import CallRoom from './pages/CallRoom';
import CustomerJoin from './pages/CustomerJoin';
import AdminDashboard from './pages/AdminDashboard';
import './styles/global.css';
import { ThemeProvider } from './theme/ThemeContext';

function PrivateRoute({ children, role }) {
  const token = localStorage.getItem('agent_token');
  const user = JSON.parse(localStorage.getItem('agent_user') || '{}');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  if (role && user.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AgentLogin />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <AgentDashboard />
          </PrivateRoute>
        } />
        <Route path="/admin" element={
          <PrivateRoute role="admin">
            <AdminDashboard />
          </PrivateRoute>
        } />
        <Route path="/session/:sessionId" element={<CallRoom />} />
        <Route path="/join" element={<CustomerJoin />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
