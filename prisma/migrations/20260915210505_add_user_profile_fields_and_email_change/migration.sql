-- AlterEnum
ALTER TYPE "EmailOtpPurpose" ADD VALUE 'EMAIL_CHANGE';

-- AlterTable
ALTER TABLE "email_otps" ADD COLUMN     "destinationEmail" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "phone" TEXT;
