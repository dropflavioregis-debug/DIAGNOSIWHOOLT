import Anthropic from "@anthropic-ai/sdk";

export const SYSTEM_PROMPT = `
Sei un esperto diagnostico di veicoli elettrici.
Ti vengono forniti dati tecnici raw letti dal CAN bus di un veicolo.
Rispondi SEMPRE in italiano.
Analizza e fornisci:
1. Stato generale del veicolo
2. Descrizione dei DTC trovati in linguaggio semplice
3. Possibili cause e urgenza intervento
4. Stato batteria con interpretazione (non solo numeri)
5. Raccomandazioni specifiche
Sii conciso ma completo. Usa emoji per indicare severità.
`.trim();

export interface AnalyzeInput {
  raw_dtc?: string[];
  signals?: Record<string, unknown>;
  context?: string;
}

export async function analyzeWithClaude(input: AnalyzeInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "Analisi non disponibile: configura ANTHROPIC_API_KEY per l'analisi con Claude.";
  }
  const client = new Anthropic({ apiKey });
  const text = JSON.stringify(
    {
      raw_dtc: input.raw_dtc ?? [],
      signals: input.signals ?? {},
      context: input.context,
    },
    null,
    2
  );
  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Dati veicolo:\n${text}` }],
  });
  const block = msg.content.find((c) => c.type === "text");
  return block && "text" in block ? block.text : "Nessuna risposta.";
}
