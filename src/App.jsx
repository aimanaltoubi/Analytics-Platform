import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Documents from '@/pages/Documents';
import DocumentDetail from '@/pages/DocumentDetail';
import Entities from '@/pages/Entities';
import EntityDetail from '@/pages/EntityDetail';


import Alerts from '@/pages/Alerts';
import TransitSecurity from '@/pages/TransitSecurity';
import GraphIndex from '@/pages/GraphIndex';
import Search from '@/pages/Search';
import Import from '@/pages/Import';
import Workspaces from '@/pages/Workspaces';
import WorkspaceDetail from '@/pages/WorkspaceDetail';
import NationalityDetail from '@/pages/NationalityDetail';
import CrossLingualSearch from '@/pages/CrossLingualSearch';
import Database from '@/pages/Database';
import YearlyStats from '@/pages/YearlyStats';
import PathAnalysisPage from '@/pages/PathAnalysisPage';
import EntityDossier from '@/pages/EntityDossier';
import ChangeTracking from '@/pages/ChangeTracking';
import IntelligenceGaps from '@/pages/IntelligenceGaps';
import PeriodComparison from '@/pages/PeriodComparison';
import Settings from '@/pages/Settings';
import CompanyNetwork from '@/pages/CompanyNetwork';
import PresentationPage from '@/pages/PresentationPage';


const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    // auth_required: do NOT redirect — render the app shell for testing without login.
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/:id" element={<DocumentDetail />} />
        <Route path="/entities" element={<Entities />} />
        <Route path="/entities/:id" element={<EntityDetail />} />
        <Route path="/entities/:id/dossier" element={<EntityDossier />} />

        <Route path="/alerts" element={<Alerts />} />
        <Route path="/transit" element={<TransitSecurity />} />
        <Route path="/graph" element={<GraphIndex />} />
        <Route path="/company-network" element={<CompanyNetwork />} />
        <Route path="/search" element={<Search />} />
        <Route path="/clir" element={<CrossLingualSearch />} />
        <Route path="/database" element={<Database />} />
        <Route path="/yearly-stats" element={<YearlyStats />} />
        <Route path="/path-analysis" element={<PathAnalysisPage />} />
        <Route path="/changes" element={<ChangeTracking />} />
        <Route path="/gaps" element={<IntelligenceGaps />} />
        <Route path="/compare" element={<PeriodComparison />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/presentation" element={<PresentationPage />} />
        <Route path="/import" element={<Import />} />
        <Route path="/workspaces" element={<Workspaces />} />
        <Route path="/workspaces/:id" element={<WorkspaceDetail />} />
        <Route path="/nationalities/:nationality" element={<NationalityDetail />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App