# Fecha Libre

Página pública por salón con el calendario de fechas libres y consulta por WhatsApp.
Un solo Worker de Cloudflare + una base D1 (`fecha-libre`). Sin pago mensual.

- `/` presentación con ejemplos
- `/s/<link>` página pública de cada salón (si no está "lista", dice "en preparación")
- `/panel` panel del dueño (marcar días/turnos ocupados, datos, contraseña). Demo: `/panel?demo=1` (demo / probala)
- `/admin` panel de quien vende la app: alta de salones, logo, colores, "página lista"

Publicar: `CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npm run deploy`.
Secretos: `ADMIN_USER` y `ADMIN_PASSWORD` (`npx wrangler secret put ...`).
Los salones de ejemplo se crean solos y se reinician cada 6 horas.
