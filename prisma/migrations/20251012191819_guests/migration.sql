-- CreateEnum
CREATE TYPE "Venue" AS ENUM ('hue', 'hanoi');

-- CreateTable
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "secondary_note" VARCHAR(200),
    "venue" "Venue" NOT NULL,
    "invitation_url" VARCHAR(255) NOT NULL,
    "invitation_image_url" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guests_venue_idx" ON "guests"("venue");

-- CreateIndex
CREATE INDEX "guests_created_at_idx" ON "guests"("created_at");
