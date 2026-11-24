import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { detectLang, LANGUAGES } from './i18n';
import Layout from './components/Layout';
import Home from './pages/Home';
import Services from './pages/Services';
import News from './pages/News';
import NewsDetail from './pages/NewsDetail';
import CShell from './pages/CShell';
import Join from './pages/Join';
import FabricationTrack from './pages/FabricationTrack';
import NotFound from './pages/NotFound';

// Admin (and the Supabase auth client it needs) is only downloaded when visiting /admin.
const AdminApp = lazy(() => import('./admin/AdminApp'));
// The request page pulls in three.js for the 3D preview, so it is split out too.
const Fabrication = lazy(() => import('./pages/Fabrication'));

// The admin has no language prefix: /fr/admin/fabrication → /admin/fabrication.
function AdminRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={pathname.replace(/^\/[a-z]{2}(?=\/admin)/, '') + search} replace />;
}

// A path without a language prefix (/services, /fabrication…) gets the visitor's language.
function LangRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`/${detectLang()}${pathname}${search}${hash}`} replace />;
}

const pages = (
  <>
    <Route index element={<Home />} />
    <Route path="services" element={<Services />} />
    <Route path="actualites" element={<News />} />
    <Route path="actualites/:slug" element={<NewsDetail />} />
    <Route path="projets/cshell" element={<CShell />} />
    <Route path="rejoindre" element={<Join />} />
    <Route
      path="fabrication"
      element={
        <Suspense fallback={<div className="page-head" />}>
          <Fabrication />
        </Suspense>
      }
    />
    <Route path="fabrication/suivi/:token" element={<FabricationTrack />} />
    <Route path="admin/*" element={<AdminRedirect />} />
    <Route path="*" element={<NotFound />} />
  </>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${detectLang()}`} replace />} />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={null}>
            <AdminApp />
          </Suspense>
        }
      />
      {/* One static prefix per language: a dynamic /:lang would also swallow /admin/fabrication. */}
      {LANGUAGES.map(({ code }) => (
        <Route key={code} path={`/${code}`} element={<Layout lang={code} />}>
          {pages}
        </Route>
      ))}
      <Route path="*" element={<LangRedirect />} />
    </Routes>
  );
}
