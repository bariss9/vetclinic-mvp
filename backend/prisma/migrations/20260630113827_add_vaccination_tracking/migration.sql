-- CreateEnum
CREATE TYPE "VaccinationStatus" AS ENUM ('PLANNED', 'ADMINISTERED');

-- CreateTable
CREATE TABLE "VaccinationRecord" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "administeredDate" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3),
    "status" "VaccinationStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdByClinicId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaccinationRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_createdByClinicId_fkey" FOREIGN KEY ("createdByClinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
