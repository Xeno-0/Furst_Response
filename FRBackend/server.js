require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

let feedbacks = [];
let savedAdvice = [];

const projectRoot = path.resolve(__dirname, "..");

function readNonEmptyEnv(...names) {
  for (const name of names) {
    const value = typeof process.env[name] === "string" ? process.env[name].trim() : "";
    if (value) {
      return value;
    }
  }

  return "";
}

function inferProvider() {
  const explicitProvider = readNonEmptyEnv("AI_PROVIDER", "LLM_PROVIDER").toLowerCase();
  if (explicitProvider) {
    return explicitProvider;
  }

  const groqKey = readNonEmptyEnv("GROQ_API_KEY");
  const groqModel = readNonEmptyEnv("GROQ_MODEL");
  const fallbackKey = readNonEmptyEnv("GEMINI_API_KEY", "AI_API_KEY");
  const fallbackModel = readNonEmptyEnv("GEMINI_MODEL", "AI_MODEL");

  if (
    groqKey ||
    groqModel ||
    /^gsk_/i.test(fallbackKey) ||
    /llama|mixtral|deepseek|qwen/i.test(fallbackModel)
  ) {
    return "groq";
  }

  return "gemini";
}

function getAiConfig() {
  const provider = inferProvider();

  if (provider === "groq") {
    return {
      provider,
      apiKey: readNonEmptyEnv("GROQ_API_KEY", "AI_API_KEY", "GEMINI_API_KEY"),
      model: readNonEmptyEnv("GROQ_MODEL", "AI_MODEL", "GEMINI_MODEL") || "llama-3.3-70b-versatile",
    };
  }

  return {
    provider: "gemini",
    apiKey: readNonEmptyEnv("GEMINI_API_KEY", "AI_API_KEY"),
    model: readNonEmptyEnv("GEMINI_MODEL", "AI_MODEL") || "gemini-2.5-flash",
  };
}

function hasConfiguredApiKey() {
  const { apiKey } = getAiConfig();
  return Boolean(apiKey) && !/^paste[-_\s]?/i.test(apiKey);
}

function corsOptionsDelegate(req, callback) {
  if (!ALLOWED_ORIGINS.length) {
    callback(null, { origin: true });
    return;
  }

  const requestOrigin = req.header("Origin");
  if (!requestOrigin || ALLOWED_ORIGINS.includes(requestOrigin)) {
    callback(null, { origin: true });
    return;
  }

  callback(null, { origin: false });
}

function expertAdvicePayload() {
  return {
    all: [
      "Regular exercise is crucial for your dog's physical and mental health - aim for at least 30 minutes daily",
      "Mental stimulation through puzzle toys can prevent boredom and destructive behaviors",
      "Consistent training using positive reinforcement builds trust and good behavior",
      "Quality sleep is as important for dogs as it is for humans - ensure a comfortable sleeping area",
      "Regular veterinary check-ups can catch potential health issues early",
    ],
    physical: [
      "Brush your dog's teeth regularly to prevent dental disease",
      "Keep nails trimmed to avoid discomfort and mobility issues",
      "Regular grooming prevents matting and helps spot skin problems early",
      "Monitor your dog's weight - obesity leads to many health problems",
      "Provide fresh water at all times to maintain proper hydration",
    ],
    mental: [
      "Rotate toys weekly to keep your dog mentally engaged",
      "Teach new tricks to stimulate your dog's brain",
      "Provide safe chewing outlets to relieve stress and anxiety",
      "Maintain consistent routines to reduce canine anxiety",
      "Socialization with other dogs should be ongoing throughout their life",
    ],
    training: [
      "Use treats and praise immediately to reinforce good behavior",
      "Keep training sessions short (5-15 minutes) for best results",
      "Never punish after the fact - dogs live in the moment",
      "Teach 'leave it' and 'drop it' for safety and control",
      "Practice commands in different locations for better generalization",
    ],
    nutrition: [
      "Choose high-quality protein as the first ingredient in dog food",
      "Avoid foods toxic to dogs: chocolate, grapes, onions, and xylitol",
      "Measure meals to prevent overfeeding",
      "Introduce new foods gradually to avoid digestive upset",
      "Consult your vet before making significant diet changes",
    ],
  };
}

async function requestGroqChat(prompt, config) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  return { response, data };
}

async function requestGeminiChat(prompt, config) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = await response.json();
  return { response, data };
}

app.use(cors(corsOptionsDelegate));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(projectRoot));

app.get("/api/health", (req, res) => {
  const config = getAiConfig();
  res.json({
    ok: true,
    provider: config.provider,
    model: config.model,
    aiConfigured: hasConfiguredApiKey(),
  });
});

app.post("/api/chat", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const config = getAiConfig();

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  if (!hasConfiguredApiKey()) {
    return res.status(500).json({
      error: "AI API key is missing on the server.",
      details: `Set the ${config.provider === "groq" ? "GROQ_API_KEY" : "GEMINI_API_KEY"} environment variable on the backend.`,
      provider: config.provider,
    });
  }

  try {
    const { response, data } = config.provider === "groq"
      ? await requestGroqChat(prompt, config)
      : await requestGeminiChat(prompt, config);

    if (!response.ok) {
      console.error(`${config.provider.toUpperCase()} API Error:`, JSON.stringify(data, null, 2));
      return res.status(response.status).json({
        error: `${config.provider} API failed`,
        details: data?.error || data,
        provider: config.provider,
      });
    }

    return res.json({
      ...data,
      provider: config.provider,
      model: config.model,
    });
  } catch (error) {
    console.error("Proxy Error:", error);
    return res.status(500).json({
      error: "Internal server error during chat.",
      provider: config.provider,
    });
  }
});

app.get("/api/advice", (req, res) => {
  res.json(expertAdvicePayload());
});

app.post("/api/feedback", (req, res) => {
  const feedback = {
    id: Date.now(),
    ...req.body,
    timestamp: new Date().toISOString(),
  };
  feedbacks.push(feedback);
  res.json({ message: "Feedback saved successfully!", feedback });
});

app.get("/api/feedback", (req, res) => {
  res.json(feedbacks);
});

app.post("/api/advice/save", (req, res) => {
  const advice = typeof req.body?.advice === "string" ? req.body.advice.trim() : "";

  if (!advice) {
    return res.status(400).json({ error: "Advice text is required." });
  }

  if (!savedAdvice.includes(advice)) {
    savedAdvice.push(advice);
  }

  return res.json({ message: "Advice saved!", savedAdvice });
});

app.get("/api/advice/saved", (req, res) => {
  res.json(savedAdvice);
});

app.delete("/api/advice/saved", (req, res) => {
  const advice = typeof req.body?.advice === "string" ? req.body.advice.trim() : "";
  savedAdvice = savedAdvice.filter((item) => item !== advice);
  res.json({ message: "Advice deleted!", savedAdvice });
});

app.use((req, res) => {
  res.sendFile(path.join(projectRoot, "index.html"));
});

app.listen(PORT, () => {
  const config = getAiConfig();
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Serving files from: ${projectRoot}`);
  console.log(`AI provider: ${config.provider}`);
  console.log(`AI model: ${config.model}`);
});
