-- AlterEnum
ALTER TYPE "EmailOtpPurpose" ADD VALUE 'ACCOUNT_DELETION';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3);
