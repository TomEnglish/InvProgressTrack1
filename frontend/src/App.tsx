import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import AuthGuard from './components/layout/AuthGuard';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Projects from './pages/Projects';
import Overview from './pages/Overview';
import EarnedValue from './pages/EarnedValue';
import Audits from './pages/Audits';
import Periods from './pages/Periods';
import Upload from './pages/Upload';
import Admin from './pages/Admin';
import ProjectSettings from './pages/ProjectSettings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<AuthGuard />}>
          <Route path="/" element={<Projects />} />

          <Route path="/p/:projectId" element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="ev" element={<EarnedValue />} />
            <Route path="audits" element={<Audits />} />
            <Route path="periods" element={<Periods />} />
            <Route path="upload" element={<Upload />} />
            <Route path="settings" element={<ProjectSettings />} />
          </Route>

          <Route path="/admin" element={<Layout />}>
            <Route index element={<Admin />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
