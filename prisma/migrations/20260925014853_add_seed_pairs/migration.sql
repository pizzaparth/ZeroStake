-- CreateEnum
CREATE TYPE "SeedPairStatus" AS ENUM ('next', 'active', 'revealed');

-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "seedPairId" TEXT;

-- CreateTable
CREATE TABLE "SeedPair" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SeedPairStatus" NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT,
    "nonce" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "revealedAt" TIMESTAMP(3),

    CONSTRAINT "SeedPair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeedPair_userId_status_idx" ON "SeedPair"("userId", "status");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_seedPairId_fkey" FOREIGN KEY ("seedPairId") REFERENCES "SeedPair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeedPair" ADD CONSTRAINT "SeedPair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- At most one active and one next pair per user. Partial unique indexes can't
-- be expressed in schema.prisma, so they live here.
CREATE UNIQUE INDEX "SeedPair_userId_active_key" ON "SeedPair"("userId") WHERE "status" = 'active';
CREATE UNIQUE INDEX "SeedPair_userId_next_key" ON "SeedPair"("userId") WHERE "status" = 'next';
