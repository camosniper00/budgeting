import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Accounts from './pages/Accounts';
import Bills from './pages/Bills';
import Goals from './pages/Goals';
import Trends from './pages/Trends';
import NetWorth from './pages/NetWorth';
import Settings from './pages/Settings';
import Import from './pages/Import';
import AISummary from './pages/AISummary';
import Flagle from './pages/Flagle';
import Login from './pages/Login';
import Setup from './pages/Setup';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  const setupDone = user.setup_completed === 1;
  if (!setupDone && location.pathname !== '/setup') return <Navigate to="/setup" replace />;
  if (setupDone && location.pathname === '/setup') return <Navigate to="/" replace />;
  return children;
}

function LoginRedirect() {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigate to={user.setup_completed === 1 ? '/' : '/setup'} replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <LoginRedirect /> : <Login />} />
      <Route path="/setup" element={
        <PrivateRoute>
          <Setup />
        </PrivateRoute>
      } />
      <Route path="/*" element={
        <PrivateRoute>
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/budgets" element={<Budgets />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/import" element={<Import />} />
                <Route path="/ai-summary" element={<AISummary />} />
                <Route path="/bills" element={<Bills />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/trends" element={<Trends />} />
                <Route path="/net-worth" element={<NetWorth />} />
                <Route path="/flagle" element={<Flagle />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </main>
          </div>
        </PrivateRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
