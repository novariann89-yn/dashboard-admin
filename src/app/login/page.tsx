import { loginAction } from "@/actions/auth";
import { IconBottle } from "@/components/icons";
import {
  alertErrorClass,
  alertWarnClass,
  buttonClass,
  inputClass,
  sectionLabelClass,
  strongCardClass,
} from "@/components/ui";
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
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-card border-2 border-ink bg-soy shadow-hard-sm">
          <IconBottle className="h-8 w-8" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Toko Mas Andik
          </h1>
          <p className="text-sm text-ink-soft">Dashboard member dan pembelian</p>
        </div>
      </div>

      <div className={strongCardClass}>
        <form action={loginAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className={sectionLabelClass}>PIN Admin</span>
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              required
              className={`${inputClass} text-center text-lg tracking-[0.4em]`}
            />
          </label>
          <button className={buttonClass}>Masuk</button>
        </form>
      </div>

      {error === "terlalu-banyak" && (
        <p className={alertErrorClass}>Terlalu banyak percobaan. Coba lagi nanti.</p>
      )}
      {error === "1" && <p className={alertErrorClass}>PIN salah.</p>}

      {showSetupHint && (
        <p className={alertWarnClass}>
          ADMIN_PIN_HASH belum diatur. Jalankan `npm run hash-pin -- 1234` lalu isi
          hasilnya ke .env.local.
        </p>
      )}
    </main>
  );
}
