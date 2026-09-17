import { ERROR_MESSAGES } from "@archiva/shared";
import { getRouteApi } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { type JSX, useState } from "react";
import { Alert, AlertDescription } from "../components/ui/alert.tsx";
import { Button } from "../components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card.tsx";
import { Input } from "../components/ui/input.tsx";
import { Label } from "../components/ui/label.tsx";
import { loginRequest } from "../features/auth/api.ts";
import { useAuthStore } from "../features/auth/auth-store.ts";

export interface LoginSearchParams {
  redirect?: string;
  expired?: boolean;
}

const loginRouteApi = getRouteApi("/login");

export function LoginPage(): JSX.Element {
  const search = loginRouteApi.useSearch();
  const sessionExpiredMessage = useAuthStore((s) => s.sessionExpiredMessage);
  const setPrincipal = useAuthStore((s) => s.setPrincipal);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const showExpiredAlert = search.expired || Boolean(sessionExpiredMessage);
  const expiredText = sessionExpiredMessage ?? ERROR_MESSAGES.SESSION_EXPIRED;

  // SCAFFOLD: FE-S1-02 replaces this interim manual form with React Hook Form + @archiva/shared Zod resolver.
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const principal = await loginRequest({ email, password });
      setPrincipal(principal);
      const target =
        search.redirect?.startsWith("/") && !search.redirect.startsWith("//")
          ? search.redirect
          : "/";
      if (typeof window !== "undefined") {
        window.location.href = target;
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(ERROR_MESSAGES.INTERNAL_ERROR);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Archiva</CardTitle>
          <CardDescription>Masuk ke akun Anda untuk melanjutkan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showExpiredAlert ? (
            <Alert variant="warning">
              <AlertCircle className="size-4" />
              <AlertDescription>{expiredText}</AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@perusahaan.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Memproses..." : "Masuk"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
