import { ERROR_MESSAGES, type LoginBody, loginBody } from "@archiva/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { getRouteApi } from "@tanstack/react-router";
import { AlertCircle, CircleX, Eye, EyeOff, LogIn } from "lucide-react";
import { type JSX, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, AlertDescription } from "../components/ui/alert.tsx";
import { Button } from "../components/ui/button.tsx";
import { Input } from "../components/ui/input.tsx";
import { Label } from "../components/ui/label.tsx";
import { loginRequest } from "../features/auth/api.ts";
import { useAuthStore } from "../features/auth/auth-store.ts";
import { ApiError } from "../lib/api.ts";
import { LoginLogo } from "./internal/archiva-logo.tsx";
import { LoginBanner } from "./internal/login-banner.tsx";

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
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Left panel: Login form */}
      <div className="flex w-full flex-col justify-between p-6 sm:p-10 lg:w-1/2 lg:p-12">
        <div className="flex items-center">
          <LoginLogo />
        </div>

        <div className="mx-auto flex w-full max-w-100 flex-col gap-6 py-8">
          {/* Header matching Figma login-header (gap 10px) */}
          <div className="flex flex-col items-center gap-2.5 text-center">
            <div className="flex size-14 items-center justify-center rounded-[18px] border border-primary/20 bg-primary text-primary-foreground shadow-md shadow-primary/15">
              <LogIn className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="font-bold text-xl text-foreground tracking-tight">
                Login to your account
              </h1>
              <p className="text-muted-foreground text-sm">
                Enter your registered email and password to login
              </p>
            </div>
          </div>

          {showExpiredAlert ? (
            <Alert variant="warning">
              <AlertCircle />
              <AlertDescription>{expiredText}</AlertDescription>
            </Alert>
          ) : null}

          {serverError ? (
            <Alert variant="destructive">
              <CircleX />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          {/* Form matching Figma login-form (gap 20px) */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@perusahaan.com"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.email)}
                className="h-10 rounded-[10px]"
                {...register("email")}
              />
              {errors.email ? (
                <p className="text-destructive text-xs">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.password)}
                  className="h-10 rounded-[10px] pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-hidden"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password ? (
                <p className="text-destructive text-xs">{errors.password.message}</p>
              ) : null}
            </div>
            <Button
              type="submit"
              className="h-10 w-full gap-1.5 rounded-[10px] px-2.5"
              disabled={isSubmitting}
            >
              <span>{isSubmitting ? "Memproses..." : "Login"}</span>
              <LogIn className="size-4" />
            </Button>
          </form>
        </div>

        <div className="text-center text-muted-foreground text-xs">
          &copy; {new Date().getFullYear()} PT Perkasa Pilar Utama. All rights reserved.
        </div>
      </div>

      {/* Right panel: Desktop decorative branding */}
      <LoginBanner />
    </div>
  );
}
