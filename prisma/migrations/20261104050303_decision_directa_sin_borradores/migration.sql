/*
  Warnings:

  - You are about to drop the column `puntos` on the `Membresia` table. All the data in the column will be lost.
  - You are about to drop the `BorradorArea` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Penalizacion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PermisoArea` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "BorradorArea" DROP CONSTRAINT "BorradorArea_enviadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "BorradorArea" DROP CONSTRAINT "BorradorArea_equipoId_fkey";

-- DropForeignKey
ALTER TABLE "Penalizacion" DROP CONSTRAINT "Penalizacion_equipoId_fkey";

-- DropForeignKey
ALTER TABLE "Penalizacion" DROP CONSTRAINT "Penalizacion_registradaPorId_fkey";

-- DropForeignKey
ALTER TABLE "Penalizacion" DROP CONSTRAINT "Penalizacion_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "PermisoArea" DROP CONSTRAINT "PermisoArea_equipoId_fkey";

-- AlterTable
ALTER TABLE "Decision" ALTER COLUMN "estado" SET DEFAULT 'ENVIADA';

-- AlterTable
ALTER TABLE "Membresia" DROP COLUMN "puntos",
ALTER COLUMN "cargo" SET DEFAULT 'gerente';

-- DropTable
DROP TABLE "BorradorArea";

-- DropTable
DROP TABLE "Penalizacion";

-- DropTable
DROP TABLE "PermisoArea";
