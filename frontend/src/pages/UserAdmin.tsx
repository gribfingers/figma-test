import { FormEvent, useEffect, useState } from "react";
import { api, User } from "../api";
import { useAuth } from "../auth";
import { useRegisterTab } from "../tabs";
import { Field } from "../components/Field";
import { Select } from "../components/Select";
import { Modal } from "../components/Modal";
import { CopyIcon } from "../components/Icon";
import { useLanguage } from "../i18n";
import { useConfirmDialog } from "../confirmDialog";
import { useToast } from "../toast";

type Draft = {
  login: string;
  first_name: string;
  last_name: string;
  role: "superadmin" | "user";
  can_edit: boolean;
  company: string;
};

const EMPTY_DRAFT: Draft = { login: "", first_name: "", last_name: "", role: "user", can_edit: false, company: "" };

export function UserAdmin() {
  const { t } = useLanguage();
  const { confirmDialog, alertDialog } = useConfirmDialog();
  const { showToast } = useToast();
  useRegisterTab("User administration", true);
  const { user: me } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);

  const [editing, setEditing] = useState<User | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [savingEdit, setSavingEdit] = useState(false);

  const [generatedPassword, setGeneratedPassword] = useState<{ login: string; password: string } | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  function load() {
    api.listUsers().then(setUsers).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  if (me?.role !== "superadmin") {
    return (
      <div>
        <h1>{t("User administration")}</h1>
        <p className="subtitle">{t("Superadmin only.")}</p>
      </div>
    );
  }

  function openAdd() {
    setAddDraft(EMPTY_DRAFT);
    setError("");
    setAddOpen(true);
  }

  async function submitAdd(e: FormEvent) {
    e.preventDefault();
    if (!addDraft.login.trim() || !addDraft.first_name.trim() || !addDraft.last_name.trim()) {
      setError(t("Login, first name and last name are required."));
      return;
    }
    setAdding(true);
    setError("");
    try {
      const { user, password } = await api.createUser({
        login: addDraft.login.trim(),
        first_name: addDraft.first_name.trim(),
        last_name: addDraft.last_name.trim(),
        role: addDraft.role,
        can_edit: addDraft.can_edit,
        company: addDraft.company.trim() || undefined,
      });
      setAddOpen(false);
      setGeneratedPassword({ login: user.login, password });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  function startEdit(u: User) {
    setEditing(u);
    setEditDraft({ login: u.login, first_name: u.first_name, last_name: u.last_name, role: u.role, can_edit: !!u.can_edit, company: u.company ?? "" });
    setError("");
  }

  async function saveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    setError("");
    try {
      await api.updateUser(editing.id, {
        first_name: editDraft.first_name.trim(),
        last_name: editDraft.last_name.trim(),
        role: editDraft.role,
        can_edit: editDraft.can_edit,
        company: editDraft.company.trim(),
      });
      setEditing(null);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function resetPassword(u: User) {
    if (!(await confirmDialog(t("Generate a new password for {login}? Their current password stops working immediately.").replace("{login}", u.login)))) return;
    setError("");
    try {
      const { password } = await api.resetUserPassword(u.id);
      setGeneratedPassword({ login: u.login, password });
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function copyGeneratedPassword() {
    if (!generatedPassword) return;
    const text = generatedPassword.password;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Clipboard API unavailable (non-HTTPS origin, older/restricted browser, etc.) —
        // fall back to the classic hidden-textarea + execCommand trick, which works
        // pretty much everywhere a click can trigger a copy at all.
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!ok) throw new Error(t("Clipboard access isn't available — select the password above and copy it manually."));
      }
      showToast(t("Copied to clipboard"));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteUser(u: User) {
    if (!(await confirmDialog(t("Delete user {login}?").replace("{login}", u.login), { danger: true }))) return;
    setError("");
    try {
      await api.deleteUser(u.id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function regenerateTodaySchedule() {
    const proceed = await confirmDialog(
      t(
        "Rebuild today's auto-generated demo flights from scratch? This deletes and recreates them with the current generator logic, so any open tabs pointing at today's flights/passengers will go stale."
      ),
      { danger: true }
    );
    if (!proceed) return;
    setRegenerating(true);
    setError("");
    try {
      const result = await api.regenerateTodaySchedule();
      await alertDialog(
        t("Regenerated {flights} flights / {passengers} passengers for today.")
          .replace("{flights}", String(result.flights))
          .replace("{passengers}", String(result.passengers))
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div>
      <h1>{t("User administration")}</h1>
      <p className="subtitle">{t("Create accounts, assign edit rights, and manage passwords.")}</p>

      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        <div className="toolbar">
          <div className="spacer" />
          <button type="button" className="secondary" disabled={regenerating} onClick={regenerateTodaySchedule}>
            {regenerating ? t("Regenerating…") : t("Regenerate today's schedule")}
          </button>
          <button type="button" className="secondary" onClick={openAdd}>{t("Add user")}</button>
        </div>
      </div>

      <div className="panel panel--flush">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Login")}</th>
                <th>{t("Name")}</th>
                <th>{t("Company")}</th>
                <th>{t("Role")}</th>
                <th>{t("Can edit")}</th>
                <th>{t("Created")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="mono">{u.login}</td>
                  <td>{u.first_name} {u.last_name}</td>
                  <td>{u.company}</td>
                  <td>{u.role === "superadmin" ? t("Superadmin") : t("User")}</td>
                  <td style={{ textAlign: "center" }}>{u.role === "superadmin" || u.can_edit ? "✓" : ""}</td>
                  <td className="mono">{u.created_at.slice(0, 10)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="secondary small" onClick={() => startEdit(u)}>{t("Edit")}</button>
                      <button type="button" className="secondary small" onClick={() => resetPassword(u)}>{t("Reset password")}</button>
                      <button
                        type="button"
                        className="danger small"
                        disabled={u.id === me.id}
                        onClick={() => deleteUser(u)}
                      >
                        {t("Delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: "var(--muted)" }}>{t("No users found.")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <Modal
          title={t("Add user")}
          onClose={() => setAddOpen(false)}
          width={480}
          footer={
            <>
              <button type="button" className="tertiary" onClick={() => setAddOpen(false)}>{t("Close")}</button>
              <button type="submit" form="add-user-form" className="tertiary" disabled={adding}>{t("Add")}</button>
            </>
          }
        >
          <form id="add-user-form" onSubmit={submitAdd} style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <Field label={t("First name")} style={{ flex: 1 }}>
                <input value={addDraft.first_name} onChange={(e) => setAddDraft({ ...addDraft, first_name: e.target.value })} placeholder=" " />
              </Field>
              <Field label={t("Last name")} style={{ flex: 1 }}>
                <input value={addDraft.last_name} onChange={(e) => setAddDraft({ ...addDraft, last_name: e.target.value })} placeholder=" " />
              </Field>
            </div>
            <Field label={t("Login")}>
              <input value={addDraft.login} onChange={(e) => setAddDraft({ ...addDraft, login: e.target.value.trim() })} placeholder=" " />
            </Field>
            <Field label={t("Company")}>
              <input value={addDraft.company} onChange={(e) => setAddDraft({ ...addDraft, company: e.target.value })} placeholder=" " />
            </Field>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Select
                label={t("Role")}
                style={{ width: 160 }}
                value={addDraft.role}
                onChange={(v) => setAddDraft({ ...addDraft, role: v as Draft["role"] })}
                options={[{ value: "user", label: t("User") }, { value: "superadmin", label: t("Superadmin") }]}
              />
              {addDraft.role === "user" && (
                <label className="checkbox-row" style={{ marginBottom: 16 }}>
                  <input
                    type="checkbox"
                    checked={addDraft.can_edit}
                    onChange={(e) => setAddDraft({ ...addDraft, can_edit: e.target.checked })}
                  />
                  {t("Can edit")}
                </label>
              )}
            </div>
            <p className="subtitle" style={{ margin: 0 }}>{t("A password will be generated automatically and shown once after creation.")}</p>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal
          title={t("Edit user: {login}").replace("{login}", editing.login)}
          onClose={() => setEditing(null)}
          width={480}
          footer={
            <>
              <button type="button" className="tertiary" onClick={() => setEditing(null)}>{t("Close")}</button>
              <button type="button" className="tertiary" disabled={savingEdit} onClick={saveEdit}>{t("Save")}</button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <Field label={t("First name")} style={{ flex: 1 }}>
                <input value={editDraft.first_name} onChange={(e) => setEditDraft({ ...editDraft, first_name: e.target.value })} placeholder=" " />
              </Field>
              <Field label={t("Last name")} style={{ flex: 1 }}>
                <input value={editDraft.last_name} onChange={(e) => setEditDraft({ ...editDraft, last_name: e.target.value })} placeholder=" " />
              </Field>
            </div>
            <Field label={t("Company")}>
              <input value={editDraft.company} onChange={(e) => setEditDraft({ ...editDraft, company: e.target.value })} placeholder=" " />
            </Field>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Select
                label={t("Role")}
                style={{ width: 160 }}
                value={editDraft.role}
                onChange={(v) => setEditDraft({ ...editDraft, role: v as Draft["role"] })}
                disabled={editing.id === me.id}
                options={[{ value: "user", label: t("User") }, { value: "superadmin", label: t("Superadmin") }]}
              />
              {editDraft.role === "user" && (
                <label className="checkbox-row" style={{ marginBottom: 16 }}>
                  <input
                    type="checkbox"
                    checked={editDraft.can_edit}
                    onChange={(e) => setEditDraft({ ...editDraft, can_edit: e.target.checked })}
                  />
                  {t("Can edit")}
                </label>
              )}
            </div>
          </div>
        </Modal>
      )}

      {generatedPassword && (
        <Modal
          title={t("Password for {login}").replace("{login}", generatedPassword.login)}
          onClose={() => setGeneratedPassword(null)}
          width={420}
          footer={<button type="button" className="tertiary" onClick={() => setGeneratedPassword(null)}>{t("Close")}</button>}
        >
          <p>{t("Share this password with the user now — it isn't shown again.")}</p>
          <div
            className="mono"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 20,
              fontWeight: 700,
              padding: "12px 16px",
              background: "var(--field-bg)",
              borderRadius: 4,
              marginBottom: 16,
            }}
          >
            <span style={{ userSelect: "all" }}>{generatedPassword.password}</span>
            <button type="button" className="icon-button" aria-label={t("Copy to clipboard")} onClick={copyGeneratedPassword}>
              <CopyIcon size={18} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
