-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'qr');

-- AlterTable: Add column with default value for existing records
ALTER TABLE "Trip" ADD COLUMN "payment_method" "PaymentMethod" NOT NULL DEFAULT 'cash';

-- Update existing records to have 'cash' as payment method (already set by default)

-- Remove the default value so new records must explicitly provide a payment method
ALTER TABLE "Trip" ALTER COLUMN "payment_method" DROP DEFAULT;
