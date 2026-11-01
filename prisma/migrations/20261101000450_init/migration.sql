-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Industria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "anioActual" INTEGER NOT NULL DEFAULT 1,
    "anioMaximo" INTEGER NOT NULL DEFAULT 8,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    "profesorId" TEXT NOT NULL,
    "configJson" TEXT,
    "semillaEventos" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Industria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#f472b6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "industriaId" TEXT NOT NULL,
    "coberturaJson" TEXT,
    "capacidadInstalada" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "capacidadMaxima" DOUBLE PRECISION NOT NULL DEFAULT 3000,
    "deuda" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "efectivo" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membresia" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "puntos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membresia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermisoArea" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "abierto" BOOLEAN NOT NULL DEFAULT false,
    "actualizadoAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermisoArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marca" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "publicidad" DOUBLE PRECISION NOT NULL,
    "produccion" DOUBLE PRECISION NOT NULL,
    "costoUnitario" DOUBLE PRECISION NOT NULL,
    "atributos" TEXT NOT NULL,
    "vendedores" TEXT NOT NULL,
    "inventario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "awareness" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "anioLanzamiento" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Marca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "contenido" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BorradorArea" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "cargo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "enviado" BOOLEAN NOT NULL DEFAULT true,
    "enviadoPorId" TEXT,
    "enviadoAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BorradorArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraEstudio" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "estudioId" INTEGER NOT NULL,
    "costo" DOUBLE PRECISION NOT NULL,
    "datos" TEXT,

    CONSTRAINT "CompraEstudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProyectoID" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "atributos" TEXT NOT NULL,
    "presupuesto" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'EN_DESARROLLO',
    "anioInicio" INTEGER NOT NULL,
    "probabilidad" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ProyectoID_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Penalizacion" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "puntos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "motivo" TEXT NOT NULL DEFAULT '',
    "anio" INTEGER NOT NULL,
    "registradaPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Penalizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoCatalogo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'NACIONAL',
    "regla" TEXT NOT NULL,
    "mesesDuracion" INTEGER NOT NULL DEFAULT 1,
    "intensidad" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "probabilidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "efectoDemanda" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "efectoCosto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "efectoLogistica" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "canal" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "tipoDato" TEXT NOT NULL DEFAULT 'hipotesis',
    "fuente" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoPeriodo" (
    "id" TEXT NOT NULL,
    "industriaId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "mesesJson" TEXT NOT NULL,
    "efectoDemanda" DOUBLE PRECISION NOT NULL,
    "efectoCosto" DOUBLE PRECISION NOT NULL,
    "efectoLogistica" DOUBLE PRECISION NOT NULL,
    "canal" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'CALENDARIO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "trazabilidadJson" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "EventoPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoPlan" (
    "id" TEXT NOT NULL,
    "industriaId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "catalogoId" TEXT NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'DOCENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MacroPeriodo" (
    "id" TEXT NOT NULL,
    "industriaId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "escenario" TEXT NOT NULL DEFAULT 'ESTABLE',
    "escenarioOrigen" TEXT NOT NULL DEFAULT 'SORTEADO',
    "semilla" TEXT NOT NULL DEFAULT '',
    "deltaEscenario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inflacionAnual" DOUBLE PRECISION NOT NULL DEFAULT 0.057,
    "factoresJson" TEXT NOT NULL DEFAULT '[]',
    "inflacionMensualJson" TEXT NOT NULL DEFAULT '[]',
    "indicePreciosInicio" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "indicePreciosFin" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "tipoCambioInicio" DOUBLE PRECISION NOT NULL DEFAULT 11.8,
    "tipoCambioFinal" DOUBLE PRECISION NOT NULL DEFAULT 11.8,
    "tasaInteres" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
    "ejecutado" BOOLEAN NOT NULL DEFAULT false,
    "preparadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ejecutadoAt" TIMESTAMP(3),

    CONSTRAINT "MacroPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reporte" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "ventas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ingresos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "publicidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fuerzaVentas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "investigacionMercado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contribucion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "participacion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sinDecision" BOOLEAN NOT NULL DEFAULT false,
    "detalleJson" TEXT,

    CONSTRAINT "Reporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReporteMarca" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "marcaNombre" TEXT NOT NULL,
    "ventas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "produccion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inventario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ingresos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contribucion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "participacion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "porCanal" TEXT NOT NULL DEFAULT '[]',
    "porSegmento" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "ReporteMarca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_nombre_key" ON "Usuario"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Membresia_equipoId_usuarioId_key" ON "Membresia"("equipoId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PermisoArea_equipoId_cargo_key" ON "PermisoArea"("equipoId", "cargo");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_equipoId_anio_key" ON "Decision"("equipoId", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "BorradorArea_equipoId_anio_cargo_key" ON "BorradorArea"("equipoId", "anio", "cargo");

-- CreateIndex
CREATE UNIQUE INDEX "CompraEstudio_equipoId_anio_estudioId_key" ON "CompraEstudio"("equipoId", "anio", "estudioId");

-- CreateIndex
CREATE UNIQUE INDEX "ProyectoID_equipoId_nombre_key" ON "ProyectoID"("equipoId", "nombre");

-- CreateIndex
CREATE INDEX "EventoPeriodo_industriaId_anio_idx" ON "EventoPeriodo"("industriaId", "anio");

-- CreateIndex
CREATE INDEX "EventoPlan_industriaId_anio_idx" ON "EventoPlan"("industriaId", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "EventoPlan_industriaId_anio_catalogoId_key" ON "EventoPlan"("industriaId", "anio", "catalogoId");

-- CreateIndex
CREATE UNIQUE INDEX "MacroPeriodo_industriaId_anio_key" ON "MacroPeriodo"("industriaId", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "Reporte_equipoId_anio_key" ON "Reporte"("equipoId", "anio");

-- AddForeignKey
ALTER TABLE "Industria" ADD CONSTRAINT "Industria_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipo" ADD CONSTRAINT "Equipo_industriaId_fkey" FOREIGN KEY ("industriaId") REFERENCES "Industria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membresia" ADD CONSTRAINT "Membresia_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membresia" ADD CONSTRAINT "Membresia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermisoArea" ADD CONSTRAINT "PermisoArea_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marca" ADD CONSTRAINT "Marca_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BorradorArea" ADD CONSTRAINT "BorradorArea_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BorradorArea" ADD CONSTRAINT "BorradorArea_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraEstudio" ADD CONSTRAINT "CompraEstudio_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProyectoID" ADD CONSTRAINT "ProyectoID_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penalizacion" ADD CONSTRAINT "Penalizacion_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penalizacion" ADD CONSTRAINT "Penalizacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penalizacion" ADD CONSTRAINT "Penalizacion_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoPeriodo" ADD CONSTRAINT "EventoPeriodo_industriaId_fkey" FOREIGN KEY ("industriaId") REFERENCES "Industria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoPlan" ADD CONSTRAINT "EventoPlan_industriaId_fkey" FOREIGN KEY ("industriaId") REFERENCES "Industria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoPlan" ADD CONSTRAINT "EventoPlan_catalogoId_fkey" FOREIGN KEY ("catalogoId") REFERENCES "EventoCatalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MacroPeriodo" ADD CONSTRAINT "MacroPeriodo_industriaId_fkey" FOREIGN KEY ("industriaId") REFERENCES "Industria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReporteMarca" ADD CONSTRAINT "ReporteMarca_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
