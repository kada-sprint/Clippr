-- Draft H-01: review with A/B/C before applying to any shared database.
BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_video_path" TEXT,
    "selected_layout" TEXT,
    "custom_vocabulary" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'idle',
    "processing_stage" TEXT,
    "transcript_json" JSONB,
    "last_edit_activity_at" TIMESTAMPTZ(3),
    "source_expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clips" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "start_time" DECIMAL(10,3) NOT NULL,
    "end_time" DECIMAL(10,3) NOT NULL,
    "transcript_json" JSONB NOT NULL,
    "concept_score" DECIMAL(4,3) NOT NULL,
    "pedagogical_reason" TEXT NOT NULL,
    "clip_video_path" TEXT,
    "srt_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rendered_at" TIMESTAMPTZ(3),
    "export_expires_at" TIMESTAMPTZ(3),

    CONSTRAINT "clips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_user_id_created_at_idx" ON "projects"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "projects_source_expires_at_idx" ON "projects"("source_expires_at");

-- CreateIndex
CREATE INDEX "clips_project_id_idx" ON "clips"("project_id");

-- CreateIndex
CREATE INDEX "clips_export_expires_at_idx" ON "clips"("export_expires_at");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
