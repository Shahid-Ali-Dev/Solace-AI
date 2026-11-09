// backend/src/utils/aiClient.js
import groq from "../config/groq.js";

export const PRIMARY_CHAT_MODEL =
  process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";
export const FAST_MODEL =
  process.env.GROQ_FAST_MODEL || "openai/gpt-oss-20b";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generateCompletion({
  messages,
  model = PRIMARY_CHAT_MODEL,
  fallbackModel = FAST_MODEL,
  temperature = 0.75,
  maxCompletionTokens = 650,
  reasoningEffort = "low",
  jsonMode = false,
}) {
  const buildParams = (targetModel) => {
    const params = {
      model: targetModel,
      messages,
      temperature,
      max_completion_tokens: maxCompletionTokens,
    };

    if (targetModel.startsWith("openai/gpt-oss")) {
      params.reasoning_effort = reasoningEffort;
      params.include_reasoning = false;
    }

    if (jsonMode) {
      params.response_format = { type: "json_object" };
    }

    return params;
  };

  try {
    const completion = await groq.chat.completions.create(buildParams(model));
    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error(`Empty completion content from ${model}`);
    }
    return content;
  } catch (primaryError) {
    const status = primaryError?.status || primaryError?.error?.status;
    console.error(
      `Groq primary model (${model}) failed:`,
      primaryError?.error || primaryError?.message || primaryError
    );

    if (!fallbackModel || fallbackModel === model) {
      throw primaryError;
    }

    if (status === 429) {
      await wait(350);
    }

    const fallbackCompletion = await groq.chat.completions.create(
      buildParams(fallbackModel)
    );
    const fallbackContent =
      fallbackCompletion.choices?.[0]?.message?.content?.trim();
    if (!fallbackContent) {
      throw new Error(`Empty completion content from fallback ${fallbackModel}`);
    }
    return fallbackContent;
  }
}