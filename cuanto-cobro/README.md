# Cuánto Cobro

App para pasteleras emprendedoras: cargás los ingredientes como los comprás y las recetas, y la app te dice
cuánto te cuesta cada unidad (con tu trabajo y la luz y el gas), cuánto ganás, a cuánto conviene venderla
y te avisa cuando sube un ingrediente. También descuenta los ingredientes al producir y arma el pedido a proveedores por WhatsApp.

Una sola app sirve a todas las compradoras: la administradora le da a cada una su usuario y contraseña
desde **Cuentas de clientas**, con vencimiento opcional (1 mes, 1 año o para siempre).

Los datos de cada clienta (ingredientes, recetas, producción y ajustes) se guardan **solo en su celular** (`src/lib/localDb.js`).
El servidor guarda únicamente las cuentas. Para no perder nada al cambiar de celular, en **Más → Copia de seguridad**
se guarda un archivo de copia y se recupera en el celular nuevo; Inicio avisa si pasó más de una semana sin copia.

Corre en Cloudflare (Workers + base de datos D1). El plan gratis alcanza para empezar: 100.000 visitas por día.

## Publicarla (una sola vez)

Hace falta una cuenta gratis en https://dash.cloudflare.com y Node.js instalado.

```bash
npm install
npx wrangler login                          # abre el navegador para entrar a Cloudflare
npx wrangler d1 create cuanto-cobro         # copiá el "database_id" que muestra en wrangler.jsonc
npx wrangler secret put ADMIN_USER          # tu usuario de administradora
npx wrangler secret put ADMIN_PASSWORD      # tu contraseña (mínimo 8 letras o números)
npm run deploy                              # arma la app, crea las tablas y la publica
```

Al final muestra el link (algo como `https://cuanto-cobro.TU-CUENTA.workers.dev`).
Entrá con tu usuario de administradora y andá a **Más → Cuentas de clientas**.

Opcional: en `wrangler.jsonc` poné tu WhatsApp en `SELLER_WHATSAPP` (ej. `5491123456789`) para que las clientas tengan un botón "Pedir ayuda".

## Actualizarla

Después de cada cambio: `npm run deploy`. Los datos de las clientas no se tocan.

## Probarla en la compu

```bash
npm install
npm run db:local
npm run build && npx wrangler dev           # http://localhost:8787 (usuario admin / prueba123, en .dev.vars)
```

## Cómo calcula

- Costo de una hora de horno = luz y gas por mes ÷ horas de horno por mes.
- Ingredientes por unidad = suma de (cantidad × costo del ingrediente) ÷ rinde. El packaging se carga como ingrediente.
- Trabajo por unidad = minutos de trabajo ÷ 60 × valor de la hora ÷ rinde.
- Luz y gas por unidad = minutos de horno ÷ 60 × costo de una hora de horno ÷ rinde.
- Costo completo = ingredientes + trabajo + luz y gas.
- Margen real = (precio − costo completo) ÷ precio.
- Ganancia por hora = (precio − ingredientes − luz y gas) × rinde ÷ horas de trabajo.
- Precio sugerido = costo completo ÷ (1 − margen buscado), redondeado para arriba.
