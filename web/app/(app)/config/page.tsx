import Link from "next/link";

export default function ConfigPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-[var(--color-text-primary)]">Configurazione</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">Come configurare l’ESP32 e il dashboard</p>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">
        La configurazione WiFi, URL server e API key si fa sul dispositivo ESP32 (captive portal). Istruzioni e URL da copiare:{" "}
        <Link href="/device" className="text-[var(--color-text-info)] underline hover:no-underline">
          pagina Dispositivo
        </Link>.
      </p>
      <p className="text-xs text-[var(--color-text-secondary)]">
        Panoramica delle API e protocolli effettivi (webapp, firmware, interno):{" "}
        <Link href="/backend" className="text-[var(--color-text-info)] underline hover:no-underline">
          API & Protocolli
        </Link>.
      </p>
      <p className="text-xs text-[var(--color-text-secondary)]">
        Per verificare database e endpoint ESP32:{" "}
        <Link href="/test" className="text-[var(--color-text-info)] underline hover:no-underline">
          Test connessioni
        </Link>.
      </p>
    </div>
  );
}
