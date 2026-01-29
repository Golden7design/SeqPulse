import { create } from "zustand";
import fr from "@/configs/i18n/fr.json";
import en from "@/configs/i18n/en.json";

type Lang = "fr" | "en";

type AppState = {
  language: Lang;
  setLanguage: (l: Lang) => void;
  t: (key: string) => string;
};

export const useAppStore = create<AppState>((set, get) => ({
  language: "fr",

  setLanguage: (language) => set({ language }),

  t: (key: string) => {
    const lang = get().language;
    const dict = lang === "en" ? en : fr;
    return (dict as Record<string, string>)[key] || key;
  },
}));
