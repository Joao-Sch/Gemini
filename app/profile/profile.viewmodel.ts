import { useState } from "react";
import { UserProfile, UserProfileType } from "./profile.model";

export function useProfileViewModel() {
  const [selected, setSelected] = useState<UserProfileType | null>(null);

  const profiles: UserProfile[] = [
    {
      type: "user",
      displayName: "Usuário",
      avatarUrl: "/default-user.png",
    },
    {
      type: "admin",
      displayName: "Central/Admin",
      avatarUrl: "/roboIcon.png",
    },
  ];

  function selectProfile(type: UserProfileType) {
    setSelected(type);
    // Aqui você pode salvar no localStorage, contexto, ou redirecionar
    // Exemplo: localStorage.setItem("profileType", type);
  }

  return {
    profiles,
    selected,
    selectProfile,
  };
}