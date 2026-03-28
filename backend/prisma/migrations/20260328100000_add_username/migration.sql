ALTER TABLE "users" ADD COLUMN "username" TEXT;
UPDATE "users" SET "username" = LOWER(REPLACE("display_name", ' ', '')) WHERE "username" IS NULL;
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
