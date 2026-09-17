import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/Icon.jsx";
import { apiRequest } from "../../lib/api.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import "./projects.css";

const stages = {
  ingest: "Persiapan video",
  transcribe: "Transkripsi",
  analyze: "Kurasi",
  curate: "Kurasi",
  render: "Render",
};
const layouts = {
  "slide-cam": "Slide + Speaker",
  SLIDE_CAM: "Slide + Speaker",
  "talking-head": "Speaker",
  TALKING_HEAD: "Speaker",
  "slide-only": "Slide saja",
  SLIDE_ONLY: "Slide saja",
};
const nameOf = (project) => `Proyek ${project.id.slice(0, 8)}`;

function projectLink(project) {
  const pipelineActive = !["idle", "error"].includes(project.status);
  return `${!pipelineActive && project.clipCount > 0 ? "/editor" : "/queue"}?projectId=${project.id}`;
}

function statusOf(project) {
  if (project.status === "deleting") return "Penghapusan belum selesai";
  if (project.isBusy && ["idle", "error"].includes(project.status))
    return "Render klip";
  if (project.status === "error")
    return `Gagal${stages[project.processingStage] ? ` · ${stages[project.processingStage]}` : ""}`;
  if (project.isBusy) return stages[project.processingStage] || "Render klip";
  return project.clipCount ? "Siap ditinjau" : "Belum ada klip";
}

function retentionNote(sourceExpiresAt) {
  if (!sourceExpiresAt) return null;
  const now = Date.now();
  const expires = new Date(sourceExpiresAt).getTime();
  const diffMs = expires - now;
  if (diffMs <= 0) return "Video sumber menunggu upload ulang";
  const hours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (hours <= 1) return "Video sumber akan segera dihapus";
  return `Video sumber tersisa ${hours} jam`;
}

function isExpired(project) {
  if (!project.sourceExpiresAt) return false;
  return new Date(project.sourceExpiresAt).getTime() <= Date.now();
}
export default function MyProjectPage() {
  const { user } = useAuth();
  return <ProjectList key={user.id} />;
}

