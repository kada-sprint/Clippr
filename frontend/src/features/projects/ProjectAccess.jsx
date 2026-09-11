import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { apiRequest } from "../../lib/api.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statusLabels = {
  idle: "Tidak sedang diproses",
  processing: "Sedang diproses",
  error: "Pemrosesan gagal",
};
const stageLabels = {
  ingest: "Persiapan video",
  transcribe: "Transkripsi",
  analyze: "Kurasi",
  render: "Render",
};

export default function ProjectAccess({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  const params = new URLSearchParams(location.search);
  if (!params.has("projectId")) return children;

  const projectId = params.get("projectId");
  if (
    params.getAll("projectId").length !== 1 ||
    !UUID_PATTERN.test(projectId)
  ) {
    return (
      <AccessError
        title="Link proyek tidak valid"
        message="Periksa kembali link proyek yang Anda simpan."
      />
    );
  }

  return (
    <ProjectRequest
      key={`${user.id}:${projectId}:${location.pathname}`}
      projectId={projectId}
    />
  );
}

function AccessError({ title, message, onRetry }) {
  return (
    <section className="section" aria-label="Akses proyek">
      <div className="section-heading" role="alert">
        <h1>{title}</h1>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button className="button secondary" onClick={onRetry}>
          Coba lagi
        </button>
      )}
      <Link className="button primary" to="/upload">
        Ke halaman upload
      </Link>
    </section>
  );
}

function ProjectRequest({ projectId }) {
  const { refreshSession } = useAuth();
  const location = useLocation();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    apiRequest(`/projects/${projectId}`, { signal: controller.signal })
      .then(({ project }) => {
        if (!controller.signal.aborted) setResult({ project });
      })
      .catch(async (error) => {
        if (controller.signal.aborted) return;
        if (error.status === 401) {
          await refreshSession();
          return;
        }
        setResult({ error });
      });
    return () => controller.abort();
  }, [projectId, attempt, refreshSession]);

  function reload() {
    setResult(null);
    setCopyMessage("");
    setAttempt((value) => value + 1);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${location.pathname}${location.search}${location.hash}`,
      );
      setCopyMessage("Link proyek disalin.");
    } catch {
      setCopyMessage(
        "Link belum dapat disalin. Salin alamat dari bilah alamat browser.",
      );
    }
  }

  if (!result) return <p role="status">Memuat proyek…</p>;
  if (result.error) {
    const unavailable =
      result.error.status === 404 || result.error.status === 403;
    const invalid = result.error.code === "INVALID_PROJECT_ID";
    return (
      <AccessError
        title={
          invalid
            ? "Link proyek tidak valid"
            : unavailable
              ? "Proyek tidak tersedia"
              : "Proyek belum dapat dimuat"
        }
        message={
          unavailable
            ? "Proyek tidak ditemukan atau tidak dapat diakses dengan akun ini."
            : invalid
              ? "Periksa kembali link proyek yang Anda simpan."
              : result.error.message
        }
        onRetry={unavailable || invalid ? undefined : reload}
      />
    );
  }

  const { project } = result;
  return (
    <section className="section" aria-label="Akses proyek">
      <div className="section-heading">
        <h1>
          {location.pathname === "/editor" ? "Hasil proyek" : "Progres proyek"}
        </h1>
        <p role="status">
          Status terakhir:{" "}
          {statusLabels[project.status] || "Status belum dikenali"}
          {project.processingStage &&
            ` · ${stageLabels[project.processingStage] || "Tahap belum dikenali"}`}
        </p>
        <p>
          Proyek berhasil dibuka. Tampilan progres dan hasil klip untuk proyek
          ini belum tersedia.
        </p>
      </div>
      <button className="button secondary" onClick={reload}>
        Muat ulang status
      </button>
      <button className="button primary" onClick={copyLink}>
        Salin link proyek
      </button>
      <p role="status">{copyMessage}</p>
    </section>
  );
}
