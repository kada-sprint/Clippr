import { createContext, useContext, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { apiRequest } from "../../lib/api.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ProjectContext = createContext(null);
export const useProject = () => useContext(ProjectContext);

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
    >
      {children}
    </ProjectRequest>
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
      <Link className="button primary" to="/projects">
        Ke My Project
      </Link>
    </section>
  );
}

function ProjectRequest({ projectId, children }) {
  const { refreshSession } = useAuth();
  const location = useLocation();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer;
    function load() {
      apiRequest(`/projects/${projectId}`, { signal: controller.signal })
        .then(({ project }) => {
          if (controller.signal.aborted) return;
          setResult({ project });
          if (project.isBusy && location.pathname === '/queue') timer = setTimeout(load, 5000);
        })
        .catch(async (error) => {
          if (controller.signal.aborted) return;
          if (error.status === 401) {
            await refreshSession();
            return;
          }
          setResult({ error });
        });
    }
    load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [projectId, attempt, refreshSession, location.pathname]);

  function reload() {
    setResult(null);
    setAttempt((value) => value + 1);
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
  return <ProjectContext.Provider value={project}>{children}</ProjectContext.Provider>;
}
