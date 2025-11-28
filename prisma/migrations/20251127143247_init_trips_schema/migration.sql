-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('REQUESTED', 'OFFERED', 'ASSIGNED', 'PICKUP_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PAID', 'CANCELED');

-- CreateEnum
CREATE TYPE "TripCancelReason" AS ENUM ('RIDER_CANCELLED', 'DRIVER_CANCELLED', 'NO_SHOW', 'SYSTEM_TIMEOUT', 'REASSIGN_EXHAUSTED');

-- CreateEnum
CREATE TYPE "TripCancelSide" AS ENUM ('rider', 'driver', 'system');

-- CreateEnum
CREATE TYPE "TripPointPhase" AS ENUM ('pickup', 'in_progress');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('rider', 'driver', 'system');

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "rider_id" TEXT NOT NULL,
    "driver_id" TEXT,
    "vehicle_type" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL,
    "city" TEXT NOT NULL,
    "origin_lat" DOUBLE PRECISION NOT NULL,
    "origin_lng" DOUBLE PRECISION NOT NULL,
    "origin_h3_res9" TEXT NOT NULL,
    "dest_lat" DOUBLE PRECISION NOT NULL,
    "dest_lng" DOUBLE PRECISION NOT NULL,
    "dest_h3_res9" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "offered_at" TIMESTAMP(3),
    "assigned_at" TIMESTAMP(3),
    "pickup_started_at" TIMESTAMP(3),
    "in_progress_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "quote_id" TEXT,
    "pricing_snapshot" JSONB,
    "payment_intent_id" TEXT,
    "distance_m_est" INTEGER,
    "duration_s_est" INTEGER,
    "distance_m_final" INTEGER,
    "duration_s_final" INTEGER,
    "cancel_reason" "TripCancelReason",
    "cancel_side" "TripCancelSide",
    "cancel_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripPoint" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "phase" "TripPointPhase" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "h3_res9" TEXT NOT NULL,
    "speed_mps" DOUBLE PRECISION,
    "heading_deg" DOUBLE PRECISION,
    "ts" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripAudit" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" TEXT,
    "payload" JSONB NOT NULL,
    "ip" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripCancellation" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "side" "TripCancelSide" NOT NULL,
    "reason" "TripCancelReason" NOT NULL,
    "seconds_since_assign" INTEGER,
    "fee_applied_dec" DECIMAL(65,30),
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_trips_rider_requested_at" ON "Trip"("rider_id", "requested_at");

-- CreateIndex
CREATE INDEX "idx_trips_driver_status" ON "Trip"("driver_id", "status");

-- CreateIndex
CREATE INDEX "idx_trip_points_trip_ts" ON "TripPoint"("trip_id", "ts");

-- CreateIndex
CREATE INDEX "idx_trip_audit_trip_ts" ON "TripAudit"("trip_id", "ts");

-- CreateIndex
CREATE INDEX "idx_trip_cancellations_trip_ts" ON "TripCancellation"("trip_id", "ts");

-- AddForeignKey
ALTER TABLE "TripPoint" ADD CONSTRAINT "TripPoint_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripAudit" ADD CONSTRAINT "TripAudit_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripCancellation" ADD CONSTRAINT "TripCancellation_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
