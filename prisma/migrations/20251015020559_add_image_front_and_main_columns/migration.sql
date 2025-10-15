/*
  Warnings:

  - You are about to drop the column `invitation_image_url` on the `guests` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "guests" DROP COLUMN "invitation_image_url",
ADD COLUMN     "invitation_image_front_url" VARCHAR(255),
ADD COLUMN     "invitation_image_main_url" VARCHAR(255);
