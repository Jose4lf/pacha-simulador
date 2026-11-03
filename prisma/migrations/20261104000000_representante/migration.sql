-- El grupo ya no tiene cargos individuales: todos consultan los reportes y
-- datos contables; SOLO un integrante (el REPRESENTANTE) toma las decisiones.
ALTER TABLE "Membresia" ADD COLUMN "representante" BOOLEAN NOT NULL DEFAULT false;

-- Datos existentes: el integrante más antiguo de cada equipo pasa a ser el representante
UPDATE "Membresia" m SET "representante" = true
WHERE m.id IN (
  SELECT DISTINCT ON ("equipoId") id FROM "Membresia"
  ORDER BY "equipoId", "createdAt" ASC
);
