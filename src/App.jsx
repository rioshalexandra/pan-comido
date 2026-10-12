import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { StoreProvider } from './store';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CobrarPage from './pages/CobrarPage';
import OrdersPage from './pages/OrdersPage';
import ProductionPage from './pages/ProductionPage';
import RecipesPage from './pages/RecipesPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import PartiesPage from './pages/PartiesPage';
import PartyDetailPage from './pages/PartyDetailPage';
import DocumentsPage from './pages/DocumentsPage';
import DocumentEditorPage from './pages/DocumentEditorPage';
import PedidoPage from './pages/PedidoPage';
import PaymentsPage from './pages/PaymentsPage';
import PricesPage from './pages/PricesPage';
import ImportExportPage from './pages/ImportExportPage';
import MovementsPage from './pages/MovementsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <StoreProvider>
              <Layout />
            </StoreProvider>
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="vender" element={<CobrarPage />} />
        <Route path="encargos" element={<OrdersPage />} />
        <Route path="produccion" element={<ProductionPage />} />
        {/* key distinta para que no se mezcle el estado entre productos e ingredientes */}
        <Route path="recetas" element={<RecipesPage />} />
        <Route path="recetas/:id" element={<RecipesPage />} />
        <Route path="productos" element={<ProductsPage key="products" kind="products" />} />
        <Route path="productos/:id" element={<ProductDetailPage />} />
        <Route path="ingredientes" element={<ProductsPage key="ingredients" kind="ingredients" />} />
        <Route path="ingredientes/:id" element={<ProductDetailPage />} />
        <Route path="clientes" element={<PartiesPage key="customers" kind="customers" />} />
        <Route path="clientes/:id" element={<PartyDetailPage key="customers" kind="customers" />} />
        <Route path="ventas" element={<DocumentsPage kind="sales" />} />
        <Route path="ventas/nueva" element={<DocumentEditorPage kind="sales" />} />
        <Route path="ventas/:id" element={<DocumentEditorPage kind="sales" />} />
        <Route path="pedido" element={<PedidoPage />} />
        <Route path="proveedores" element={<PartiesPage key="suppliers" kind="suppliers" />} />
        <Route path="proveedores/:id" element={<PartyDetailPage key="suppliers" kind="suppliers" />} />
        <Route path="compras" element={<DocumentsPage kind="purchases" />} />
        <Route path="compras/nueva" element={<DocumentEditorPage kind="purchases" />} />
        <Route path="compras/:id" element={<DocumentEditorPage kind="purchases" />} />
        <Route path="movimientos" element={<MovementsPage />} />
        <Route path="pagos" element={<PaymentsPage />} />
        <Route path="precios" element={<PricesPage />} />
        <Route path="importar" element={<ImportExportPage />} />
        <Route path="configuracion" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return <div className="grid min-h-full place-items-center text-[#6b6266]">Cargando…</div>;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}
