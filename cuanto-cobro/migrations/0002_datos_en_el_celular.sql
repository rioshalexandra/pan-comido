-- Los datos de cada clienta pasan a guardarse en su celular (con copia de seguridad).
-- El servidor solo usa las cuentas: usuario, contraseña, vencimiento y nombre del emprendimiento.
-- Las tablas de recetas, ingredientes, etc. quedan vacías y sin uso.

-- Si la administradora eligió "con datos de ejemplo", el celular los carga la primera vez que entra
ALTER TABLE users ADD COLUMN seed_examples INTEGER NOT NULL DEFAULT 0;
