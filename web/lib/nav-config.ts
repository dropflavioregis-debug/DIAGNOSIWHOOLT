export const NAV_SECTIONS = [
  {
    label: "Principale",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/battery", label: "Batteria", icon: "battery" },
      { href: "/dtc", label: "Errori DTC", icon: "dtc" },
      { href: "/ai", label: "AI Diagnosi", icon: "ai" },
      { href: "/sessions", label: "Sessioni", icon: "sessions" },
    ],
  },
  {
    label: "Configurazione",
    items: [
      { href: "/libs", label: "Librerie", icon: "libs" },
      { href: "/device", label: "Dispositivo", icon: "device" },
      { href: "/config", label: "Config", icon: "config" },
      { href: "/test", label: "Test connessioni", icon: "test" },
    ],
  },
] as const;

export type NavIcon = (typeof NAV_SECTIONS)[number]["items"][number]["icon"];
