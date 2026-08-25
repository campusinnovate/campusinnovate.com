"use client";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiClock,
  FiEdit3,
  FiFile,
  FiFilePlus,
  FiFolder,
  FiGrid,
  FiLink,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiSettings,
  FiUpload,
  FiX,
} from "react-icons/fi";
import { createClient } from "@/lib/supabase/client";
type Tab = "overview" | "templates" | "documents" | "uploads" | "requests";
type Template = {
  id: string;
  template_code: string;
  name: string;
  document_type: string;
  description: string | null;
  owner_membership_id: string;
  owner_name: string;
  active_version: number;
  status: string;
  effective_date: string | null;
  next_review_date: string | null;
  drive_template_url: string;
  required_fields: unknown[];
  google_file_type?: "document" | "presentation";
  output_folder_url?: string | null;
  placeholder_map?: Record<string, string>;
  updated_at: string;
};
type Doc = {
  id: string;
  document_id: string;
  official_number: string | null;
  external_number: string | null;
  title: string;
  document_type: string;
  category: string | null;
  owner_membership_id: string;
  owner_name: string;
  source_module: string | null;
  linked_record_id: string | null;
  linked_record_name: string | null;
  active_version: number;
  status: string;
  classification: string;
  tags: string[];
  valid_from: string | null;
  expires_at: string | null;
  next_review_date: string | null;
  updated_at: string;
  current_file: string | null;
};
type Request = {
  id: string;
  request_code: string;
  title: string;
  request_type: string;
  requester_name: string;
  assignee_membership_id: string | null;
  assignee_name: string | null;
  description: string;
  priority: string;
  target_date: string | null;
  status: string;
  result_url: string | null;
  updated_at: string;
};
type Member = { id: string; name: string };
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const blankDoc = {
  title: "",
  document_type: "",
  category: "",
  description: "",
  owner_membership_id: "",
  source_module: "",
  linked_record_id: "",
  linked_record_name: "",
  external_number: "",
  classification: "internal",
  tags: "",
  valid_from: today(),
  expires_at: "",
  next_review_date: "",
  drive_file_url: "",
  drive_folder_url: "",
  file_name: "",
  file_type: "",
  source_kind: "existing_drive",
  template_id: "",
};
const blankTemplate = {
  template_code: "",
  name: "",
  document_type: "",
  description: "",
  owner_membership_id: "",
  status: "draft",
  effective_date: "",
  next_review_date: "",
  drive_template_url: "",
  required_fields: "",
  google_file_type: "document" as "document" | "presentation",
  output_folder_url: "",
  placeholder_map: "",
};
const blankRequest = {
  title: "",
  request_type: "new_document",
  assignee_membership_id: "",
  description: "",
  priority: "medium",
  target_date: "",
  source_module: "",
  linked_record_id: "",
};
const blankRevision = {
  file_name: "",
  drive_file_url: "",
  drive_folder_url: "",
  file_type: "",
  source_kind: "existing_drive",
  revision_reason: "",
  revision_summary: "",
};
export default function DocumentCenter() {
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState({
    total: 0,
    active_templates: 0,
    drafts: 0,
    needs_attention: 0,
  });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<
    "document" | "template" | "request" | "revision" | null
  >(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [docForm, setDocForm] = useState(blankDoc);
  const [templateForm, setTemplateForm] = useState(blankTemplate);
  const [requestForm, setRequestForm] = useState(blankRequest);
  const [revisionForm, setRevisionForm] = useState(blankRevision);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    setError("");
    const s = createClient();
    const {
      data: { session },
    } = await s.auth.getSession();
    if (!session) {
      location.replace("/ruang-kawan/");
      return;
    }
    const [a, w, g] = await Promise.all([
      s.rpc("get_my_access"),
      s.rpc("document_center_workspace"),
      s.rpc("list_workspace_generation_templates"),
    ]);
    const access = Array.isArray(a.data) ? a.data[0] : a.data;
    if (!access?.permissions?.includes("documents.view")) {
      setState("denied");
      return;
    }
    if (w.error) {
      setError(
        "Document Center belum dapat dimuat. Pastikan migrasi database sudah diterapkan.",
      );
      setState("ready");
      return;
    }
    setPermissions(access.permissions ?? []);
    setStats(w.data.stats);
    const configs = new Map<string, Template>(
      (g.data ?? []).map((t: Template) => [t.id, t]),
    );
    setTemplates(
      (w.data.templates ?? []).map((t: Template) => ({
        ...t,
        ...(configs.get(t.id) ?? {}),
      })),
    );
    setDocuments(w.data.documents ?? []);
    setRequests(w.data.requests ?? []);
    setMembers(w.data.members ?? []);
    setState("ready");
  }
  useEffect(() => {
    void load();
  }, []);
  const visible = useMemo(
    () =>
      documents.filter(
        (d) =>
          !query ||
          [
            d.title,
            d.document_id,
            d.official_number,
            d.owner_name,
            d.linked_record_name,
            ...d.tags,
          ].some((v) => v?.toLowerCase().includes(query.toLowerCase())),
      ),
    [documents, query],
  );
  const canCreate = permissions.includes("documents.create");
  const canManage = permissions.includes("documents.manage");
  async function rpc(name: string, args: Record<string, unknown>) {
    setSaving(true);
    setError("");
    const r = await createClient().rpc(name, args);
    setSaving(false);
    if (r.error) {
      setError(r.error.message);
      return false;
    }
    setModal(null);
    setMessage("Perubahan berhasil disimpan.");
    await load();
    return true;
  }
  function saveDoc(e: FormEvent) {
    e.preventDefault();
    void rpc("save_document", {
      document_uuid: null,
      payload: {
        ...docForm,
        tags: docForm.tags
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      },
    });
  }
  function parsePlaceholderMap(value: string) {
    return Object.fromEntries(
      value
        .split("\n")
        .map((line) => line.split("="))
        .filter((parts) => parts.length >= 2 && parts[0].trim())
        .map(([token, ...path]) => [
          token.trim().replace(/^\{\{|\}\}$/g, ""),
          path.join("=").trim(),
        ]),
    );
  }
  function saveTemplate(e: FormEvent) {
    e.preventDefault();
    void rpc("save_document_template", {
      template_id: editingTemplateId,
      payload: {
        ...templateForm,
        required_fields: templateForm.required_fields
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        placeholder_map: parsePlaceholderMap(templateForm.placeholder_map),
      },
    });
  }
  function editTemplate(t: Template) {
    setEditingTemplateId(t.id);
    setTemplateForm({
      template_code: t.template_code,
      name: t.name,
      document_type: t.document_type,
      description: t.description ?? "",
      owner_membership_id: t.owner_membership_id,
      status: t.status,
      effective_date: t.effective_date ?? "",
      next_review_date: t.next_review_date ?? "",
      drive_template_url: t.drive_template_url,
      required_fields: (t.required_fields ?? []).join("\n"),
      google_file_type: t.google_file_type ?? "document",
      output_folder_url: t.output_folder_url ?? "",
      placeholder_map: Object.entries(t.placeholder_map ?? {})
        .map(([token, path]) => `{{${token}}}=${path}`)
        .join("\n"),
    });
    setModal("template");
  }
  function saveRequest(e: FormEvent) {
    e.preventDefault();
    void rpc("save_document_request", {
      request_id: null,
      payload: requestForm,
    });
  }
  async function saveRevision(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (
      await rpc("create_document_revision", {
        target: selected.id,
        payload: revisionForm,
      })
    )
      setSelected(null);
  }
  async function transition(status: string) {
    if (!selected) return;
    if (
      await rpc("transition_document", {
        target: selected.id,
        new_status: status,
        reason: "Updated from Document Center",
      })
    )
      setSelected(null);
  }
  if (state === "loading")
    return (
      <main className="rk-dashboard-foundation">
        <section className="rk-access-denied">
          Menyiapkan Document Center...
        </section>
      </main>
    );
  if (state === "denied")
    return (
      <main className="rk-dashboard-foundation">
        <section className="rk-access-denied">
          <h1>Akses Document Center belum tersedia</h1>
          <Link href="/ruang-kawan/dashboard/">Kembali</Link>
        </section>
      </main>
    );
  return (
    <main className="rk-doc-foundation">
      <section className="rk-doc-shell">
        <nav>
          <Link href="/ruang-kawan/dashboard/">
            <FiArrowLeft /> Dashboard
          </Link>
          <button onClick={() => void load()}>
            <FiRefreshCw /> Muat ulang
          </button>
        </nav>
        <header className="rk-doc-heading">
          <div>
            <small>Controlled document workspace</small>
            <h1>Document Center</h1>
            <p>
              Temukan versi yang berlaku, kelola revisi, dan hubungkan dokumen
              dengan pekerjaan.
            </p>
          </div>
          {canCreate ? (
            <div>
              <button
                onClick={() => {
                  setDocForm(blankDoc);
                  setModal("document");
                }}
              >
                <FiFilePlus /> Daftarkan dokumen
              </button>
              <button
                onClick={() => {
                  setRequestForm(blankRequest);
                  setModal("request");
                }}
              >
                <FiSend /> Request
              </button>
            </div>
          ) : null}
        </header>
        <div className="rk-doc-tabs">
          {(
            [
              "overview",
              "templates",
              "documents",
              "uploads",
              "requests",
            ] as Tab[]
          ).map((x, i) => (
            <button key={x} data-active={tab === x} onClick={() => setTab(x)}>
              {
                [
                  <FiGrid key="a" />,
                  <FiSettings key="b" />,
                  <FiFolder key="c" />,
                  <FiUpload key="d" />,
                  <FiSend key="e" />,
                ][i]
              }{" "}
              {x[0].toUpperCase() + x.slice(1)}
            </button>
          ))}
        </div>
        {message ? <p className="rk-doc-alert">{message}</p> : null}
        {error ? (
          <p className="rk-doc-alert" data-error>
            {error}
          </p>
        ) : null}
        {tab === "overview" ? (
          <>
            <section className="rk-doc-stats">
              <article>
                <FiFolder />
                <b>{stats.total}</b>
                <span>Total Documents</span>
              </article>
              <article>
                <FiFile />
                <b>{stats.active_templates}</b>
                <span>Active Templates</span>
              </article>
              <article>
                <FiClock />
                <b>{stats.drafts}</b>
                <span>Draft Documents</span>
              </article>
            </section>
            <section className="rk-doc-overview">
              <div>
                <h2>Needs Attention</h2>
                <strong>{stats.needs_attention}</strong>
                <p>Review, masa berlaku, atau evaluasi membutuhkan tindakan.</p>
              </div>
              <div>
                <h2>Dokumen terbaru</h2>
                {documents.slice(0, 5).map((d) => (
                  <button key={d.id} onClick={() => setSelected(d)}>
                    <span>{d.document_id}</span>
                    <b>{d.title}</b>
                    <small>
                      {d.status} · v{d.active_version}
                    </small>
                  </button>
                ))}
              </div>
              <div>
                <h2>Request berjalan</h2>
                {requests
                  .filter((r) => !["completed", "cancelled"].includes(r.status))
                  .slice(0, 5)
                  .map((r) => (
                    <article key={r.id}>
                      <span>{r.request_code}</span>
                      <b>{r.title}</b>
                      <small>{r.status}</small>
                    </article>
                  ))}
              </div>
            </section>
          </>
        ) : null}
        {tab === "documents" || tab === "uploads" ? (
          <section className="rk-doc-register">
            <header>
              <div>
                <small>{visible.length} record</small>
                <h2>
                  {tab === "uploads"
                    ? "Upload & Drive Registry"
                    : "Documents Register"}
                </h2>
              </div>
              <label>
                <FiSearch />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Judul, nomor, tag, owner..."
                />
              </label>
            </header>
            <div className="rk-doc-table">
              <div>
                <b>Dokumen</b>
                <b>Owner / Relasi</b>
                <b>Versi</b>
                <b>Status</b>
                <b>Berlaku</b>
              </div>
              {visible.map((d) => (
                <button key={d.id} onClick={() => setSelected(d)}>
                  <span>
                    <small>
                      {d.official_number || d.external_number || d.document_id}
                    </small>
                    <b>{d.title}</b>
                    <em>
                      {d.document_type} · {d.classification}
                    </em>
                  </span>
                  <span>
                    <b>{d.owner_name}</b>
                    <small>
                      {d.linked_record_name ||
                        d.source_module ||
                        "Tanpa relasi"}
                    </small>
                  </span>
                  <b>v{d.active_version}</b>
                  <i data-status={d.status}>{d.status}</i>
                  <small>{d.expires_at || d.next_review_date || "—"}</small>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {tab === "templates" ? (
          <section className="rk-doc-register">
            <header>
              <div>
                <small>{templates.length} template</small>
                <h2>Templates</h2>
              </div>
              {canManage ? (
                <button
                  onClick={() => {
                    setEditingTemplateId(null);
                    setTemplateForm(blankTemplate);
                    setModal("template");
                  }}
                >
                  <FiPlus /> Template
                </button>
              ) : null}
            </header>
            <div className="rk-doc-cards">
              {templates.map((t) => (
                <article key={t.id}>
                  <span>
                    {t.template_code} · {t.google_file_type ?? "document"}
                  </span>
                  <h3>{t.name}</h3>
                  <p>{t.description || t.document_type}</p>
                  <small>
                    {t.owner_name} · v{t.active_version} · {t.status}
                  </small>
                  <a href={t.drive_template_url} target="_blank">
                    <FiLink /> Buka template
                  </a>
                  {canManage ? (
                    <button type="button" onClick={() => editTemplate(t)}>
                      <FiEdit3 /> Atur template & placeholder
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {tab === "requests" ? (
          <section className="rk-doc-register">
            <header>
              <div>
                <small>{requests.length} request</small>
                <h2>Document Requests</h2>
              </div>
              <button
                onClick={() => {
                  setRequestForm(blankRequest);
                  setModal("request");
                }}
              >
                <FiPlus /> Request
              </button>
            </header>
            <div className="rk-doc-cards">
              {requests.map((r) => (
                <article key={r.id}>
                  <span>
                    {r.request_code} · {r.priority}
                  </span>
                  <h3>{r.title}</h3>
                  <p>{r.description}</p>
                  <small>
                    {r.requester_name} → {r.assignee_name || "Belum ditugaskan"}{" "}
                    · {r.status}
                  </small>
                  {r.result_url ? (
                    <a href={r.result_url} target="_blank">
                      Buka hasil
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
      {selected ? (
        <div className="rk-doc-drawer">
          <button onClick={() => setSelected(null)}>
            <FiX />
          </button>
          <small>{selected.document_id}</small>
          <h2>{selected.title}</h2>
          <dl>
            <dt>Nomor</dt>
            <dd>
              {selected.official_number ||
                selected.external_number ||
                "Belum diberikan"}
            </dd>
            <dt>Status & versi</dt>
            <dd>
              {selected.status} · v{selected.active_version}
            </dd>
            <dt>Owner</dt>
            <dd>{selected.owner_name}</dd>
            <dt>Klasifikasi</dt>
            <dd>{selected.classification}</dd>
            <dt>Relasi</dt>
            <dd>{selected.linked_record_name || "—"}</dd>
            <dt>Berlaku/evaluasi</dt>
            <dd>{selected.expires_at || selected.next_review_date || "—"}</dd>
          </dl>
          {selected.current_file ? (
            <a href={selected.current_file} target="_blank">
              <FiLink /> Buka file aktif
            </a>
          ) : null}
          <footer>
            {["draft", "revised"].includes(selected.status) ? (
              <button onClick={() => void transition("review")}>
                Kirim Review
              </button>
            ) : null}
            {selected.status === "review" &&
            permissions.includes("documents.finalize") ? (
              <button onClick={() => void transition("effective")}>
                Jadikan Effective
              </button>
            ) : null}
            {selected.status === "effective" && canManage ? (
              <button
                onClick={() => {
                  setRevisionForm({
                    ...blankRevision,
                    file_name: `${selected.title} v${selected.active_version + 1}`,
                  });
                  setModal("revision");
                }}
              >
                Buat Revisi
              </button>
            ) : null}
            {canManage ? (
              <button onClick={() => void transition("archived")}>
                Archive
              </button>
            ) : null}
          </footer>
        </div>
      ) : null}
      {modal === "revision" ? (
        <div className="rk-doc-modal">
          <form onSubmit={saveRevision}>
            <header>
              <h2>Buat revisi dokumen</h2>
              <button type="button" onClick={() => setModal(null)}>
                <FiX />
              </button>
            </header>
            <div>
              <label className="wide">
                Nama file
                <input
                  value={revisionForm.file_name}
                  onChange={(e) =>
                    setRevisionForm({
                      ...revisionForm,
                      file_name: e.target.value,
                    })
                  }
                  required
                />
              </label>
              <label className="wide">
                Link Google Drive versi baru
                <input
                  type="url"
                  value={revisionForm.drive_file_url}
                  onChange={(e) =>
                    setRevisionForm({
                      ...revisionForm,
                      drive_file_url: e.target.value,
                    })
                  }
                  required
                />
              </label>
              <label className="wide">
                Alasan revisi
                <textarea
                  value={revisionForm.revision_reason}
                  onChange={(e) =>
                    setRevisionForm({
                      ...revisionForm,
                      revision_reason: e.target.value,
                    })
                  }
                  required
                />
              </label>
              <label className="wide">
                Ringkasan perubahan
                <textarea
                  value={revisionForm.revision_summary}
                  onChange={(e) =>
                    setRevisionForm({
                      ...revisionForm,
                      revision_summary: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            {error ? (
              <p className="rk-doc-alert" data-error>
                {error}
              </p>
            ) : null}
            <footer>
              <button type="button" onClick={() => setModal(null)}>
                Batal
              </button>
              <button data-primary disabled={saving}>
                {saving ? "Menyimpan..." : "Buat Revisi"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
      {modal && modal !== "revision" ? (
        <div className="rk-doc-modal">
          <form
            onSubmit={
              modal === "document"
                ? saveDoc
                : modal === "template"
                  ? saveTemplate
                  : saveRequest
            }
          >
            <header>
              <h2>
                {modal === "document"
                  ? "Daftarkan dokumen"
                  : modal === "template"
                    ? "Template dokumen"
                    : "Document request"}
              </h2>
              <button type="button" onClick={() => setModal(null)}>
                <FiX />
              </button>
            </header>
            <div>
              {modal === "document" ? (
                <>
                  <label>
                    Judul
                    <input
                      value={docForm.title}
                      onChange={(e) =>
                        setDocForm({ ...docForm, title: e.target.value })
                      }
                      required
                    />
                  </label>
                  <label>
                    Jenis dokumen
                    <input
                      value={docForm.document_type}
                      onChange={(e) =>
                        setDocForm({
                          ...docForm,
                          document_type: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Kategori
                    <input
                      value={docForm.category}
                      onChange={(e) =>
                        setDocForm({ ...docForm, category: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Klasifikasi
                    <select
                      value={docForm.classification}
                      onChange={(e) =>
                        setDocForm({
                          ...docForm,
                          classification: e.target.value,
                        })
                      }
                    >
                      <option value="internal">Internal</option>
                      <option value="public">Public</option>
                      <option value="confidential">Confidential</option>
                      <option value="restricted">Restricted</option>
                    </select>
                  </label>
                  <label>
                    Source module
                    <input
                      value={docForm.source_module}
                      onChange={(e) =>
                        setDocForm({
                          ...docForm,
                          source_module: e.target.value,
                        })
                      }
                      placeholder="project, finance, reports..."
                    />
                  </label>
                  <label>
                    Linked record ID
                    <input
                      value={docForm.linked_record_id}
                      onChange={(e) =>
                        setDocForm({
                          ...docForm,
                          linked_record_id: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="wide">
                    Nama record terkait
                    <input
                      value={docForm.linked_record_name}
                      onChange={(e) =>
                        setDocForm({
                          ...docForm,
                          linked_record_name: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Nomor eksternal
                    <input
                      value={docForm.external_number}
                      onChange={(e) =>
                        setDocForm({
                          ...docForm,
                          external_number: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Tag
                    <input
                      value={docForm.tags}
                      onChange={(e) =>
                        setDocForm({ ...docForm, tags: e.target.value })
                      }
                      placeholder="kontrak, project"
                    />
                  </label>
                  <label className="wide">
                    Link Google Drive
                    <input
                      type="url"
                      value={docForm.drive_file_url}
                      onChange={(e) =>
                        setDocForm({
                          ...docForm,
                          drive_file_url: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label className="wide">
                    Deskripsi
                    <textarea
                      value={docForm.description}
                      onChange={(e) =>
                        setDocForm({ ...docForm, description: e.target.value })
                      }
                    />
                  </label>
                </>
              ) : modal === "template" ? (
                <>
                  <label>
                    Kode
                    <input
                      value={templateForm.template_code}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          template_code: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Nama
                    <input
                      value={templateForm.name}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          name: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Jenis dokumen
                    <input
                      value={templateForm.document_type}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          document_type: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={templateForm.status}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          status: e.target.value,
                        })
                      }
                    >
                      <option>draft</option>
                      <option>active</option>
                      <option>inactive</option>
                      <option>archived</option>
                    </select>
                  </label>
                  <label>
                    Format Google
                    <select
                      value={templateForm.google_file_type}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          google_file_type: e.target.value as
                            | "document"
                            | "presentation",
                        })
                      }
                    >
                      <option value="document">Google Docs</option>
                      <option value="presentation">Google Slides</option>
                    </select>
                  </label>
                  <label className="wide">
                    Link template Drive
                    <input
                      type="url"
                      value={templateForm.drive_template_url}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          drive_template_url: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label className="wide">
                    Folder output Google Drive
                    <input
                      type="url"
                      value={templateForm.output_folder_url}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          output_folder_url: e.target.value,
                        })
                      }
                      placeholder="Folder tujuan hasil generate"
                    />
                  </label>
                  <label className="wide">
                    Required fields — satu per baris
                    <textarea
                      value={templateForm.required_fields}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          required_fields: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="wide">
                    Placeholder — satu per baris
                    <textarea
                      value={templateForm.placeholder_map}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          placeholder_map: e.target.value,
                        })
                      }
                      placeholder={
                        "{{nama_pic}}=snapshot.owner_name\n{{periode}}=snapshot.period_start"
                      }
                    />
                    <small>
                      Placeholder standar: report_type, period_start, period_end,
                      score, owner_name, progress, problem, plan, priority, notes,
                      insight, dan kpis.
                    </small>
                  </label>
                </>
              ) : (
                <>
                  <label className="wide">
                    Judul kebutuhan
                    <input
                      value={requestForm.title}
                      onChange={(e) =>
                        setRequestForm({
                          ...requestForm,
                          title: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Jenis
                    <select
                      value={requestForm.request_type}
                      onChange={(e) =>
                        setRequestForm({
                          ...requestForm,
                          request_type: e.target.value,
                        })
                      }
                    >
                      {[
                        "new_document",
                        "provide_existing",
                        "revision",
                        "template_update",
                        "access_change",
                        "metadata_correction",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Prioritas
                    <select
                      value={requestForm.priority}
                      onChange={(e) =>
                        setRequestForm({
                          ...requestForm,
                          priority: e.target.value,
                        })
                      }
                    >
                      {["low", "medium", "high", "urgent"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Target
                    <input
                      type="date"
                      value={requestForm.target_date}
                      onChange={(e) =>
                        setRequestForm({
                          ...requestForm,
                          target_date: e.target.value,
                        })
                      }
                    />
                  </label>
                  {members.length ? (
                    <label>
                      Penanggung jawab
                      <select
                        value={requestForm.assignee_membership_id}
                        onChange={(e) =>
                          setRequestForm({
                            ...requestForm,
                            assignee_membership_id: e.target.value,
                          })
                        }
                      >
                        <option value="">Belum ditentukan</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="wide">
                    Deskripsi
                    <textarea
                      value={requestForm.description}
                      onChange={(e) =>
                        setRequestForm({
                          ...requestForm,
                          description: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                </>
              )}
            </div>
            {error ? (
              <p className="rk-doc-alert" data-error>
                {error}
              </p>
            ) : null}
            <footer>
              <button type="button" onClick={() => setModal(null)}>
                Batal
              </button>
              <button data-primary disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </main>
  );
}
