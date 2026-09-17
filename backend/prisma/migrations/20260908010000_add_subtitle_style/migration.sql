-- Local draft: apply only after team approval for the shared database.
BEGIN;

CREATE TYPE "SubtitleStyle" AS ENUM ('clean', 'active_word_highlight');

ALTER TABLE "clips" ADD COLUMN "subtitle_style" "SubtitleStyle" NOT NULL DEFAULT 'clean';

COMMIT;
