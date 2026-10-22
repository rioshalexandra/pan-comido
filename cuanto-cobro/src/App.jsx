import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './lib/api';
import { StoreContext } from './store';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import RecipesPage from './pages/RecipesPage';
import RecipePage from './pages/RecipePage';
import RecipeEditPage from './pages/RecipeEditPage';
import IngredientsPage from './pages/IngredientsPage';
import ProductionPage from './pages/ProductionPage';
import SuppliersPage from './pages/SuppliersPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import MorePage from './pages/MorePage';
import BackupPage from './pages/BackupPage';

export default function App() {
  const [me, setMe] = useState(undefined);

  const load = useCallback(() => {
    return api
      .get('/api/me')
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    load();
    const out = () => setMe(null);
    window.addEventListener('cc:logout', out);
    return () => window.removeEventListener('cc:logout', out);
  }, [load]);

  useEffect(() => {
    document.title = me?.appName || 'Cuánto Cobro';
  }, [me]);

  if (me === undefined) {
    return <div className="grid min-h-screen place-items-center text-cocoa-soft">Cargando…</div>;
  }
  if (!me) return <LoginPage onLogin={load} />;

  const store = {
    ...me,
    settings: me.settings || {},
    setSettings: (settings) => setMe((prev) => ({ ...prev, settings })),
    reload: load,
    logout: async () => {
      await api.post('/api/logout').catch(() => {});
      setMe(null);
    },
  };

  return (
    <StoreContext.Provider value={store}>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/recetas" element={<RecipesPage />} />
          <Route path="/recetas/nueva" element={<RecipeEditPage />} />
          <Route path="/recetas/:id" element={<RecipePage />} />
          <Route path="/recetas/:id/editar" element={<RecipeEditPage />} />
          <Route path="/ingredientes" element={<IngredientsPage />} />
          <Route path="/produccion" element={<ProductionPage />} />
          <Route path="/proveedores" element={<SuppliersPage />} />
          <Route path="/ajustes" element={<SettingsPage />} />
          <Route path="/mas" element={<MorePage />} />
          <Route path="/copia" element={<BackupPage />} />
          {me.user.role === 'admin' && <Route path="/admin" element={<AdminPage />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </StoreContext.Provider>
  );
}
