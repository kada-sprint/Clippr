CREATE TABLE "processing_jobs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "clip_id" UUID,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "checkpoint" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "attempt_token" UUID,
    "error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "processing_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "processing_jobs_clip_id_fkey" FOREIGN KEY ("clip_id") REFERENCES "clips"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "processing_jobs_kind_check" CHECK (("kind" = 'pipeline' AND "clip_id" IS NULL) OR ("kind" = 'render-clip' AND "clip_id" IS NOT NULL)),
    CONSTRAINT "processing_jobs_status_check" CHECK ("status" IN ('pending', 'running', 'completed', 'failed'))
);
CREATE INDEX "processing_jobs_status_created_at_idx" ON "processing_jobs"("status", "created_at");
CREATE INDEX "processing_jobs_project_id_idx" ON "processing_jobs"("project_id");
