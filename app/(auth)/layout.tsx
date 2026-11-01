export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <p className="text-center text-sm font-semibold tracking-wide text-primary">Sistema Restaurante</p>
      {children}
    </main>
  );
}
