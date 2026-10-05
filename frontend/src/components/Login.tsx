import { FormEvent, useState } from "react";
import {
  Snowflake,
  CalendarDays,
  Users,
  ChartNoAxesColumnIncreasing,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Button, Field, inputClass } from "./ui";
export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function signIn(demo = false) {
    setError("");
    setPending(true);
    try {
      await login(
        demo ? "admin@arctic.com" : email,
        demo ? "demo1234" : password,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setPending(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void signIn();
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <Snowflake />
          ARCTIC
        </div>
        <div className="login-story-content">
          <div className="eyebrow">AIRCON SERVICE MANAGEMENT</div>
          <h1>
            Smarter
            <br />
            aircon service.
            <br />
            <span>
              From booking
              <br />
              to breakdown.
            </span>
          </h1>
          <p>
            Keep operations smooth, customers happy, and every unit running at
            its best. Your entire service day, in one place.
          </p>
          <div className="login-benefits">
            <div>
              <CalendarDays />
              <span>
                Streamline
                <br />
                operations
              </span>
            </div>
            <div>
              <Users />
              <span>
                Empower
                <br />
                technicians
              </span>
            </div>
            <div>
              <ChartNoAxesColumnIncreasing />
              <span>
                Grow your
                <br />
                business
              </span>
            </div>
          </div>
        </div>
        <p className="login-brand-footer">ARCTIC · Keep every space cool.</p>
        <div className="login-circles" aria-hidden="true" />
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <div className="eyebrow">YOUR SERVICE WORKSPACE</div>
          <h2>Welcome back.</h2>
          <p>
            A clearer view of your business starts here.
            <br />
            Sign in to plan, dispatch, and get things done.
          </p>
          <form onSubmit={submit}>
            <Field label="Email address">
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Password">
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </Field>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" loading={pending}>
              Sign in to ARCTIC
              <ArrowRight size={16} />
            </Button>
          </form>
          <div className="demo-card">
            <p>
              <strong>Take a look around.</strong>
              <br />
              Explore the portfolio demo with synthetic service records.
            </p>
            <Button
              variant="secondary"
              loading={pending}
              onClick={() => void signIn(true)}
            >
              Explore demo workspace
              <ArrowRight size={15} />
            </Button>
          </div>
          <div className="login-note">
            <ShieldCheck
              size={13}
              style={{
                display: "inline",
                verticalAlign: "middle",
                marginRight: 5,
              }}
            />
            Your workspace access follows your assigned branch.
          </div>
        </div>
      </section>
    </main>
  );
}
