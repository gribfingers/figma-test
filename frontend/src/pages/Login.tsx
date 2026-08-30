import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Field } from "../components/Field";
import { PlaneIcon } from "../components/Icon";
import { useLanguage } from "../i18n";

export function Login() {
  const { user, login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(loginName, password);
      navigate("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <PlaneIcon size={26} />
          <span>Airport DCS</span>
        </div>
        {error && <div className="error-box">{error}</div>}
        <Field label={t("Login")}>
          <input value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder=" " autoFocus />
        </Field>
        <Field label={t("Password")}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder=" " />
        </Field>
        <button type="submit" disabled={busy || !loginName || !password}>
          {t("Sign in")}
        </button>
      </form>
    </div>
  );
}
