# Pan Comido

Aplicación de gestión para la pastelería **Pan Comido**: venta de mostrador, encargos con seña y envío, producción con recetas y costos, stock de productos e ingredientes y pedido a proveedores. Pensada para usarse desde el celular.

Un solo servicio sirve la interfaz y la API; PostgreSQL guarda los datos.

## Qué hace

| Área | Qué incluye |
|------|-------------|
| **Inicio** | Caja del día por medio de pago, ventas y ganancia del mes, encargos de hoy y mañana, qué hornear, qué comprar y lo más vendido |
| **Vender** | Venta de mostrador en un paso: tocar productos, medio de pago y listo. Descuenta stock |
| **Encargos** | Pedidos con fecha y hora, retiro o envío (dirección y costo), seña, estados (pendiente, listo, entregado, cancelado), aviso por WhatsApp y entrega que genera la venta y cobra el saldo |
| **Producción** | "Qué hornear" según encargos y stock crítico, registro de tandas (suma producto y descuenta ingredientes) e historial |
| **Recetas** | Todas las recetas en un lugar: ingredientes por tanda (en g, ml o la unidad del ingrediente) y rinde. Es lo que Producción descuenta del stock |
| **Productos** | Precio, stock, stock crítico, receta con rinde y costo por unidad calculado, ganancia |
| **Ingredientes** | Materia prima con costo por unidad, stock, stock crítico, cantidad a pedir y proveedor habitual |
| **Pedido a proveedores** | Ingredientes en stock crítico agrupados por proveedor; envío por WhatsApp y creación de la compra |
| **Clientes** | Datos de contacto, dirección para envíos, cumpleaños, encargos e historial de compras |
| **Consultas** | Ventas, compras, pagos, movimientos de stock y pedido a proveedores |
| **Ajustes** | Precios masivos, CSV / Excel y configuración |

El menú se agrupa en **Mostrador** (Vender, Encargos), **Registros** (Producción, Productos, Ingredientes, Recetas, Clientes, Proveedores, Pedido a proveedores), **Consultas** y **Ajustes**.

Con `SEED_DEMO=true` y la base vacía se cargan productos, ingredientes y recetas de ejemplo de pastelería.

## Stack

| Capa | Tecnología |
|------|------------|
| UI | React 19 + Vite + Tailwind 4 |
| API | Express en el mismo proceso |
| Base | PostgreSQL 16 |
| Deploy | Railway |

## Desarrollo local

Requisitos: Node 20+, Docker (para Postgres) y npm.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run migrate
npm run dev
```

- Interfaz: http://localhost:5173
- API: http://localhost:3001
- Salud: http://localhost:3001/health
- Usuario: `admin` / `admin123`

## Variables

| Variable | Default | Uso |
|----------|---------|-----|
| `DATABASE_URL` | — | Conexión a Postgres |
| `PORT` | `3001` | Puerto de la API |
| `DEFAULT_ADMIN_USER` | `admin` | Usuario inicial |
| `DEFAULT_ADMIN_PASSWORD` | `admin123` | Contraseña inicial (cambiala en producción) |
| `STORE_TIMEZONE` | `America/Argentina/Buenos_Aires` | Zona horaria |
| `STORE_NAME` | `Pan Comido` | Nombre visible |
| `SEED_DEMO` | `true` | Carga datos de ejemplo si la base está vacía |
| `UPLOAD_DIR` | `uploads` | Carpeta de fotos (en Railway, un volumen en `/data/uploads`) |

Basado en el template [gestion-stock](https://github.com/ProfesIA-IA/gestion-stock) de ProfesIA.
