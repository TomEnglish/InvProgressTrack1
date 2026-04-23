import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import AuthGuard from './components/layout/AuthGuard';
import Login from './pages/Login';
import Overview from './pages/Overview';
import EarnedValue from './pages/EarnedValue';
import Audits from './pages/Audits';
import Periods from './pages/Periods';
import Upload from './pages/Upload';
import Admin from './pages/Admin';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<AuthGuard />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="ev" element={<EarnedValue />} />
            <Route path="audits" element={<Audits />} />
            <Route path="periods" element={<Periods />} />
            <Route path="upload" element={<Upload />} />
            <Route path="admin" element={<Admin />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
