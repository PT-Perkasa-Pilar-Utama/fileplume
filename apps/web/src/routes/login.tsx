import { ERROR_MESSAGES, type LoginBody, loginBody } from "@archiva/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { getRouteApi } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { type JSX, useState } from "react";
import { useForm } from "react-hook-form";
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
import { ApiError } from "../lib/api.ts";

export interface LoginSearchParams {
  redirect?: string;
  expired?: boolean;
}

const loginRouteApi = getRouteApi("/login");

export function LoginPage(): JSX.Element {
  const search = loginRouteApi.useSearch();
  const sessionExpiredMessage = useAuthStore((s) => s.sessionExpiredMessage);
  const setPrincipal = useAuthStore((s) => s.setPrincipal);

  const [serverError, setServerError] = useState<string | null>(null);

  const showExpiredAlert = search.expired || Boolean(sessionExpiredMessage);
  const expiredText = sessionExpiredMessage ?? ERROR_MESSAGES.SESSION_EXPIRED;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginBody>({
    resolver: zodResolver(loginBody),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginBody): Promise<void> => {
    setServerError(null);

    try {
      const principal = await loginRequest(values);
      setPrincipal(principal);
      const target =
        search.redirect?.startsWith("/") && !search.redirect.startsWith("//")
          ? search.redirect
          : "/";
      if (typeof window !== "undefined") {
        window.location.href = target;
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === "INVALID_CREDENTIALS") {
          setServerError(ERROR_MESSAGES.INVALID_CREDENTIALS);
        } else {
          setServerError(err.message);
        }
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError(ERROR_MESSAGES.INTERNAL_ERROR);
      }
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

          {serverError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@perusahaan.com"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
              {errors.password ? (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Memproses..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
