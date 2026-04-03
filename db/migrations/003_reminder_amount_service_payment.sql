-- Monto opcional para recordatorios (ej. categoría pago de servicio).
-- Ejecutar en Neon si la tabla ya existía sin esta columna.

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);
