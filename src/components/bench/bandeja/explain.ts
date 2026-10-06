import { prediction } from "@/lib/bench/answers";
import { majorityBaseline, meanAbsoluteError } from "@/lib/bench/metrics";
import type { BenchResult } from "@/lib/bench/server";
import { tickets, type Ticket } from "@/lib/data/tickets";
import type { RunItem } from "@/hooks/useBandejaRun";

export const DEPT_LABEL = { billing: "Facturación", technical: "Técnico", account: "Cuenta" } as const;
export const URGENCY_LABEL = ["Informativo", "Normal", "Alta", "Crítica"] as const;
export const SENDERS = [
  ["Marina Soler", "marina.soler"], ["Héctor Valls", "hector.valls"], ["Nuria Beltrán", "nuria.beltran"],
  ["Iago Mendes", "iago.mendes"], ["Clara Pujol", "clara.pujol"], ["Tomás Riera", "tomas.riera"],
  ["Ainhoa Ruiz", "ainhoa.ruiz"], ["Pau Ferrer", "pau.ferrer"], ["Leire Campos", "leire.campos"],
  ["Nil Ortega", "nil.ortega"], ["Sofía Alarcón", "sofia.alarcon"], ["Brais Nogueira", "brais.nogueira"],
  ["Elena Quirós", "elena.quiros"], ["Jan Casals", "jan.casals"], ["Irati López", "irati.lopez"],
  ["Mateo Vidal", "mateo.vidal"], ["Laia Font", "laia.font"], ["Unai Herrera", "unai.herrera"],
  ["Cloe Martí", "cloe.marti"], ["Gerard Puig", "gerard.puig"],
] as const;

const DEPT_CUES: Record<Ticket["department"], string[]> = {
  billing: ["charged", "invoice", "refund", "billed", "payment", "price", "receipt", "tax", "coupon", "currenc", "fee", "payroll", "billing", "purchase order", "charge", "discount", "quoted", "seats", "renewal", "card"],
  technical: ["api", "dashboard", "webhook", "crash", "timeout", "sso", "deploy", "sync", "browser", "token", "outage", "sandbox", "csv", "import", "callback", "mobile", "logs", "status page", "chart", "documentation", "freeze", "500", "endpoint", "firmware"],
  account: ["locked", "two-factor", "email", "admin", "member", "password", "workspace", "session", "ownership", "permission", "invitation", "role", "account", "profile", "guest", "display name", "deactivate", "deletion", "access", "2fa", "invite"],
};

const URGENCY_CUES = {
  3: ["today", "now", "immediately", "this morning", "in an hour", "all morning", "right now"],
  2: ["this week", "next month", "may leave", "will leave", "will cancel", "will migrate", "comparing", "reconsider"],
  1: ["please", "where", "how do i", "can i", "need to"],
  0: ["do you", "which", "is there", "where do i"],
};

const CHURN_CUES = ["cancel", "leave", "migrate", "switch", "will leave", "may leave", "close this account", "close it", "another provider", "evaluating alternatives"];

export type HumanTicket = { department: string; urgency: number; churn: boolean; ms: number };
export type FieldCall = { predicted: string | number | boolean | null; truth: string | number | boolean; confidence: number | null; ok: boolean };
export type TicketVerdict = {
  ticket: Ticket;
  department: FieldCall;
  urgency: FieldCall & { error: number };
  churn: FieldCall;
  failed: boolean;
  ms: number;
  cost: number;
};

export function senderOf(id: string) {
  const index = Math.max(0, Number(id.replace(/\D/g, "")) - 1);
  const [name, local] = SENDERS[index % SENDERS.length];
  return { name, email: `${local}@clientes.test`, initials: name.split(" ").map(part => part[0]).join("").slice(0, 2) };
}

export function subjectOf(text: string) {
  const line = text.trim().split(/(?<=[.!?])\s/)[0] || text;
  return line.length > 72 ? `${line.slice(0, 69)}...` : line;
}

export function pct(value: number, ready: boolean) {
  return ready ? `${Math.round(value * 100)}%` : "—";
}

