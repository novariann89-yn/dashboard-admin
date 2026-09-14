import { loginAction } from "@/actions/auth";
import { buttonClass, inputClass } from "@/components/ui";
import { first } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const error = first(sp.error);
  const showSetupHint = !process.env.ADMIN_PIN_HASH;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <div>
        <h1 className="text-xl font-bold">Toko Mas Andik</h1>
        <p className="text-sm text-gray-600">Masukkan PIN admin untuk masuk.</p>
      </div>

      {error === "terlalu-banyak" && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Terlalu banyak percobaan. Coba lagi nanti.
        </p>
      )}
      {error === "1" && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          PIN salah.
        </p>
      )}

      {showSetupHint && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          ADMIN_PIN_HASH belum diatur. Jalankan `npm run hash-pin -- 1234` lalu isi
          hasilnya ke .env.local.
        </p>
      )}

      <form action={loginAction} className="flex flex-col gap-3">
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN"
          required
          className={inputClass}
        />
        <button className={buttonClass}>Masuk</button>
      </form>
    </main>
  );
}
