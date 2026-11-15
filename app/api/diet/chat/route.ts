import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, hasLlmProvider } from "../../../lib/llm";

type ChatRole = "system" | "user" | "assistant";

const MAX_MESSAGE_CHARS = 500;
const MAX_HISTORY = 8;

/** One-line-per-meal summary of the day the user is looking at (the old code sent a JSON dump cut off at 500 chars). */
function summarizeDay(plan: unknown): string {
  if (typeof plan !== "object" || plan === null) return "No day selected";
  const day = plan as { date?: unknown; meals?: unknown; totalNutrition?: { calories?: unknown } };
  if (!Array.isArray(day.meals)) return "No day selected";

  const meals = day.meals
    .slice(0, 8)
    .map((m: { type?: unknown; name?: unknown; nutrition?: { calories?: unknown } }) => {
      const kcal = typeof m?.nutrition?.calories === "number" ? ` (${m.nutrition.calories} kcal)` : "";
      return `${String(m?.type ?? "meal")}: ${String(m?.name ?? "?").slice(0, 80)}${kcal}`;
    })
    .join("; ");
  const total = typeof day.totalNutrition?.calories === "number" ? ` — day total ${day.totalNutrition.calories} kcal` : "";
  return `${typeof day.date === "string" ? day.date : "today"}: ${meals}${total}`;
}

export async function POST(req: NextRequest) {
  try {
    const { message, profile, currentPlan, history } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Missing message query" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: `Message too long (max ${MAX_MESSAGE_CHARS} characters)` }, { status: 400 });
    }

    if (!hasLlmProvider()) {
      return NextResponse.json({
        reply:
          "AI Nutrition Assistant is currently offline. Please set OPENAI_API_KEY, GROQ_API_KEY, or SARVAM_API_KEY in your environment to chat.",
      });
    }

    const allergiesStr =
      Array.isArray(profile?.allergies) && profile.allergies.length > 0
        ? profile.allergies.map((a: unknown) => String(a).slice(0, 40)).join(", ")
        : "None declared";

    const systemPrompt = `You are FitVeda's AI Nutrition Assistant, a friendly, evidence-based sports dietitian specializing in Indian and global diets.

USER CONTEXT (Injected strictly by server):
- Diet Type: ${profile?.dietType || "General"}
- ALLERGIES & RESTRICTIONS: ${allergiesStr}
- Daily Target: ${profile?.targetCalories ? `${profile.targetCalories} kcal` : "Balanced"}
- Budget: ${profile?.budget || "Moderate"}
- Day being viewed: ${summarizeDay(currentPlan)}

CRITICAL SAFETY & ETHICAL RULES:
1. NEVER recommend any food containing the user's declared allergies (${allergiesStr}).
2. NEVER prescribe prescription drugs, steroids, or unverified aggressive supplements. Stick to whole foods (dal, paneer, eggs, tofu, nuts, fruits, curd).
3. NEVER encourage extreme calorie deficits (<1200 kcal for women, <1500 kcal for men), starvation fasts, or purging behaviors.
4. If the user asks for diagnosis or treatment of a medical condition (diabetes, kidney disease, eating disorders, pregnancy complications), state clearly: "Please consult with your physician or registered clinical dietitian for personalized medical advice."
5. Keep your tone encouraging, culturally relatable, practical, and clear.`;

    const messages: { role: ChatRole; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (Array.isArray(history)) {
      for (const h of history.slice(-MAX_HISTORY)) {
        if (h?.role && h?.content) {
          messages.push({
            role: h.role === "user" ? "user" : "assistant",
            content: String(h.content).slice(0, 1000),
          });
        }
      }
    }

    messages.push({ role: "user", content: message });

    const reply = await chatCompletion({
      messages,
      maxTokens: 600,
      temperature: 0.7,
    });

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[api/diet/chat] Error:", err);
    return NextResponse.json(
      { reply: "I'm having trouble analyzing that right now. Please try again in a moment." },
      { status: 200 }
    );
  }
}