export function itemPrediction(result: BenchResult | undefined, key: string, truth: string | number | boolean) {
  if (!result?.ok) return null;
  const answer = prediction(result.answers[key]);
  return answer ? { predicted: answer.value, truth, confidence: answer.confidence } : null;
}

function hits(text: string, needles: string[]) {
  const lower = text.toLowerCase();
  return needles.filter(needle => lower.includes(needle));
}

function quote(words: string[], fallback: string) {
  if (!words.length) return fallback;
  const shown = words.slice(0, 3).map(word => `«${word}»`).join(", ");
  return words.length > 3 ? `${shown} y otras` : shown;
}

export function majorityClass(values: (string | number | boolean)[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  let best = "", n = 0;
  for (const [key, count] of counts) if (count > n) { best = key; n = count; }
  return { value: best, share: values.length ? n / values.length : 0 };
}

export function verdictFromResult(ticket: Ticket, result: RunItem | undefined): TicketVerdict | null {
  if (!result) return null;
  const department = itemPrediction(result, "department", ticket.department);
  const urgency = itemPrediction(result, "urgency", ticket.urgency);
  const churn = itemPrediction(result, "churn", ticket.churn);
  const urgencyPredicted = typeof urgency?.predicted === "number" ? urgency.predicted : null;
  return {
    ticket,
    failed: !result.ok,
    ms: result.ok ? result.wallMs : 0,
    cost: result.ok ? result.usage.costUsd : 0,
    department: { predicted: department ? String(department.predicted) : null, truth: ticket.department, confidence: department?.confidence ?? null, ok: department?.predicted === ticket.department },
    urgency: { predicted: urgencyPredicted, truth: ticket.urgency, confidence: urgency?.confidence ?? null, ok: urgencyPredicted === ticket.urgency, error: urgencyPredicted === null ? 3 : Math.abs(urgencyPredicted - ticket.urgency) },
    churn: { predicted: typeof churn?.predicted === "boolean" ? churn.predicted : null, truth: ticket.churn, confidence: churn?.confidence ?? null, ok: churn?.predicted === ticket.churn },
  };
}

export function verdictFromHuman(ticket: Ticket, entry: HumanTicket): TicketVerdict {
  return {
    ticket,
    failed: false,
    ms: entry.ms,
    cost: 0,
    department: { predicted: entry.department, truth: ticket.department, confidence: null, ok: entry.department === ticket.department },
    urgency: { predicted: entry.urgency, truth: ticket.urgency, confidence: null, ok: entry.urgency === ticket.urgency, error: Math.abs(entry.urgency - ticket.urgency) },
    churn: { predicted: entry.churn, truth: ticket.churn, confidence: null, ok: entry.churn === ticket.churn },
  };
}

export function explainField(kind: "department" | "urgency" | "churn", verdict: TicketVerdict) {
  const text = verdict.ticket.text;
  if (verdict.failed) return "La llamada falló, así que este campo cuenta como error (misma regla que en el original).";
  if (kind === "department") {
    const truth = verdict.ticket.department;
    const predicted = verdict.department.predicted as Ticket["department"] | null;
    const truthCues = hits(text, DEPT_CUES[truth]);
    const predictedCues = predicted && predicted !== truth ? hits(text, DEPT_CUES[predicted]) : [];
    const others = (Object.keys(DEPT_CUES) as Ticket["department"][]).filter(key => key !== truth && hits(text, DEPT_CUES[key]).length);
    if (verdict.department.ok) {
      return `Acertó ${DEPT_LABEL[truth]}. El texto apunta ahí con ${quote(truthCues, "el tema del mensaje, aunque sin una palabra clave fuerte")}.`;
    }
    if (!predicted) return `No hubo etiqueta de departamento. Lo correcto era ${DEPT_LABEL[truth]} (${quote(truthCues, "el asunto del ticket")}).`;
    if (predictedCues.length && others.includes(predicted)) {
      return `Dijo ${DEPT_LABEL[predicted]} por ${quote(predictedCues, "señales cruzadas")}, pero la etiqueta es ${DEPT_LABEL[truth]} (${quote(truthCues, "el problema principal")}). El ticket mezcla dos temas.`;
    }
    return `Dijo ${DEPT_LABEL[predicted]} y era ${DEPT_LABEL[truth]}. Las pistas de ${DEPT_LABEL[truth]} son ${quote(truthCues, "el asunto central del ticket")}.`;
  }
  if (kind === "urgency") {
    const truth = verdict.ticket.urgency;
    const predicted = typeof verdict.urgency.predicted === "number" ? verdict.urgency.predicted : null;
    const cues = hits(text, URGENCY_CUES[truth as 0 | 1 | 2 | 3] ?? []);
    if (verdict.urgency.ok) return `Urgencia ${truth} (${URGENCY_LABEL[truth]}). ${cues.length ? `Encaja con ${quote(cues, "")}.` : "El tono del ticket no pide más prisa que esa."}`;
    if (predicted === null) return `Sin urgencia predicha. La correcta es ${truth} (${URGENCY_LABEL[truth]}). Cuenta un error de 3 niveles.`;
    const delta = predicted - truth;
    if (delta > 0) return `Puso ${predicted} (${URGENCY_LABEL[predicted]}) y era ${truth} (${URGENCY_LABEL[truth]}). Subió ${delta} nivel${delta > 1 ? "es" : ""}${hits(text, URGENCY_CUES[3]).length ? `, probablemente por ${quote(hits(text, URGENCY_CUES[3]), "palabras de prisa")}` : ""}.`;
    return `Puso ${predicted} (${URGENCY_LABEL[predicted]}) y era ${truth} (${URGENCY_LABEL[truth]}). Bajó ${Math.abs(delta)} nivel${Math.abs(delta) > 1 ? "es" : ""}. ${cues.length ? `El texto sí marca prisa con ${quote(cues, "")}.` : "La etiqueta editorial es más alta que el tono que leyó el modelo."}`;
  }
  const predicted = verdict.churn.predicted;
  const churnCues = hits(text, CHURN_CUES);
  if (verdict.churn.ok) {
    return verdict.ticket.churn
      ? `Marcó baja y el cliente amenaza con irse (${quote(churnCues, "una frase de cancelación o cambio de proveedor")}).`
      : "Marcó que se queda: no hay amenaza explícita de irse o cambiar de proveedor.";
  }
  if (predicted === null) return verdict.ticket.churn ? `Sin respuesta de baja. El cliente sí amenaza (${quote(churnCues, "cancelar o migrar")}).` : "Sin respuesta de baja. No había amenaza de irse.";
  if (predicted && !verdict.ticket.churn) return "Marcó baja sin amenaza explícita. Quejarse o pedir un cambio no es lo mismo que decir que se va.";
  return `No marcó baja y el cliente sí amenaza (${quote(churnCues, "cancelar, irse o migrar")}).`;
}

export function explainTicket(verdict: TicketVerdict) {
  const parts = [explainField("department", verdict), explainField("urgency", verdict), explainField("churn", verdict)];
  const misses = (["department", "urgency", "churn"] as const).filter(key => !verdict[key].ok);
  if (verdict.failed) return { fields: { department: parts[0], urgency: parts[1], churn: parts[2] }, overall: "Esta llamada no devolvió las tres etiquetas. En Bandeja un fallo de red cuenta como error en los tres campos." };
  if (!misses.length) return { fields: { department: parts[0], urgency: parts[1], churn: parts[2] }, overall: "Las tres etiquetas coinciden con la verdad editorial. Las palabras del ticket bastaban para departamento, urgencia y baja." };
  return { fields: { department: parts[0], urgency: parts[1], churn: parts[2] }, overall: `Falló ${misses.map(key => key === "department" ? "departamento" : key === "urgency" ? "urgencia" : "baja").join(", ")}.` };
}

export type PilotStats = {
  n: number;
  department: number;
  urgency: number;
  urgencyError: number;
  churn: number;
  ms: number;
  cost: number;
};

export function statsFromVerdicts(rows: TicketVerdict[]): PilotStats {
  return {
    n: rows.length,
    department: rows.length ? rows.filter(row => row.department.ok).length / rows.length : 0,
    urgency: rows.length ? rows.filter(row => row.urgency.ok).length / rows.length : 0,
    urgencyError: meanAbsoluteError(rows.map(row => ({ predicted: row.urgency.error, truth: 0 }))),
    churn: rows.length ? rows.filter(row => row.churn.ok).length / rows.length : 0,
    ms: rows.length ? rows.reduce((sum, row) => sum + row.ms, 0) / rows.length : 0,
    cost: rows.length ? rows.reduce((sum, row) => sum + row.cost, 0) / rows.length * 1000 : 0,
  };
}

export function departmentBaselines() {
  return {
    department: majorityBaseline(tickets.map(item => item.department)),
    urgency: majorityBaseline(tickets.map(item => item.urgency)),
    churn: majorityBaseline(tickets.map(item => item.churn)),
    departmentClass: majorityClass(tickets.map(item => item.department)),
    urgencyClass: majorityClass(tickets.map(item => item.urgency)),
    churnClass: majorityClass(tickets.map(item => item.churn)),
  };
}

function confusionPairs(rows: TicketVerdict[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.department.ok || !row.department.predicted) continue;
    const key = `${row.department.truth}|${row.department.predicted}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export type BandejaCase = {
  id: string;
  subject: string;
  field: "departamento" | "urgencia" | "baja";
  decided: string;
  truth: string;
  ok: boolean;
  why: string;
};

function fieldLabel(kind: "department" | "urgency" | "churn"): BandejaCase["field"] {
  return kind === "department" ? "departamento" : kind === "urgency" ? "urgencia" : "baja";
}

function stampOf(kind: "department" | "urgency" | "churn", value: string | number | boolean | null) {
  if (kind === "department") return value ? DEPT_LABEL[value as keyof typeof DEPT_LABEL] ?? String(value) : "sin depto.";
  if (kind === "urgency") return typeof value === "number" ? `Urg. ${value}` : "sin urgencia";
  if (value === null) return "sin baja";
  return value ? "Baja" : "Se queda";
}

function oneLine(text: string) {
  const sentence = text.split(/(?<=[.!?])\s/)[0] || text;
  return sentence.length > 132 ? `${sentence.slice(0, 129)}…` : sentence;
}

function interestingField(row: TicketVerdict): "department" | "urgency" | "churn" {
  const misses = (["department", "urgency", "churn"] as const).filter(key => !row[key].ok);
  if (misses.length) {
    if (misses.includes("department")) return "department";
    if (misses.includes("churn") && row.ticket.churn) return "churn";
    return misses[0];
  }
  if (row.ticket.churn) return "churn";
  if (row.ticket.urgency >= 2) return "urgency";
  return "department";
}

function toCase(row: TicketVerdict): BandejaCase {
  const field = interestingField(row);
  return {
    id: row.ticket.id,
    subject: subjectOf(row.ticket.text),
    field: fieldLabel(field),
    decided: stampOf(field, row[field].predicted),
    truth: stampOf(field, row[field].truth),
    ok: row[field].ok,
    why: oneLine(explainField(field, row)),
  };
}

function pickDiverse(rows: TicketVerdict[], score: (row: TicketVerdict) => number, limit: number) {
  const ranked = [...rows].sort((a, b) => score(b) - score(a));
  const picked: TicketVerdict[] = [];
  const seen = new Set<string>();
  for (const row of ranked) {
    const key = `${row.ticket.department}:${interestingField(row)}`;
    if (picked.length && seen.has(key)) continue;
    picked.push(row);
    seen.add(key);
    if (picked.length === limit) return picked;
  }
  for (const row of ranked) {
    if (picked.includes(row)) continue;
    picked.push(row);
    if (picked.length === limit) break;
  }
  return picked;
}

export function bandejaHeadline(name: string, rows: TicketVerdict[], stats: PilotStats) {
  if (!rows.length) return `${name} aún no tiene una pasada completa.`;
  const highUrgencyMiss = rows.filter(row => !row.urgency.ok && row.ticket.urgency >= 2).length;
  const fields = [
    { key: "departamento", acc: stats.department },
    { key: "urgencia", acc: stats.urgency },
    { key: "baja", acc: stats.churn },
  ];
  const best = fields.reduce((left, right) => left.acc >= right.acc ? left : right);
  const worst = fields.reduce((left, right) => left.acc <= right.acc ? left : right);
  if (best.key === "departamento" && best.acc >= 0.9 && worst.key === "urgencia") {
    return highUrgencyMiss
      ? `${name} acierta el departamento casi siempre; falla sobre todo en urgencia 2–3.`
      : `${name} acierta el departamento casi siempre; la urgencia es el punto flojo.`;
  }
  if (best.acc >= 0.85 && worst.acc < best.acc - 0.08) {
    if (worst.key === "urgencia" && highUrgencyMiss) return `${name} acierta ${best.key} casi siempre; falla sobre todo en urgencia 2–3.`;
    return `${name} acierta ${best.key} casi siempre; falla sobre todo en ${worst.key}.`;
  }
  return `${name}: ${pct(stats.department, true)} depto, ${pct(stats.urgency, true)} urgencia, ${pct(stats.churn, true)} baja.`;
}

export function bandejaCases(rows: TicketVerdict[], limit = 4) {
  const good = pickDiverse(
    rows.filter(row => !row.failed && row.department.ok && row.urgency.ok && row.churn.ok),
    row => (row.ticket.churn ? 2 : 0) + (row.ticket.urgency >= 2 ? 1 : 0),
    limit,
  );
  const bad = pickDiverse(
    rows.filter(row => row.failed || !row.department.ok || !row.urgency.ok || !row.churn.ok),
    row => (!row.department.ok ? 3 : 0) + (!row.urgency.ok && row.ticket.urgency >= 2 ? 2 : 0) + (!row.churn.ok && row.ticket.churn ? 2 : 0) + row.urgency.error,
    limit,
  );
  return { good: good.map(toCase), bad: bad.map(toCase) };
}

export function bandejaCompare(stats: PilotStats, majority: ReturnType<typeof departmentBaselines>, human: PilotStats | null) {
  return ([
    ["Depto.", stats.department, majority.department, human?.department ?? null],
    ["Urgencia", stats.urgency, majority.urgency, human?.urgency ?? null],
    ["Baja", stats.churn, majority.churn, human?.churn ?? null],
  ] as const).map(([label, value, majorityValue, humanValue]) => ({
    label,
    value,
    majority: majorityValue,
    human: human && human.n ? humanValue : null,
    vsMajority: value - majorityValue,
    vsHuman: human && human.n && humanValue !== null ? value - humanValue : null,
  }));
}

export function bandejaNarrative(name: string, rows: TicketVerdict[], stats: PilotStats, human: PilotStats | null, majority: ReturnType<typeof departmentBaselines>) {
  if (!rows.length) return "Todavía no hay una pasada completa para este piloto.";
  const deptHits = rows.filter(row => row.department.ok).length;
  const urgHits = rows.filter(row => row.urgency.ok).length;
  const churnHits = rows.filter(row => row.churn.ok).length;
  const mixed = rows.filter(row => {
    const truth = row.ticket.department;
    return (Object.keys(DEPT_CUES) as Ticket["department"][]).some(key => key !== truth && hits(row.ticket.text, DEPT_CUES[key]).length > 0);
  });
  const mixedMiss = mixed.filter(row => !row.department.ok);
  const pairs = confusionPairs(rows);
  const top = pairs[0];
  const failed = rows.filter(row => row.failed).length;
  const highUrgencyMiss = rows.filter(row => !row.urgency.ok && row.ticket.urgency >= 2).length;
  const churnMiss = rows.filter(row => !row.churn.ok && row.ticket.churn).length;
  const lines: string[] = [];
  lines.push(`${name} lleva ${stats.n} de 60 tickets. Departamento ${deptHits}/${stats.n} (${pct(stats.department, true)}), urgencia ${urgHits}/${stats.n} (${pct(stats.urgency, true)}, error medio ${stats.urgencyError.toFixed(2)}), baja ${churnHits}/${stats.n} (${pct(stats.churn, true)}).`);
  if (failed) lines.push(`${failed} llamada${failed === 1 ? "" : "s"} no respondió${failed === 1 ? "" : "n"}; esas filas cuentan como error.`);
  const well = [
    stats.department >= stats.urgency && stats.department >= stats.churn ? "departamento" : null,
    stats.churn >= stats.department && stats.churn >= stats.urgency ? "baja" : null,
    stats.urgency >= stats.department && stats.urgency >= stats.churn ? "urgencia" : null,
  ].filter(Boolean);
  lines.push(`Lo más sólido es ${well[0]}. Los tickets con amenaza explícita ("will cancel", "we will leave", "migrate") y los de cuenta bloqueada o sin 2FA suelen salir bien porque el texto lo dice sin rodeos.`);
  if (top) {
    const [truth, predicted] = top[0].split("|") as [Ticket["department"], Ticket["department"]];
    lines.push(`Patrón de error: ${top[1]} vez${top[1] === 1 ? "" : "es"} ${DEPT_LABEL[truth]} se etiquetó como ${DEPT_LABEL[predicted]}. ${mixedMiss.length ? `${mixedMiss.length} de esos fallos mezclan vocabulario de dos departamentos (cobro + fallo de página, o SSO + facturación).` : "No hay mucha mezcla de vocabulario: el modelo cambió de cajón sin una pista cruzada fuerte."}`);
  } else {
    lines.push("En departamento no hay un patrón de confusión dominante: los fallos, si los hay, están sueltos.");
  }
  if (highUrgencyMiss) lines.push(`La urgencia se tuerce sobre todo en tickets 2 y 3 (${highUrgencyMiss} fallos). Palabras como "today" o "now" a veces suben un informativo, y a veces el modelo no ve el bloqueo operativo.`);
  if (churnMiss) lines.push(`Se le escaparon ${churnMiss} amenazas de baja. Casi siempre el "we will leave" va al final, detrás del problema técnico o de cobro.`);
  const majDept = majority.departmentClass.value as Ticket["department"];
  lines.push(`La clase mayoritaria acierta depto. ${pct(majority.department, true)} (${DEPT_LABEL[majDept] || majority.departmentClass.value}), urgencia ${pct(majority.urgency, true)} (nivel ${majority.urgencyClass.value}) y baja ${pct(majority.churn, true)}. ${name} está ${stats.department > majority.department ? "por encima" : stats.department === majority.department ? "empatado" : "por debajo"} de esa línea en departamento: ${stats.department > majority.department + 0.05 ? "está leyendo el texto, no el sesgo de la bandeja." : "parte del acierto podría ser el sesgo del dataset, que está muy equilibrado por departamento."}`);
  if (name === "La persona") {
    lines.push("Esta pasada mide tres pulsaciones por ticket, no una llamada con tres preguntas. El coste humano no se estima.");
  } else if (human && human.n) {
    const lead = stats.department === human.department ? "empata a la persona en departamento" : stats.department > human.department ? `gana a la persona en departamento (${pct(stats.department, true)} frente a ${pct(human.department, true)})` : `va por detrás de la persona en departamento (${pct(stats.department, true)} frente a ${pct(human.department, true)})`;
    lines.push(`Frente a la persona (${human.n} tickets): ${lead}. El reloj humano mide tres pulsaciones; el del modelo, una sola llamada. El coste humano no se estima. ${name === "Laya" ? "Laya corre en local y no tiene coste de tokens." : `${name} sale a coste por 1.000 tickets, solo por los tokens de entrada.`}`);
  } else {
    lines.push("Todavía no hay una pasada humana completa para comparar pulso a pulso. El teclado está en la carpeta Persona (1/2/3, 0-3, S/N).");
  }
  return lines.join(" ");
}
