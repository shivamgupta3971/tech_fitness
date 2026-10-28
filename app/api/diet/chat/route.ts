import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, hasLlmProvider } from "../../../lib/llm";

type ChatRole = "system" | "user" | "assistant";

export async function POST(req: NextRequest) {
  try {
    const { message, profile, currentPlan, history } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Missing message query" }, { status: 400 });
    }

    if (!hasLlmProvider()) {
      return NextResponse.json({
        reply:
          "AI Nutrition Assistant is currently offline. Please set OPENAI_API_KEY, GROQ_API_KEY, or SARVAM_API_KEY in your environment to chat.",
      });
    }

    const allergiesStr =
      profile?.allergies && profile.allergies.length > 0
        ? profile.allergies.join(", ")
        : "None declared";

    const systemPrompt = `You are FitVeda's AI Nutrition Assistant, a friendly, evidence-based sports dietitian specializing in Indian and global diets.

USER CONTEXT (Injected strictly by server):
- Diet Type: ${profile?.dietType || "General"}
- ALLERGIES & RESTRICTIONS: ${allergiesStr}
- Daily Target: ${profile?.targetCalories ? `${profile.targetCalories} kcal` : "Balanced"}
- Budget: ${profile?.budget || "Moderate"}
- Active Plan Summary: ${currentPlan ? JSON.stringify(currentPlan).substring(0, 500) : "Plan active"}

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
      for (const h of history.slice(-8)) {
        if (h.role && h.content) {
          messages.push({
            role: h.role === "user" ? "user" : "assistant",
            content: String(h.content),
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