function ProjectList() {
  const { user, refreshSession } = useAuth();
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const dialog = useRef(null);
  const cancelButton = useRef(null);
  const trigger = useRef(null);
  const heading = useRef(null);
  const pending = useRef(false);
  const revision = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function load() {
      const startedAt = revision.current;
      try {
        const data = await apiRequest("/projects", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (startedAt !== revision.current) return;
        setProjects(data.projects);
        setError("");
      } catch (failure) {
        if (controller.signal.aborted) return;
        if (failure.status === 401) await refreshSession();
        else setError(failure.message);
      }
    }
    load();
    function scheduleNext() {
      const busy = projects?.some((p) => p.isBusy);
      timer = setTimeout(() => {
        load().then(scheduleNext);
      }, busy ? 5000 : 30000);
    }
    scheduleNext();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [user.id, attempt, refreshSession]);

  useEffect(() => {
    if (selected) {
      dialog.current.showModal();
      cancelButton.current.focus();
    }
  }, [selected]);

  function closeDialog(removed = false) {
    dialog.current.close();
    setSelected(null);
    setDeleteError("");
    requestAnimationFrame(() => {
      if (!removed && trigger.current?.isConnected) trigger.current.focus();
      else heading.current?.focus();
    });
  }

  async function removeProject() {
    if (pending.current) return;
    pending.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      await apiRequest(`/projects/${selected.id}`, { method: "DELETE" });
      revision.current += 1;
      setProjects((items) =>
        items.filter((project) => project.id !== selected.id),
      );
      setNotice(`${nameOf(selected)} dihapus.`);
      closeDialog(true);
      setAttempt((value) => value + 1);
    } catch (failure) {
      if (failure.status === 404) {
        revision.current += 1;
        closeDialog(true);
        setNotice("Proyek sudah tidak tersedia. Daftar dimuat ulang.");
        setAttempt((value) => value + 1);
      } else if (failure.status === 401) {
        closeDialog();
        await refreshSession();
      } else {
        setDeleteError(failure.message);
        setAttempt((value) => value + 1);
      }
    } finally {
      pending.current = false;
      setDeleting(false);
    }
  }

  return (
    <section className="projects-page" aria-labelledby="projects-title">
      <header className="projects-heading">
        <div>
          <span className="eyebrow">RUANG KERJA ANDA</span>
          <h1 id="projects-title" ref={heading} tabIndex={-1}>
            Project Saya
          </h1>
          <p>Buka kembali webinar dan cuplikan yang sedang Anda kerjakan.</p>
        </div>
        <Link className="button primary" to="/upload">
          <Icon name="upload" />
          Unggah Video
        </Link>
      </header>
      <p className="projects-notice" role="status">
        {notice}
      </p>
      <div className="projects-retention-banner">
        <Icon name="clock" size={16} />
        <p>Video sumber dan hasil ekspor dihapus otomatis 24 jam setelah upload atau render. Metadata dan transkrip tetap tersimpan.</p>
      </div>
      {error && (
        <div className="projects-message" role="alert">
          <p>{error}</p>
          <button
            className="button secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Coba lagi
          </button>
        </div>
      )}
      {!projects && !error && <p role="status">Memuat proyek…</p>}
      {projects?.length === 0 && (
        <div className="projects-empty">
          <Icon name="layers" size={38} />
          <h2>Belum ada proyek</h2>
          <p>Unggah webinar pertama Anda untuk mulai membuat cuplikan.</p>
          <Link className="button primary" to="/upload">
            Unggah Video
            <Icon name="arrow" />
          </Link>
        </div>
      )}
      <div className="projects-grid">
        {projects?.filter((project) => !isExpired(project)).map((project) => (
          <article className="project-card" key={project.id}>
            <div className="project-card-top">
              <span className="project-art">
                <Icon name="video" size={28} />
              </span>
              <span
                className={`project-status ${project.status === "error" ? "is-error" : ""}`}
              >
                {statusOf(project)}
              </span>
            </div>
            <h2>{nameOf(project)}</h2>
            <p className="project-date">
              {new Date(project.createdAt).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            {retentionNote(project.sourceExpiresAt) && (
              <p className="project-retention">
                {retentionNote(project.sourceExpiresAt)}
              </p>
            )}
            <dl>
              <div>
                <dt>Layout</dt>
                <dd>{layouts[project.selectedLayout] || "Belum dipilih"}</dd>
              </div>
              <div>
                <dt>Hasil</dt>
                <dd>{project.clipCount} klip</dd>
              </div>
            </dl>
            {project.isBusy && (
              <p className="project-busy-note" id={`busy-${project.id}`}>
                Tunggu proses selesai sebelum menghapus.
              </p>
            )}
            <div className="project-actions">
              <Link className="button primary" to={projectLink(project)}>
                Buka Proyek
                <Icon name="arrow" size={16} />
              </Link>
              <button
                className="button project-trash"
                disabled={project.isBusy}
                title={
                  project.isBusy ? "Proyek sedang diproses" : "Hapus proyek"
                }
                aria-label={`Hapus ${nameOf(project).toLowerCase()}`}
                aria-describedby={
                  project.isBusy ? `busy-${project.id}` : undefined
                }
                onClick={(event) => {
                  trigger.current = event.currentTarget;
                  setDeleteError("");
                  setSelected(project);
                }}
              >
                <Icon name="trash" size={20} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <dialog
        className="project-delete-dialog"
        ref={dialog}
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
        onCancel={(event) => {
          event.preventDefault();
          if (!pending.current) closeDialog();
        }}
      >
        <h2 id="delete-title">Hapus proyek ini?</h2>
        <p id="delete-description">
          <strong>{selected && nameOf(selected)}</strong> beserta video,
          transkrip, klip, dan ekspornya akan dihapus permanen. Tindakan ini
          tidak dapat dibatalkan.
        </p>
        {deleteError && (
          <p className="project-delete-error" role="alert">
            {deleteError}
          </p>
        )}
        <div className="project-dialog-actions">
          <button
            className="button secondary"
            ref={cancelButton}
            disabled={deleting}
            onClick={() => closeDialog()}
          >
            Batal
          </button>
          <button
            className="button project-trash"
            disabled={deleting}
            onClick={removeProject}
          >
            {deleting ? "Menghapus…" : "Hapus Proyek"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
