"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useProfileViewModel } from "./profile.viewmodel";
import { FiUser } from "react-icons/fi";

export default function ProfilePage() {
  const { profiles, selected, selectProfile } = useProfileViewModel();
  const router = useRouter();

  return (
    <div
      className={`
        flex flex-col items-center justify-center min-h-screen
        ${typeof window !== "undefined" && document.body.classList.contains("dark-mode")
          ? "bg-[#222] text-white"
          : "bg-gray-100 text-gray-900"}
      `}
    >
      <div className="bg-white dark:bg-[#232b2b] rounded-xl shadow-lg p-8 w-full max-w-md flex flex-col items-center">
        <h1 className="text-2xl font-bold mb-6 text-center">Escolha o Perfil</h1>
        <div className="flex flex-col gap-6 w-full">
          {profiles.map((profile) => (
            <button
              key={profile.type}
              onClick={() => {
                selectProfile(profile.type);
                localStorage.setItem("profileType", profile.type);
                setTimeout(() => {
                  router.push(profile.type === "admin" ? "/admin" : "/");
                }, 400);
              }}
              className={`
                flex items-center gap-4 w-full px-6 py-4 rounded-lg shadow
                transition-all duration-300 border-2
                ${selected === profile.type
                  ? "border-green-600 scale-105 bg-green-50 dark:bg-green-900"
                  : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#232b2b] hover:bg-green-100 dark:hover:bg-green-800"}
                focus:outline-none
              `}
            >
              {profile.type === "user" ? (
                <span className="text-3xl text-green-700 dark:text-green-300">
                  <FiUser />
                </span>
              ) : (
                <Image
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  width={48}
                  height={48}
                  className="rounded-full border"
                  unoptimized
                />
              )}
              <span className="text-lg font-semibold">{profile.displayName}</span>
              {selected === profile.type && (
                <span className="ml-auto text-green-600 dark:text-green-300 text-xl font-bold">✓</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => router.push("/")}
          className="mt-8 px-6 py-2 rounded-md bg-green-600 text-white font-bold hover:bg-green-700 transition"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}