"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useProfileViewModel } from "./profile.viewmodel";
import { FiUser, FiArrowLeft } from "react-icons/fi";
import { useState, useEffect } from "react";

export default function ProfilePage() {
  const { profiles, selected, selectProfile } = useProfileViewModel();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Detecta tema salvo/localStorage
    const isDark = document.body.classList.contains("dark-mode");
    setDarkMode(isDark);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
      document.documentElement.classList.add("dark");
    } else {
      document.body.classList.remove("dark-mode");
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <div
      className={`
        flex flex-col items-center justify-center min-h-screen
        ${
          darkMode
            ? "bg-[#222] text-white"
            : "bg-gray-100 text-gray-900"
        }
      `}
    >
      {/* Botão de tema centralizado no topo */}
      <div className="w-full flex justify-center fixed top-0 left-0 z-40 pt-4 pointer-events-none">
        <button
          onClick={() => setDarkMode((prev) => !prev)}
          className={`
            pointer-events-auto
            w-14 h-7 flex items-center rounded-full p-1
            transition-colors duration-500
            ${darkMode ? "bg-[#14532d]" : "bg-gray-300"}
            shadow
          `}
          aria-label="Alternar modo escuro"
        >
          <div
            className={`
              w-6 h-6 rounded-full bg-white shadow-md transform
              transition-transform duration-300 flex items-center justify-center
              ${darkMode ? "translate-x-7" : "translate-x-0"}
            `}
          >
            {darkMode ? (
              <span
                role="img"
                aria-label="Lua"
                className="text-yellow-400 text-lg transition-colors duration-500"
              >
                🌙
              </span>
            ) : (
              <span
                role="img"
                aria-label="Sol"
                className="text-yellow-500 text-lg transition-colors duration-500"
              >
                ☀️
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Botão de voltar fixo à direita */}
      <button
        onClick={() => router.push("/")}
        className={`
          fixed top-1/2 right-0 z-50
          flex items-center
          bg-green-600 text-white
          rounded-l-full
          shadow-lg
          transition-all duration-300
          pr-2 pl-4 py-2
          -translate-y-1/2
          group
          hover:bg-green-700 hover:scale-105
          w-12 hover:w-40
          cursor-pointer
          overflow-hidden
          border-2 border-green-700
          focus:outline-none focus:ring-2 focus:ring-green-400
        `}
        title="Voltar para o chat"
      >
        <span className="text-2xl">
          <FiArrowLeft />
        </span>
        <span
          className={`
            ml-3 text-base font-bold opacity-0
            group-hover:opacity-100
            transition-opacity duration-300
            whitespace-nowrap
            pointer-events-none
          `}
          style={{ width: "0", display: "inline-block" }}
        >
          Voltar
        </span>
      </button>

      <div className="bg-white dark:bg-[#232b2b] rounded-xl shadow-lg p-8 w-full max-w-md flex flex-col items-center">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Escolha o Perfil
        </h1>
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
                transition-transform
                hover:scale-105
                ${
                  selected === profile.type
                    ? "border-green-600 scale-105 bg-green-50 dark:bg-green-900"
                    : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#232b2b] hover:bg-green-100 dark:hover:bg-green-800"
                }
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
              <span className="text-lg font-semibold">
                {profile.displayName}
              </span>
              {selected === profile.type && (
                <span className="ml-auto text-green-600 dark:text-green-300 text-xl font-bold">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
