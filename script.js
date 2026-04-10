let currentLanguage = localStorage.getItem("frLanguage") || "en";
const DEFAULT_RUNTIME_CONFIG = Object.freeze({
  backendBaseUrl: "",
  requestTimeoutMs: 30000,
});
const STORAGE_KEYS = {
  language: "frLanguage",
  passportStore: "furstResponsePassportStore",
  latestDiagnosis: "furstResponseLatestDiagnosis",
  emergencyCases: "furstResponseEmergencyCases",
  latestEmergencyCaseId: "furstResponseLatestEmergencyCaseId",
  handoffHistory: "furstResponseHandoffHistory",
  latestSummaryId: "furstResponseLatestSummaryId",
};
const MAX_SUMMARY_HISTORY = 8;
const MAX_EMERGENCY_HISTORY = 6;
const CLINICS = [
  { name: "Paws & Claws Veterinary Clinic", lat: 28.6304, lng: 77.2177, phone: "+911123456789", address: "23, Connaught Place, New Delhi 110001" },
  { name: "DCC Animal Hospital", lat: 28.5672, lng: 77.21, phone: "+911126851500", address: "A-8, Defence Colony, New Delhi 110024" },
  { name: "Friendicoes SECA", lat: 28.5827, lng: 77.231, phone: "+911124315133", address: "271, Jangpura B, Mathura Road, New Delhi 110014" },
  { name: "Max Vets Dwarka", lat: 28.5921, lng: 77.046, phone: "+911145004500", address: "Sector 7, Dwarka, New Delhi 110075" },
  { name: "SOS Animal Clinic - Rohini", lat: 28.7325, lng: 77.117, phone: "+911127055675", address: "C-5/44, Sector 5, Rohini, New Delhi 110085" },
  { name: "Najafgarh Veterinary Hospital", lat: 28.6092, lng: 76.9798, phone: "+911125012345", address: "Main Najafgarh Road, Najafgarh, New Delhi 110043" },
  { name: "Narela Government Veterinary Clinic", lat: 28.8527, lng: 77.0929, phone: "+911127782200", address: "Near Narela Mandi, Narela, Delhi 110040" },
  { name: "Alipur Pet Care Centre", lat: 28.795, lng: 77.1342, phone: "+911127201189", address: "GT Karnal Road, Alipur, Delhi 110036" },
  { name: "Mehrauli Animal Welfare Clinic", lat: 28.5244, lng: 77.1855, phone: "+911126642900", address: "Near Qutub Minar, Mehrauli, New Delhi 110030" },
  { name: "Bawana Rural Veterinary Centre", lat: 28.7762, lng: 77.034, phone: "+911127862345", address: "Main Market Road, Bawana, Delhi 110039" },
  { name: "Mumbai Pet Care Hospital", lat: 19.076, lng: 72.8777, phone: "+912234567890", address: "15, Bandra West, Mumbai, Maharashtra 400050" },
  { name: "Bangalore Canine Wellness Centre", lat: 12.9716, lng: 77.5946, phone: "+918045678901", address: "42, Koramangala 4th Block, Bengaluru, Karnataka 560034" },
  { name: "Chennai Veterinary Hospital", lat: 13.0827, lng: 80.2707, phone: "+914456789012", address: "8, Anna Nagar, Chennai, Tamil Nadu 600040" },
  { name: "Jaipur Animal Care Clinic", lat: 26.9124, lng: 75.7873, phone: "+911417890123", address: "56, C-Scheme, Jaipur, Rajasthan 302001" },
];

function safeJSONParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error("Failed to parse stored JSON:", error);
    return fallback;
  }
}

function isQuotaExceededError(error) {
  if (!error) return false;
  if (error instanceof DOMException) {
    return (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22 ||
      error.code === 1014
    );
  }

  return /quota/i.test(error.message || "");
}

function clearStorageForQuota(key) {
  const keysToFree = [
    STORAGE_KEYS.handoffHistory,
    STORAGE_KEYS.emergencyCases,
    STORAGE_KEYS.latestDiagnosis,
    STORAGE_KEYS.passportStore,
  ].filter((storageKey) => storageKey !== key);

  keysToFree.forEach((storageKey) => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn("Could not remove localStorage key during quota recovery:", storageKey, error);
    }
  });
}

function setStoredJSON(key, value) {
  const payload = JSON.stringify(value);

  try {
    localStorage.setItem(key, payload);
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      throw error;
    }

    console.warn("LocalStorage quota exceeded for key:", key, error);
    clearStorageForQuota(key);

    try {
      localStorage.setItem(key, payload);
    } catch (retryError) {
      console.warn("Retry after clearing storage failed for key:", key, retryError);
      try {
        localStorage.removeItem(key);
      } catch (cleanupError) {
        console.warn("Failed to cleanup localStorage key after quota failure:", key, cleanupError);
      }
    }
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      throw error;
    }

    console.warn("LocalStorage quota exceeded for key:", key, error);
    clearStorageForQuota(key);

    try {
      localStorage.setItem(key, value);
    } catch (retryError) {
      console.warn("Retry after clearing storage failed for key:", key, retryError);
    }
  }
}

function getTimestamp() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase();
}

function decodeMojibakeText(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }

  const mojibakePattern = /(?:\u00C3.|\u00C2.|\u00E2.|\u00E0\u00A4|\u00E0\u00A5|\u00E0\u00A6|\u00E0\u00A7|\u00E0\u00A8|\u00E0\u00A9)/;
  const windows1252Extras = {
    0x20AC: 0x80,
    0x201A: 0x82,
    0x0192: 0x83,
    0x201E: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02C6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8A,
    0x2039: 0x8B,
    0x0152: 0x8C,
    0x017D: 0x8E,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201C: 0x93,
    0x201D: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02DC: 0x98,
    0x2122: 0x99,
    0x0161: 0x9A,
    0x203A: 0x9B,
    0x0153: 0x9C,
    0x017E: 0x9E,
    0x0178: 0x9F,
  };
  const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
  let decodedValue = value;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!mojibakePattern.test(decodedValue)) {
      break;
    }

    const bytes = [];
    let canDecode = true;

    for (const character of decodedValue) {
      const codePoint = character.charCodeAt(0);
      if (codePoint <= 0xFF) {
        bytes.push(codePoint);
        continue;
      }

      if (windows1252Extras[codePoint] !== undefined) {
        bytes.push(windows1252Extras[codePoint]);
        continue;
      }

      canDecode = false;
      break;
    }

    if (!canDecode) {
      break;
    }

    try {
      const nextValue = utf8Decoder.decode(new Uint8Array(bytes));
      if (nextValue === decodedValue) {
        break;
      }
      decodedValue = nextValue;
    } catch (error) {
      break;
    }
  }

  return decodedValue;
}

function localizedText(enText, hiText) {
  return currentLanguage === "hi"
    ? decodeMojibakeText(hiText)
    : decodeMojibakeText(enText);
}

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, "");
}

function getRuntimeConfig() {
  const rawConfig = window.FurstResponseConfig || {};
  return {
    backendBaseUrl: typeof rawConfig.backendBaseUrl === "string" ? trimTrailingSlashes(rawConfig.backendBaseUrl.trim()) : DEFAULT_RUNTIME_CONFIG.backendBaseUrl,
    requestTimeoutMs: Number.isFinite(Number(rawConfig.requestTimeoutMs)) && Number(rawConfig.requestTimeoutMs) > 0
      ? Number(rawConfig.requestTimeoutMs)
      : DEFAULT_RUNTIME_CONFIG.requestTimeoutMs,
  };
}

function supportsLocalProxy() {
  return /^https?:$/i.test(window.location.protocol);
}

function resolveApiUrl(pathname) {
  const { backendBaseUrl } = getRuntimeConfig();
  const normalizedPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;

  if (backendBaseUrl) {
    return new URL(normalizedPath, `${backendBaseUrl}/`).toString();
  }

  return supportsLocalProxy() ? `/${normalizedPath}` : null;
}

async function fetchWithTimeout(resource, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), getRuntimeConfig().requestTimeoutMs);

  try {
    return await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
}

function extractGeminiText(payload) {
  return payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim() || "";
}

function getApiFailureMessage(error) {
  if (error?.message === "MISSING_BACKEND_CONFIGURATION") {
    return currentLanguage === "hi"
      ? "AI setup अभी पूरा नहीं हुआ है। FRBackend/.env में Gemini key रखें और जरूरत हो तो site-config.js में backend URL सेट करें।"
      : "AI setup is incomplete. Keep the Gemini key in FRBackend/.env and set a backend URL in site-config.js if needed.";
  }

  return currentLanguage === "hi"
    ? "माफ़ कीजिए, मैं अभी आपका अनुरोध पूरा नहीं कर सका। कृपया थोड़ी देर बाद फिर कोशिश करें।"
    : "Sorry, I couldn't process your request. Please try again later.";
}

async function requestGeminiViaProxy(prompt, apiUrl) {
  const response = await fetchWithTimeout(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });
  const data = await readJsonSafely(response);

  if (!response.ok) {
    console.error("Backend Chat Error:", data);
    throw new Error(data?.details?.message || data?.error || "Proxy request failed");
  }

  return extractGeminiText(data);
}

async function callGeminiAPI(prompt) {
  const apiUrl = resolveApiUrl("/api/chat");

  try {
    if (!apiUrl) {
      throw new Error("MISSING_BACKEND_CONFIGURATION");
    }

    return await requestGeminiViaProxy(prompt, apiUrl);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return getApiFailureMessage(error);
  }
}

async function getBotResponse(userMessage) {
  const prompt = createDiagnosisPrompt(userMessage);

  const geminiResponse = await callGeminiAPI(prompt);
  return parseGeminiResponse(geminiResponse);
}

function parseGeminiResponse(response) {
  const match = response.match(/severity\s*:\s*(low|medium|high)/i);
  const severity = match ? match[1].toLowerCase() : "low";

  const cleanedResponse = response
    .replace(/\[?\s*severity\s*:\s*(low|medium|high)\s*\]?/gi, "")
    .trim();

  return {
    response: cleanedResponse,
    severity,
  };
}

function applyTranslations(root = document) {
  root.querySelectorAll("[data-en], [data-hi]").forEach((element) => {
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      const placeholderKey = `data-${currentLanguage}-placeholder`;
      if (element.hasAttribute(placeholderKey)) {
        const placeholderValue = element.getAttribute(placeholderKey);
        element.placeholder = decodeMojibakeText(placeholderValue);
      }
      return;
    }

    if (element.hasAttribute(`data-${currentLanguage}`)) {
      const translatedValue = element.getAttribute(`data-${currentLanguage}`);
      element.textContent = decodeMojibakeText(translatedValue);
    }
  });

  document.documentElement.lang = currentLanguage === "hi" ? "hi" : "en";
}

function createDiagnosisPrompt(userMessage) {
  const passportContext = buildPassportPromptBlock(getActivePassport());

  return `You are a helpful and professional veterinary medical support assistant.
${passportContext ? `Use the Dog Health Passport below only when relevant, and do not invent details.\n${passportContext}\n` : ""}
A user describes their dog's symptoms: "${userMessage}".
Provide:
1. A concise likely concern.
2. A clear recommended next action.
3. A severity level of low, medium, or high.

Rules:
- Respond in ${currentLanguage === "hi" ? "Hindi" : "English"}.
- Keep the answer within 30-40 words.
- Do not use bold formatting.
- Mention emergency care immediately if the case seems urgent.
- End exactly with [Severity: low], [Severity: medium], or [Severity: high].`;
}

function getPassportStore() {
  return safeJSONParse(localStorage.getItem(STORAGE_KEYS.passportStore), {
    version: 1,
    activeDogId: null,
    dogs: [],
  });
}

function savePassportStore(store) {
  setStoredJSON(STORAGE_KEYS.passportStore, store);
}

function normalizePassportData(profile = {}) {
  return {
    id: profile.id || createId("dog"),
    createdAt: profile.createdAt || getTimestamp(),
    updatedAt: getTimestamp(),
    dogName: (profile.dogName || "").trim(),
    breed: (profile.breed || "").trim(),
    age: profile.age === "" || profile.age === null || profile.age === undefined ? "" : Number(profile.age),
    sex: (profile.sex || "").trim(),
    weight: profile.weight === "" || profile.weight === null || profile.weight === undefined ? "" : Number(profile.weight),
    neuteredStatus: (profile.neuteredStatus || "").trim(),
    allergies: (profile.allergies || "").trim(),
    medications: (profile.medications || "").trim(),
    chronicConditions: (profile.chronicConditions || "").trim(),
    vaccinationStatus: (profile.vaccinationStatus || "").trim(),
    feedingNotes: (profile.feedingNotes || "").trim(),
    behavioralNotes: (profile.behavioralNotes || "").trim(),
    emergencyContact: (profile.emergencyContact || "").trim(),
    preferredClinic: (profile.preferredClinic || "").trim(),
    photoUrl: (profile.photoUrl || "").trim(),
  };
}

function getActivePassport() {
  const store = getPassportStore();
  return store.dogs.find((dog) => dog.id === store.activeDogId) || null;
}

function savePassportProfile(profile) {
  const store = getPassportStore();
  const normalized = normalizePassportData(profile);
  const existingIndex = store.dogs.findIndex((dog) => dog.id === normalized.id);

  if (existingIndex >= 0) {
    normalized.createdAt = store.dogs[existingIndex].createdAt;
    store.dogs[existingIndex] = normalized;
  } else {
    store.dogs.unshift(normalized);
  }

  store.activeDogId = normalized.id;
  savePassportStore(store);
  return normalized;
}

function clearPassportProfile() {
  savePassportStore({
    version: 1,
    activeDogId: null,
    dogs: [],
  });
}

function getPassportSummaryFacts(passport) {
  if (!passport) return [];

  return [
    passport.breed,
    passport.age !== "" ? `${passport.age} yr` : "",
    passport.sex,
    passport.weight !== "" ? `${passport.weight} kg` : "",
    passport.neuteredStatus,
  ].filter(Boolean);
}

function buildPassportPromptBlock(passport) {
  if (!passport) return "";

  return `
Dog Health Passport:
- Name: ${passport.dogName || "Not provided"}
- Breed: ${passport.breed || "Not provided"}
- Age (years): ${passport.age !== "" ? passport.age : "Not provided"}
- Sex: ${passport.sex || "Not provided"}
- Weight (kg): ${passport.weight !== "" ? passport.weight : "Not provided"}
- Neutered or spayed status: ${passport.neuteredStatus || "Not provided"}
- Allergies: ${passport.allergies || "None noted"}
- Current medications: ${passport.medications || "None noted"}
- Chronic conditions: ${passport.chronicConditions || "None noted"}
- Vaccination status: ${passport.vaccinationStatus || "Not provided"}
- Feeding notes: ${passport.feedingNotes || "None noted"}
- Behavioural notes: ${passport.behavioralNotes || "None noted"}
- Preferred clinic: ${passport.preferredClinic || "Not provided"}
- Emergency contact: ${passport.emergencyContact || "Not provided"}`.trim();
}

function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371;
  const degreesToRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = degreesToRadians(lat2 - lat1);
  const deltaLng = degreesToRadians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sortClinics(clinics, preferredClinic = "", coordinates = null) {
  const preferredText = normalizeText(preferredClinic);
  const enriched = clinics.map((clinic) => {
    const preferredMatch =
      preferredText &&
      (normalizeText(clinic.name).includes(preferredText) ||
        normalizeText(clinic.address).includes(preferredText))
        ? 1
        : 0;

    const distanceKm = coordinates
      ? calculateDistanceKm(coordinates.lat, coordinates.lng, clinic.lat, clinic.lng)
      : null;

    return {
      ...clinic,
      preferredMatch,
      distanceKm,
    };
  });

  return enriched.sort((left, right) => {
    if (right.preferredMatch !== left.preferredMatch) {
      return right.preferredMatch - left.preferredMatch;
    }

    if (left.distanceKm !== null && right.distanceKm !== null) {
      return left.distanceKm - right.distanceKm;
    }

    return left.name.localeCompare(right.name);
  });
}

function getRelevantClinics(preferredClinic = "", limit = 3, coordinates = null) {
  return sortClinics([...CLINICS], preferredClinic, coordinates).slice(0, limit);
}

function getCurrentPosition(options = { enableHighAccuracy: true, timeout: 5000 }) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => resolve(null),
      options
    );
  });
}

function extractPossibleConcern(text) {
  if (!text) return "";

  const firstSentence = text.split(/(?<=[.!?])\s+/)[0];
  return firstSentence || text;
}

function inferRecommendedAction(text, severity) {
  const lowered = normalizeText(text);

  if (lowered.includes("immediately") || severity === "high") {
    return "Immediate in-person veterinary care is recommended.";
  }

  if (lowered.includes("soon") || severity === "medium") {
    return "Arrange a vet visit soon and monitor closely meanwhile.";
  }

  return "Monitor at home, keep notes, and contact a vet if symptoms worsen.";
}

function buildSummaryObject({ symptomText, diagnosisResponse, severity, timestamp, passportSnapshot }) {
  const passport = passportSnapshot || getActivePassport();
  return {
    id: createId("summary"),
    createdAt: timestamp || getTimestamp(),
    symptomText,
    diagnosisResponse,
    severity,
    possibleConcern: extractPossibleConcern(diagnosisResponse),
    recommendedAction: inferRecommendedAction(diagnosisResponse, severity),
    dogProfile: passport ? { ...passport } : null,
    dogIdentity: passport
      ? {
          dogName: passport.dogName,
          breed: passport.breed,
          age: passport.age,
          sex: passport.sex,
          weight: passport.weight,
        }
      : null,
    ownerContext: passport
      ? {
          emergencyContact: passport.emergencyContact,
          preferredClinic: passport.preferredClinic,
        }
      : null,
    observedDuration: "",
    immediateActionsTaken: "",
    allergiesMedications: passport
      ? `${passport.allergies || "No allergies noted"} | ${passport.medications || "No medications listed"}`
      : "",
    vaccinationContext: passport?.vaccinationStatus || "",
    clinicOptions: getRelevantClinics(passport?.preferredClinic, 3),
    aiSections: null,
    source: "diagnosis",
  };
}

function getSummaryHistory() {
  return safeJSONParse(localStorage.getItem(STORAGE_KEYS.handoffHistory), []);
}

function saveSummary(summary, options = { setActive: true }) {
  const existing = getSummaryHistory().filter((item) => item.id !== summary.id);
  existing.unshift(summary);
  setStoredJSON(STORAGE_KEYS.handoffHistory, existing.slice(0, MAX_SUMMARY_HISTORY));

  if (options.setActive !== false) {
    safeSetItem(STORAGE_KEYS.latestSummaryId, summary.id);
  }

  return summary;
}

function getSummaryById(summaryId) {
  return getSummaryHistory().find((summary) => summary.id === summaryId) || null;
}

function getLatestSummary() {
  const latestId = localStorage.getItem(STORAGE_KEYS.latestSummaryId);
  return latestId ? getSummaryById(latestId) : getSummaryHistory()[0] || null;
}

function buildEmergencyCase({ symptomText, diagnosisResponse, severity, timestamp, passportSnapshot, summaryId }) {
  const passport = passportSnapshot || getActivePassport();
  return {
    id: createId("emergency"),
    createdAt: timestamp || getTimestamp(),
    symptomText,
    diagnosisResponse,
    severity,
    summaryId: summaryId || null,
    dogProfile: passport ? { ...passport } : null,
    guidance: null,
  };
}

function getEmergencyCases() {
  return safeJSONParse(localStorage.getItem(STORAGE_KEYS.emergencyCases), []);
}

function saveEmergencyCase(caseData, options = { setActive: true }) {
  const existing = getEmergencyCases().filter((item) => item.id !== caseData.id);
  existing.unshift(caseData);
  setStoredJSON(STORAGE_KEYS.emergencyCases, existing.slice(0, MAX_EMERGENCY_HISTORY));

  if (options.setActive !== false) {
    safeSetItem(STORAGE_KEYS.latestEmergencyCaseId, caseData.id);
  }

  return caseData;
}

function getEmergencyCaseById(caseId) {
  return getEmergencyCases().find((item) => item.id === caseId) || null;
}

function getLatestEmergencyCase() {
  const latestId = localStorage.getItem(STORAGE_KEYS.latestEmergencyCaseId);
  return latestId ? getEmergencyCaseById(latestId) : getEmergencyCases()[0] || null;
}

function saveLatestDiagnosis(record) {
  setStoredJSON(STORAGE_KEYS.latestDiagnosis, record);
  return record;
}

function getLatestDiagnosis() {
  return safeJSONParse(localStorage.getItem(STORAGE_KEYS.latestDiagnosis), null);
}

function parseModelJson(responseText) {
  if (!responseText) return null;

  const fencedMatch = responseText.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : responseText;
  const objectMatch = candidate.match(/\{[\s\S]*\}/);

  if (!objectMatch) return null;

  try {
    return JSON.parse(objectMatch[0]);
  } catch (error) {
    console.error("Unable to parse model JSON:", error);
    return null;
  }
}

function getDefaultEmergencyGuidance(caseData) {
  const severity = caseData?.severity || "medium";

  return {
    possibleIssue: extractPossibleConcern(caseData?.diagnosisResponse || ""),
    whatToDoRightNow: severity === "high"
      ? [
          "Keep your dog calm, restrict movement, and prepare to leave for a vet now.",
          "Bring any medications, recent food details, and the symptom timeline with you.",
          "Call the nearest clinic while you get ready so the team knows you are coming.",
        ]
      : [
          "Keep your dog comfortable, quiet, and under close supervision.",
          "Avoid food changes, hard exercise, and unapproved home remedies.",
          "Prepare your notes and contact a vet for urgent guidance today.",
        ],
    whatNotToDo: [
      "Do not give human painkillers or leftover medicines unless a vet specifically instructed it.",
      "Do not force food, water, or exercise if your dog seems distressed.",
      "Do not wait for internet advice alone if breathing, collapse, seizures, or heavy bleeding are involved.",
    ],
    urgencyLevel: severity === "high" ? "Urgent care recommended immediately." : "Prompt veterinary review is recommended.",
    leaveForVet: severity === "high" ? "Leave now or as soon as safe transport is arranged." : "Leave today if symptoms persist, worsen, or new symptoms appear.",
  };
}

async function generateEmergencyGuidance(caseData) {
  const passportContext = buildPassportPromptBlock(caseData?.dogProfile || getActivePassport());
  const prompt = `You are a cautious veterinary triage support assistant.
Return valid JSON only with keys:
- possibleIssue (string)
- whatToDoRightNow (array of 3 concise strings)
- whatNotToDo (array of 3 concise strings)
- urgencyLevel (string)
- leaveForVet (string)

Case details:
- Symptoms reported: ${caseData?.symptomText || "Not provided"}
- Existing AI assessment: ${caseData?.diagnosisResponse || "Not provided"}
- Severity: ${caseData?.severity || "medium"}
${passportContext ? `${passportContext}\n` : ""}
Rules:
- Be conservative and practical.
- Do not suggest dosages.
- Avoid invasive or risky home treatment.
- Recommend urgent vet care when uncertain.
- Keep each item short and readable.`;

  const parsed = parseModelJson(await callGeminiAPI(prompt));
  const fallback = getDefaultEmergencyGuidance(caseData);

  return {
    possibleIssue: parsed?.possibleIssue || fallback.possibleIssue,
    whatToDoRightNow:
      Array.isArray(parsed?.whatToDoRightNow) && parsed.whatToDoRightNow.length
        ? parsed.whatToDoRightNow.slice(0, 4)
        : fallback.whatToDoRightNow,
    whatNotToDo:
      Array.isArray(parsed?.whatNotToDo) && parsed.whatNotToDo.length
        ? parsed.whatNotToDo.slice(0, 4)
        : fallback.whatNotToDo,
    urgencyLevel: parsed?.urgencyLevel || fallback.urgencyLevel,
    leaveForVet: parsed?.leaveForVet || fallback.leaveForVet,
  };
}

function getDefaultHandoffSections(summary) {
  return {
    possibleConcern: summary.possibleConcern,
    recommendedAction: summary.recommendedAction,
    immediateActionsTaken: summary.immediateActionsTaken || "No actions reported yet.",
    ownerContextNote: summary.ownerContext?.emergencyContact
      ? `Emergency contact on file: ${summary.ownerContext.emergencyContact}.`
      : "No additional owner context recorded.",
  };
}

async function enrichHandoffSummary(summary) {
  if (!summary) return null;
  if (summary.aiSections) return summary;

  const passportContext = buildPassportPromptBlock(summary.dogProfile || getActivePassport());
  const prompt = `You are preparing a concise veterinary handoff note.
Return valid JSON only with keys:
- possibleConcern
- recommendedAction
- immediateActionsTaken
- ownerContextNote

Case details:
- Symptoms reported: ${summary.symptomText || "Not provided"}
- AI diagnosis: ${summary.diagnosisResponse || "Not provided"}
- Severity: ${summary.severity || "unknown"}
- Existing recommendation: ${summary.recommendedAction || "Not provided"}
${passportContext ? `${passportContext}\n` : ""}
Rules:
- Keep the tone clinical, clear, and brief.
- Do not invent diagnoses.
- If information is missing, say it was not provided.`;

  const aiSections = {
    ...getDefaultHandoffSections(summary),
    ...(parseModelJson(await callGeminiAPI(prompt)) || {}),
  };
  const nextSummary = { ...summary, aiSections };
  saveSummary(nextSummary);
  return nextSummary;
}

function formatDateTime(value, language = currentLanguage) {
  if (!value) return "";

  const formatter = new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return formatter.format(new Date(value));
}

function escapeHtml(value) {
  return (value || "").toString().replace(/[&<>"']/g, (character) => {
    const lookup = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return lookup[character] || character;
  });
}

function createTranslatableElement(tagName, className, enText, hiText) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.setAttribute("data-en", decodeMojibakeText(enText));
  element.setAttribute("data-hi", decodeMojibakeText(hiText));
  element.textContent = localizedText(enText, hiText);
  return element;
}

function severityLabel(severity) {
  if (currentLanguage === "hi") {
    if (severity === "high") return localizedText("", "à¤…à¤¤à¥à¤¯à¤¾à¤µà¤¶à¥à¤¯à¤•: à¤¤à¥à¤°à¤‚à¤¤ à¤µà¥‡à¤Ÿ à¤¸à¥‡ à¤®à¤¿à¤²à¥‡à¤‚");
    if (severity === "medium") return localizedText("", "à¤šà¤¿à¤‚à¤¤à¤¾à¤œà¤¨à¤•: à¤œà¤²à¥à¤¦ à¤µà¥‡à¤Ÿ à¤¸à¥‡ à¤®à¤¿à¤²à¥‡à¤‚");
    return localizedText("", "à¤¨à¤¿à¤—à¤°à¤¾à¤¨à¥€: à¤˜à¤° à¤ªà¤° à¤¦à¥‡à¤–à¥‡à¤‚");
  }

  if (severity === "high") {
    return currentLanguage === "hi" ? "à¤…à¤¤à¥à¤¯à¤¾à¤µà¤¶à¥à¤¯à¤•: à¤¤à¥à¤°à¤‚à¤¤ à¤µà¥‡à¤Ÿ à¤¸à¥‡ à¤®à¤¿à¤²à¥‡à¤‚" : "URGENT: See vet immediately";
  }

  if (severity === "medium") {
    return currentLanguage === "hi" ? "à¤šà¤¿à¤‚à¤¤à¤¾à¤œà¤¨à¤•: à¤œà¤²à¥à¤¦ à¤µà¥‡à¤Ÿ à¤¸à¥‡ à¤®à¤¿à¤²à¥‡à¤‚" : "CONCERNING: See vet soon";
  }

  return currentLanguage === "hi" ? "à¤¨à¤¿à¤—à¤°à¤¾à¤¨à¥€: à¤˜à¤° à¤ªà¤° à¤¦à¥‡à¤–à¥‡à¤‚" : "MONITOR: Watch at home";
}

function buildCareActionCard({ severity, emergencyCaseId, summaryId, resume = false }) {
  const card = document.createElement("div");
  card.className = `care-action-card ${severity === "high" ? "care-action-urgent" : "care-action-watch"}`;
  if (emergencyCaseId) {
    card.dataset.caseId = emergencyCaseId;
  }

  const chip = createTranslatableElement(
    "span",
    `care-action-chip ${severity === "high" ? "chip-high" : "chip-medium"}`,
    severity === "high" ? "Emergency Mode Suggested" : "Urgent Follow-Up Suggested",
    severity === "high" ? "à¤‡à¤®à¤°à¤œà¥‡à¤‚à¤¸à¥€ à¤®à¥‹à¤¡ à¤¸à¥à¤à¤¾à¤¯à¤¾ à¤—à¤¯à¤¾" : "à¤¤à¥à¤°à¤‚à¤¤ à¤«à¥‰à¤²à¥‹-à¤…à¤ª à¤¸à¥à¤à¤¾à¤¯à¤¾ à¤—à¤¯à¤¾"
  );

  const title = createTranslatableElement(
    "h4",
    "care-action-title",
    severity === "high"
      ? resume
        ? "Resume your active emergency case."
        : "This response looks urgent. Open Emergency Mode now."
      : resume
        ? "Resume your saved vet follow-up."
        : "This needs closer monitoring and a vet plan.",
    severity === "high"
      ? resume
        ? "à¤…à¤ªà¤¨à¤¾ à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤‡à¤®à¤°à¤œà¥‡à¤‚à¤¸à¥€ à¤•à¥‡à¤¸ à¤«à¤¿à¤° à¤–à¥‹à¤²à¥‡à¤‚à¥¤"
        : "à¤¯à¤¹ à¤‰à¤¤à¥à¤¤à¤° à¤—à¤‚à¤­à¥€à¤° à¤²à¤—à¤¤à¤¾ à¤¹à¥ˆà¥¤ à¤…à¤­à¥€ à¤‡à¤®à¤°à¤œà¥‡à¤‚à¤¸à¥€ à¤®à¥‹à¤¡ à¤–à¥‹à¤²à¥‡à¤‚à¥¤"
      : resume
        ? "à¤…à¤ªà¤¨à¤¾ à¤¸à¥‡à¤µ à¤•à¤¿à¤¯à¤¾ à¤¹à¥à¤† à¤«à¥‰à¤²à¥‹-à¤…à¤ª à¤«à¤¿à¤° à¤–à¥‹à¤²à¥‡à¤‚à¥¤"
        : "à¤‡à¤¸ à¤ªà¤° à¤•à¤°à¥€à¤¬à¥€ à¤¨à¤¿à¤—à¤°à¤¾à¤¨à¥€ à¤”à¤° à¤µà¥‡à¤Ÿ à¤ªà¥à¤²à¤¾à¤¨ à¤•à¥€ à¤œà¤°à¥‚à¤°à¤¤ à¤¹à¥ˆà¥¤"
  );

  const description = createTranslatableElement(
    "p",
    "care-action-copy",
    severity === "high"
      ? "Keep the handoff ready, contact a clinic, and head out if symptoms are worsening."
      : "Prepare a handoff summary, check nearby clinics, and seek care soon if your dog does not improve.",
    severity === "high"
      ? "à¤¹à¥ˆà¤‚à¤¡à¤‘à¤« à¤¤à¥ˆà¤¯à¤¾à¤° à¤°à¤–à¥‡à¤‚, à¤•à¥à¤²à¤¿à¤¨à¤¿à¤• à¤¸à¥‡ à¤¸à¤‚à¤ªà¤°à¥à¤• à¤•à¤°à¥‡à¤‚, à¤”à¤° à¤²à¤•à¥à¤·à¤£ à¤¬à¤¢à¤¼ à¤°à¤¹à¥‡ à¤¹à¥‹à¤‚ à¤¤à¥‹ à¤¨à¤¿à¤•à¤²à¥‡à¤‚à¥¤"
      : "à¤¹à¥ˆà¤‚à¤¡à¤‘à¤« à¤¸à¤¾à¤°à¤¾à¤‚à¤¶ à¤¤à¥ˆà¤¯à¤¾à¤° à¤°à¤–à¥‡à¤‚, à¤ªà¤¾à¤¸ à¤•à¥‡ à¤•à¥à¤²à¤¿à¤¨à¤¿à¤• à¤¦à¥‡à¤–à¥‡à¤‚, à¤”à¤° à¤¸à¥à¤§à¤¾à¤° à¤¨ à¤¹à¥‹ à¤¤à¥‹ à¤œà¤²à¥à¤¦ à¤¦à¥‡à¤–à¤­à¤¾à¤² à¤²à¥‡à¤‚à¥¤"
  );

  const actions = document.createElement("div");
  actions.className = "care-action-buttons";
  actions.innerHTML = `
    <a href="emergency.html${emergencyCaseId ? `?caseId=${encodeURIComponent(emergencyCaseId)}` : ""}" class="btn">
      <span data-en="Open Emergency Mode" data-hi="à¤‡à¤®à¤°à¤œà¥‡à¤‚à¤¸à¥€ à¤®à¥‹à¤¡ à¤–à¥‹à¤²à¥‡à¤‚">${currentLanguage === "hi" ? "à¤‡à¤®à¤°à¤œà¥‡à¤‚à¤¸à¥€ à¤®à¥‹à¤¡ à¤–à¥‹à¤²à¥‡à¤‚" : "Open Emergency Mode"}</span>
    </a>
    <a href="vets.html" class="btn btn-secondary">
      <span data-en="Find Vet Now" data-hi="à¤…à¤­à¥€ à¤µà¥‡à¤Ÿ à¤–à¥‹à¤œà¥‡à¤‚">${currentLanguage === "hi" ? "à¤…à¤­à¥€ à¤µà¥‡à¤Ÿ à¤–à¥‹à¤œà¥‡à¤‚" : "Find Vet Now"}</span>
    </a>
    <a href="handoff.html${summaryId ? `?summaryId=${encodeURIComponent(summaryId)}` : ""}" class="btn btn-ghost">
      <span data-en="Create Vet Summary" data-hi="à¤µà¥‡à¤Ÿ à¤¸à¤¾à¤°à¤¾à¤‚à¤¶ à¤¬à¤¨à¤¾à¤à¤‚">${currentLanguage === "hi" ? "à¤µà¥‡à¤Ÿ à¤¸à¤¾à¤°à¤¾à¤‚à¤¶ à¤¬à¤¨à¤¾à¤à¤‚" : "Create Vet Summary"}</span>
    </a>
  `;
  applyTranslations(actions);

  card.appendChild(chip);
  card.appendChild(title);
  card.appendChild(description);
  card.appendChild(actions);
  return card;
}

function renderPassportPreview(container) {
  if (!container) return;

  const passport = getActivePassport();
  if (!passport) {
    container.innerHTML = `
      <div class="passport-preview-card empty">
        <p data-en="Add your dog's Health Passport to personalize diagnosis and emergency care." data-hi="à¤¨à¤¿à¤¦à¤¾à¤¨ à¤”à¤° à¤‡à¤®à¤°à¤œà¥‡à¤‚à¤¸à¥€ à¤•à¥‡à¤¯à¤° à¤•à¥‹ à¤µà¥à¤¯à¤•à¥à¤¤à¤¿à¤—à¤¤ à¤¬à¤¨à¤¾à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤ à¤…à¤ªà¤¨à¥‡ à¤•à¥à¤¤à¥à¤¤à¥‡ à¤•à¤¾ à¤¹à¥‡à¤²à¥à¤¥ à¤ªà¤¾à¤¸à¤ªà¥‹à¤°à¥à¤Ÿ à¤œà¥‹à¤¡à¤¼à¥‡à¤‚à¥¤">
          ${currentLanguage === "hi"
            ? "à¤¨à¤¿à¤¦à¤¾à¤¨ à¤”à¤° à¤‡à¤®à¤°à¤œà¥‡à¤‚à¤¸à¥€ à¤•à¥‡à¤¯à¤° à¤•à¥‹ à¤µà¥à¤¯à¤•à¥à¤¤à¤¿à¤—à¤¤ à¤¬à¤¨à¤¾à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤ à¤…à¤ªà¤¨à¥‡ à¤•à¥à¤¤à¥à¤¤à¥‡ à¤•à¤¾ à¤¹à¥‡à¤²à¥à¤¥ à¤ªà¤¾à¤¸à¤ªà¥‹à¤°à¥à¤Ÿ à¤œà¥‹à¤¡à¤¼à¥‡à¤‚à¥¤"
            : "Add your dog's Health Passport to personalize diagnosis and emergency care."}
        </p>
        <a href="passport.html" class="btn btn-secondary">
          <span data-en="Create Passport" data-hi="à¤ªà¤¾à¤¸à¤ªà¥‹à¤°à¥à¤Ÿ à¤¬à¤¨à¤¾à¤à¤‚">${currentLanguage === "hi" ? "à¤ªà¤¾à¤¸à¤ªà¥‹à¤°à¥à¤Ÿ à¤¬à¤¨à¤¾à¤à¤‚" : "Create Passport"}</span>
        </a>
      </div>
    `;
    applyTranslations(container);
    return;
  }

  const facts = getPassportSummaryFacts(passport);
  container.innerHTML = `
    <div class="passport-preview-card">
      <div class="passport-preview-head">
        <div>
          <span class="passport-preview-label" data-en="Active Health Passport" data-hi="à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤¹à¥‡à¤²à¥à¤¥ à¤ªà¤¾à¤¸à¤ªà¥‹à¤°à¥à¤Ÿ">${currentLanguage === "hi" ? "à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤¹à¥‡à¤²à¥à¤¥ à¤ªà¤¾à¤¸à¤ªà¥‹à¤°à¥à¤Ÿ" : "Active Health Passport"}</span>
          <h3>${escapeHtml(passport.dogName || "Dog profile")}</h3>
        </div>
        <a href="passport.html" class="btn btn-ghost btn-small-inline">
          <span data-en="Manage" data-hi="à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¿à¤¤ à¤•à¤°à¥‡à¤‚">${currentLanguage === "hi" ? "à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¿à¤¤ à¤•à¤°à¥‡à¤‚" : "Manage"}</span>
        </a>
      </div>
      <p class="passport-preview-facts">${facts.map((fact) => escapeHtml(fact)).join(" • ")}</p>
      <p class="passport-preview-note" data-en="This profile will be added to future AI diagnoses." data-hi="à¤¯à¤¹ à¤ªà¥à¤°à¥‹à¤«à¤¾à¤‡à¤² à¤†à¤—à¥‡ à¤•à¥‡ AI à¤¨à¤¿à¤¦à¤¾à¤¨ à¤®à¥‡à¤‚ à¤œà¥‹à¤¡à¤¼à¥€ à¤œà¤¾à¤à¤—à¥€à¥¤">
        ${currentLanguage === "hi"
          ? "à¤¯à¤¹ à¤ªà¥à¤°à¥‹à¤«à¤¾à¤‡à¤² à¤†à¤—à¥‡ à¤•à¥‡ AI à¤¨à¤¿à¤¦à¤¾à¤¨ à¤®à¥‡à¤‚ à¤œà¥‹à¤¡à¤¼à¥€ à¤œà¤¾à¤à¤—à¥€à¥¤"
          : "This profile will be added to future AI diagnoses."}
      </p>
    </div>
  `;
  applyTranslations(container);
}

// API Functions for Deployment-Aware Storage
async function submitFeedback(feedbackData) {
  const apiUrl = resolveApiUrl("/api/feedback");

  try {
    if (!apiUrl) {
      throw new Error("Backend storage is not configured");
    }

    const response = await fetchWithTimeout(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(feedbackData),
    });

    if (!response.ok) throw new Error("Failed to submit feedback");
    return await readJsonSafely(response);
  } catch (error) {
    console.error("Error submitting feedback:", error);
    // Fallback to localStorage if backend fails
    const feedbacks = safeJSONParse(localStorage.getItem("feedbacks"), []);
    feedbackData.id = Date.now();
    feedbackData.timestamp = new Date().toISOString();
    feedbacks.push(feedbackData);
    localStorage.setItem("feedbacks", JSON.stringify(feedbacks));
    return { message: "Feedback saved locally!" };
  }
}

async function saveAdviceToBackend(advice) {
  const apiUrl = resolveApiUrl("/api/advice/save");

  try {
    if (!apiUrl) {
      throw new Error("Backend storage is not configured");
    }

    const response = await fetchWithTimeout(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ advice }),
    });

    if (!response.ok) throw new Error("Failed to save advice");
    const data = await readJsonSafely(response);
    return { savedAdvice: normalizeAdviceList(data) };
  } catch (error) {
    console.error("Error saving advice to backend:", error);
    // Fallback to localStorage
    const savedAdvice = normalizeAdviceList(safeJSONParse(localStorage.getItem("savedDogAdvice"), []));
    if (!savedAdvice.includes(advice)) {
      savedAdvice.push(advice);
      localStorage.setItem("savedDogAdvice", JSON.stringify(savedAdvice));
    }
    return { savedAdvice };
  }
}

function normalizeAdviceList(value) {
  const list = Array.isArray(value)
    ? value
    : Array.isArray(value?.savedAdvice)
      ? value.savedAdvice
      : [];

  return [...new Set(list.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))];
}

async function loadSavedAdviceFromBackend() {
  const apiUrl = resolveApiUrl("/api/advice/saved");

  try {
    if (!apiUrl) {
      throw new Error("Backend storage is not configured");
    }

    const response = await fetchWithTimeout(apiUrl);
    if (!response.ok) throw new Error("Failed to load saved advice");
    const data = await readJsonSafely(response);
    return normalizeAdviceList(data);
  } catch (error) {
    console.error("Error loading saved advice from backend:", error);
    // Fallback to localStorage
    return normalizeAdviceList(safeJSONParse(localStorage.getItem("savedDogAdvice"), []));
  }
}

async function deleteAdviceFromBackend(adviceToRemove) {
  const apiUrl = resolveApiUrl("/api/advice/saved");

  try {
    if (!apiUrl) {
      throw new Error("Backend storage is not configured");
    }

    const response = await fetchWithTimeout(apiUrl, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ advice: adviceToRemove }),
    });

    if (!response.ok) throw new Error("Failed to delete advice");
    const data = await readJsonSafely(response);
    return { savedAdvice: normalizeAdviceList(data) };
  } catch (error) {
    console.error("Error deleting advice from backend:", error);
    // Fallback to localStorage
    let savedAdvice = normalizeAdviceList(safeJSONParse(localStorage.getItem("savedDogAdvice"), []));
    savedAdvice = savedAdvice.filter((advice) => advice !== adviceToRemove);
    localStorage.setItem("savedDogAdvice", JSON.stringify(savedAdvice));
    return { savedAdvice };
  }
}

function initializeRatingControl() {
  const rating = document.querySelector(".rating");
  if (!rating) return null;

  const inputs = Array.from(rating.querySelectorAll('input[name="rating"]'));
  const labels = inputs.map((input) => rating.querySelector(`label[for="${input.id}"]`));

  const paint = (value = 0) => {
    labels.forEach((label, index) => {
      if (!label) return;
      label.classList.toggle("is-active", index < value);
    });
  };

  inputs.forEach((input, index) => {
    const value = Number(input.value);
    const label = labels[index];
    if (!label) return;

    label.addEventListener("mouseenter", () => paint(value));
    label.addEventListener("click", () => {
      input.checked = true;
      paint(value);
    });

    input.addEventListener("change", () => paint(value));
  });

  rating.addEventListener("mouseleave", () => {
    const selected = Number(rating.querySelector('input[name="rating"]:checked')?.value || 0);
    paint(selected);
  });

  const selected = Number(rating.querySelector('input[name="rating"]:checked')?.value || 0);
  paint(selected);
  return {
    reset() {
      paint(0);
    },
  };
}

document.addEventListener("DOMContentLoaded", function () {
  currentLanguage = localStorage.getItem(STORAGE_KEYS.language) || currentLanguage;
  applyTranslations(document);
  const sections = document.querySelectorAll(".section");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.1 }
  );

  sections.forEach((section) => observer.observe(section));

  const translateBtn = document.getElementById("translateBtn");
  const languageModal = document.getElementById("languageModal");
  const langOptions = document.querySelectorAll(".lang-option");

  if (translateBtn && languageModal) {
    translateBtn.addEventListener("click", () =>
      languageModal.classList.add("active")
    );
  }
  langOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const lang = option.getAttribute("data-lang");
      changeLanguage(lang);
    });
  });
  if (languageModal) {
    languageModal.addEventListener("click", (e) => {
      if (e.target === languageModal) languageModal.classList.remove("active");
    });
  }

  const chatMessages = document.getElementById("chatMessages");
  const userInput = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const passportPreviewContainer = document.getElementById("passportContextCard");

  renderPassportPreview(passportPreviewContainer);

  if (chatMessages) {
    const latestEmergencyCase = getLatestEmergencyCase();
    if (latestEmergencyCase) {
      const resumeMessage = document.createElement("div");
      resumeMessage.className = "message bot-message";
      resumeMessage.appendChild(
        createTranslatableElement(
          "p",
          "message-followup-copy",
          "You still have a saved care case ready to reopen.",
          "à¤†à¤ªà¤•à¥‡ à¤ªà¤¾à¤¸ à¤à¤• à¤¸à¥‡à¤µ à¤•à¤¿à¤¯à¤¾ à¤¹à¥à¤† à¤•à¥‡à¤¯à¤° à¤•à¥‡à¤¸ à¤¹à¥ˆ à¤œà¤¿à¤¸à¥‡ à¤«à¤¿à¤° à¤–à¥‹à¤²à¤¾ à¤œà¤¾ à¤¸à¤•à¤¤à¤¾ à¤¹à¥ˆà¥¤"
        )
      );

      const summary = latestEmergencyCase.summaryId
        ? getSummaryById(latestEmergencyCase.summaryId)
        : getLatestSummary();

      resumeMessage.appendChild(
        buildCareActionCard({
          severity: latestEmergencyCase.severity,
          emergencyCaseId: latestEmergencyCase.id,
          summaryId: summary?.id || "",
          resume: true,
        })
      );
      chatMessages.appendChild(resumeMessage);
    }
  }

  function addMessage(text, isUser = false) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add(
      "message",
      isUser ? "user-message" : "bot-message"
    );
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  let isSending = false;

  async function sendMessage() {
    if (isSending) return;
    const message = userInput.value.trim();
    if (message) {
      isSending = true;
      addMessage(message, true);
      userInput.value = "";

      const typingIndicator = document.createElement("div");
      typingIndicator.classList.add("message", "bot-message", "typing-indicator");
      typingIndicator.textContent = localizedText("Typing...", "à¤Ÿà¤¾à¤‡à¤ª à¤•à¤° à¤°à¤¹à¤¾ à¤¹à¥ˆ...");
      chatMessages.appendChild(typingIndicator);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      try {
        const botResponse = await getBotResponse(message);
        const timestamp = getTimestamp();
        const passportSnapshot = getActivePassport();
        const summary = saveSummary(
          buildSummaryObject({
            symptomText: message,
            diagnosisResponse: botResponse.response,
            severity: botResponse.severity,
            timestamp,
            passportSnapshot,
          })
        );
        const diagnosisRecord = saveLatestDiagnosis({
          id: createId("diagnosis"),
          timestamp,
          symptomText: message,
          diagnosisResponse: botResponse.response,
          severity: botResponse.severity,
          summaryId: summary.id,
          passportSnapshot,
        });
        let emergencyCase = null;

        if (botResponse.severity === "high" || botResponse.severity === "medium") {
          emergencyCase = saveEmergencyCase(
            buildEmergencyCase({
              symptomText: message,
              diagnosisResponse: botResponse.response,
              severity: botResponse.severity,
              timestamp,
              passportSnapshot,
              summaryId: summary.id,
            })
          );
          diagnosisRecord.emergencyCaseId = emergencyCase.id;
          saveLatestDiagnosis(diagnosisRecord);
        }

        if (typingIndicator.parentNode) {
          chatMessages.removeChild(typingIndicator);
        }

        const responseDiv = document.createElement("div");
        responseDiv.classList.add("message", "bot-message");

        const responseText = document.createElement("div");
        responseText.textContent = botResponse.response;

        const severitySpan = document.createElement("span");
        severitySpan.classList.add("severity-indicator");

        if (botResponse.severity === "high") {
          severitySpan.classList.add("severity-high");
          severitySpan.textContent =
            currentLanguage === "en"
              ? "URGENT: See vet immediately"
              : "à¤…à¤¤à¥à¤¯à¤¾à¤µà¤¶à¥à¤¯à¤•: à¤¤à¥à¤°à¤‚à¤¤ à¤ªà¤¶à¥ à¤šà¤¿à¤•à¤¿à¤¤à¥à¤¸à¤• à¤•à¥‹ à¤¦à¤¿à¤–à¤¾à¤à¤";
        } else if (botResponse.severity === "medium") {
          severitySpan.classList.add("severity-medium");
          severitySpan.textContent =
            currentLanguage === "en"
              ? "CONCERNING: See vet soon"
              : "à¤šà¤¿à¤‚à¤¤à¤¾à¤œà¤¨à¤•: à¤œà¤²à¥à¤¦ à¤¹à¥€ à¤ªà¤¶à¥ à¤šà¤¿à¤•à¤¿à¤¤à¥à¤¸à¤• à¤•à¥‹ à¤¦à¤¿à¤–à¤¾à¤à¤";
        } else {
          severitySpan.classList.add("severity-low");
          severitySpan.textContent =
            currentLanguage === "en"
              ? "MONITOR: Watch at home"
              : "à¤¨à¤¿à¤—à¤°à¤¾à¤¨à¥€: à¤˜à¤° à¤ªà¤° à¤¦à¥‡à¤–à¥‡à¤‚";
        }

        severitySpan.className = "severity-indicator";
        severitySpan.textContent = severityLabel(botResponse.severity);
        severitySpan.classList.add(
          botResponse.severity === "high"
            ? "severity-high"
            : botResponse.severity === "medium"
              ? "severity-medium"
              : "severity-low"
        );

        responseDiv.appendChild(responseText);
        responseDiv.appendChild(severitySpan);

        if (botResponse.severity === "high" || botResponse.severity === "medium") {
          responseDiv.appendChild(
            buildCareActionCard({
              severity: botResponse.severity,
              emergencyCaseId: emergencyCase?.id || "",
              summaryId: summary.id,
            })
          );
        }

        chatMessages.appendChild(responseDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } catch (err) {
        console.error(err);
        if (typingIndicator.parentNode) chatMessages.removeChild(typingIndicator);
      } finally {
        isSending = false;
      }
    }
  }

  if (sendBtn && userInput) {
    sendBtn.addEventListener("click", sendMessage);
    userInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
    });
  }

  // Updated Feedback Form Handler
  const feedbackForm = document.getElementById("feedbackForm");
  const ratingControl = initializeRatingControl();
  if (feedbackForm) {
    feedbackForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const feedbackData = {
        name: document.getElementById("name").value,
        phone: document.getElementById("phone").value,
        rating: document.querySelector('input[name="rating"]:checked')?.value || "0",
        comments: document.getElementById("comments").value,
      };

      const result = await submitFeedback(feedbackData);
      feedbackForm.reset();
      ratingControl?.reset();

      alert(
        currentLanguage === "en"
          ? "Thank you for your feedback!"
          : "à¤†à¤ªà¤•à¥€ à¤ªà¥à¤°à¤¤à¤¿à¤•à¥à¤°à¤¿à¤¯à¤¾ à¤•à¥‡ à¤²à¤¿à¤ à¤§à¤¨à¥à¤¯à¤µà¤¾à¤¦!"
      );
    });
  }

  // Initialize expert advice page if we're on expert.html
  initializeExpertAdvicePage();

  // Initialize vets page if we're on vets.html
  initializeVetsPage();
});

// Expert Advice Page Functions
function initializeExpertAdvicePage() {
  const currentAdvice = document.getElementById("current-advice");
  const newAdviceBtn = document.getElementById("new-advice");
  const saveFavoriteBtn = document.getElementById("save-favorite");
  const savedList = document.getElementById("saved-list");
  const categoryButtons = document.querySelectorAll(".category-buttons button");

  if (!currentAdvice) return; // Not on expert advice page

  let currentCategory = "all";
  let savedAdvice = [];
  let activeAdvice = "";

  const expertAdvice = {
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

  newAdviceBtn.addEventListener("click", getRandomAdvice);
  saveFavoriteBtn.addEventListener("click", saveCurrentAdvice);

  categoryButtons.forEach((button) => {
    button.addEventListener("click", function () {
      categoryButtons.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");
      currentCategory = this.dataset.category;
      getRandomAdvice();
    });
  });

  document.addEventListener("fr:languagechange", () => {
    renderSavedAdvice();
    updateSaveButton(false);
  });

  loadSavedAdvice();

  function getRandomAdvice() {
    const categoryAdvice = expertAdvice[currentCategory];
    const randomIndex = Math.floor(Math.random() * categoryAdvice.length);
    setCurrentAdvice(categoryAdvice[randomIndex]);
  }

  async function saveCurrentAdvice() {
    if (!activeAdvice) return;
    if (savedAdvice.includes(activeAdvice)) {
      updateSaveButton(true);
      return;
    }

    const result = await saveAdviceToBackend(activeAdvice);
    savedAdvice = normalizeAdviceList(result.savedAdvice || savedAdvice);
    renderSavedAdvice();
    updateSaveButton(true);
  }

  function setCurrentAdvice(advice) {
    activeAdvice = advice || "";
    if (activeAdvice) {
      currentAdvice.removeAttribute("data-en");
      currentAdvice.removeAttribute("data-hi");
      currentAdvice.textContent = activeAdvice;
      return;
    }

    const fallbackEn = "Choose a category and tap New Advice to get a fresh expert tip.";
    const fallbackHi = "à¤à¤• à¤¶à¥à¤°à¥‡à¤£à¥€ à¤šà¥à¤¨à¥‡à¤‚ à¤”à¤° à¤¨à¤ˆ à¤µà¤¿à¤¶à¥‡à¤·à¤œà¥à¤ž à¤¸à¤²à¤¾à¤¹ à¤ªà¤¾à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤ New Advice à¤¦à¤¬à¤¾à¤à¤‚à¥¤";
    currentAdvice.setAttribute("data-en", fallbackEn);
    currentAdvice.setAttribute("data-hi", fallbackHi);
    currentAdvice.textContent = currentLanguage === "hi" ? fallbackHi : fallbackEn;
  }

  function updateSaveButton(saved) {
    const icon = saveFavoriteBtn.querySelector("i");
    const label = saveFavoriteBtn.querySelector("span");
    if (!icon || !label) return;

    icon.className = saved ? "fas fa-heart" : "far fa-heart";
    if (saved) {
      label.textContent = currentLanguage === "hi" ? "à¤¸à¥‡à¤µ à¤•à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾" : "Saved";
      window.clearTimeout(updateSaveButton.timeoutId);
      updateSaveButton.timeoutId = window.setTimeout(() => updateSaveButton(false), 1600);
      return;
    }

    label.textContent = currentLanguage === "hi" ? "à¤Ÿà¤¿à¤ª à¤¸à¥‡à¤µ à¤•à¤°à¥‡à¤‚" : "Save Tip";
  }

  async function loadSavedAdvice() {
    savedAdvice = normalizeAdviceList(await loadSavedAdviceFromBackend());
    renderSavedAdvice();
    setCurrentAdvice("");
  }

  function renderSavedAdvice() {
    if (!savedList) return;

    savedList.innerHTML = "";

    if (!savedAdvice.length) {
      const emptyState = document.createElement("div");
      emptyState.className = "advice-empty";
      emptyState.textContent = currentLanguage === "hi"
        ? "à¤…à¤­à¥€ à¤¤à¤• à¤•à¥‹à¤ˆ à¤Ÿà¤¿à¤ª à¤¸à¥‡à¤µ à¤¨à¤¹à¥€à¤‚ à¤•à¥€ à¤—à¤ˆ à¤¹à¥ˆà¥¤"
        : "You have not saved any tips yet.";
      savedList.appendChild(emptyState);
      return;
    }

    savedAdvice.forEach((advice) => {
      const item = document.createElement("div");
      item.className = "saved-item";

      const text = document.createElement("p");
      text.textContent = advice;

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-btn";
      deleteButton.type = "button";
      deleteButton.setAttribute("aria-label", currentLanguage === "hi" ? "à¤¸à¥‡à¤µ à¤•à¥€ à¤—à¤ˆ à¤Ÿà¤¿à¤ª à¤¹à¤Ÿà¤¾à¤à¤‚" : "Remove saved tip");

      const icon = document.createElement("i");
      icon.className = "fas fa-trash";
      deleteButton.appendChild(icon);

      deleteButton.addEventListener("click", async function () {
        const result = await deleteAdviceFromBackend(advice);
        savedAdvice = result.savedAdvice || savedAdvice;
        renderSavedAdvice();
        updateSaveButton(false);
      });
      item.appendChild(text);
      item.appendChild(deleteButton);
      savedList.appendChild(item);
    });
  }
}

function changeLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem(STORAGE_KEYS.language, lang);
  applyTranslations(document);

  const modal = document.getElementById("languageModal");
  if (modal) {
    modal.classList.remove("active");
  }

  document.dispatchEvent(
    new CustomEvent("fr:languagechange", {
      detail: { lang },
    })
  );
}

// ===== VETS PAGE =====
function initializeVetsPage() {
  const mapContainer = document.getElementById("vet-map");
  if (!mapContainer) return; // Not on vets page

  const clinics = [
    // ===== DELHI (10 clinics â€” urban + rural outskirts) =====
    {
      name: "Paws & Claws Veterinary Clinic",
      lat: 28.6304,
      lng: 77.2177,
      phone: "+911123456789",
      address: "23, Connaught Place, New Delhi 110001",
    },
    {
      name: "DCC Animal Hospital",
      lat: 28.5672,
      lng: 77.2100,
      phone: "+911126851500",
      address: "A-8, Defence Colony, New Delhi 110024",
    },
    {
      name: "Friendicoes SECA",
      lat: 28.5827,
      lng: 77.2310,
      phone: "+911124315133",
      address: "271, Jangpura B, Mathura Road, New Delhi 110014",
    },
    {
      name: "Max Vets Dwarka",
      lat: 28.5921,
      lng: 77.0460,
      phone: "+911145004500",
      address: "Sector 7, Dwarka, New Delhi 110075",
    },
    {
      name: "SOS Animal Clinic - Rohini",
      lat: 28.7325,
      lng: 77.1170,
      phone: "+911127055675",
      address: "C-5/44, Sector 5, Rohini, New Delhi 110085",
    },
    {
      name: "Najafgarh Veterinary Hospital",
      lat: 28.6092,
      lng: 76.9798,
      phone: "+911125012345",
      address: "Main Najafgarh Road, Najafgarh, New Delhi 110043",
    },
    {
      name: "Narela Government Veterinary Clinic",
      lat: 28.8527,
      lng: 77.0929,
      phone: "+911127782200",
      address: "Near Narela Mandi, Narela, Delhi 110040",
    },
    {
      name: "Alipur Pet Care Centre",
      lat: 28.7950,
      lng: 77.1342,
      phone: "+911127201189",
      address: "GT Karnal Road, Alipur, Delhi 110036",
    },
    {
      name: "Mehrauli Animal Welfare Clinic",
      lat: 28.5244,
      lng: 77.1855,
      phone: "+911126642900",
      address: "Near Qutub Minar, Mehrauli, New Delhi 110030",
    },
    {
      name: "Bawana Rural Veterinary Centre",
      lat: 28.7762,
      lng: 77.0340,
      phone: "+911127862345",
      address: "Main Market Road, Bawana, Delhi 110039",
    },
    // ===== OTHER CITIES =====
    {
      name: "Mumbai Pet Care Hospital",
      lat: 19.0760,
      lng: 72.8777,
      phone: "+912234567890",
      address: "15, Bandra West, Mumbai, Maharashtra 400050",
    },
    {
      name: "Bangalore Canine Wellness Centre",
      lat: 12.9716,
      lng: 77.5946,
      phone: "+918045678901",
      address: "42, Koramangala 4th Block, Bengaluru, Karnataka 560034",
    },
    {
      name: "Chennai Veterinary Hospital",
      lat: 13.0827,
      lng: 80.2707,
      phone: "+914456789012",
      address: "8, Anna Nagar, Chennai, Tamil Nadu 600040",
    },
    {
      name: "Jaipur Animal Care Clinic",
      lat: 26.9124,
      lng: 75.7873,
      phone: "+911417890123",
      address: "56, C-Scheme, Jaipur, Rajasthan 302001",
    },
  ];

  const map = L.map("vet-map").setView([28.6500, 77.1000], 10);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(map);

  const vetIcon = L.divIcon({
    className: "vet-marker-icon",
    html: '<i class="fas fa-map-marker-alt"></i>',
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42],
  });


  clinics.forEach((clinic) => {
    const popupContent = `
      <div class="popup-content">
        <h3>${clinic.name}</h3>
        <p><i class="fas fa-map-marker-alt"></i>${clinic.address}</p>
        <p><i class="fas fa-phone"></i>${clinic.phone}</p>
        <div class="popup-actions">
          <a href="https://www.google.com/maps/dir/?api=1&destination=${clinic.lat},${clinic.lng}"
             target="_blank" rel="noreferrer" class="btn-small btn-directions">
            <i class="fas fa-directions"></i> <span data-en="Directions" data-hi="à¤¦à¤¿à¤¶à¤¾-à¤¨à¤¿à¤°à¥à¤¦à¥‡à¤¶">Directions</span>
          </a>
          <a href="tel:${clinic.phone}" class="btn-small btn-call">
            <i class="fas fa-phone"></i> <span data-en="Call" data-hi="à¤•à¥‰à¤² à¤•à¤°à¥‡à¤‚">Call</span>
          </a>
        </div>
      </div>
    `;

    L.marker([clinic.lat, clinic.lng], { icon: vetIcon })
      .addTo(map)
      .bindPopup(popupContent, { maxWidth: 280 });
  });

  const clinicListContainer = document.getElementById("clinicList");
  if (clinicListContainer) {
    clinicListContainer.innerHTML = clinics
      .map(
        (clinic) => `
        <div class="clinic-card">
          <div class="clinic-card-header">
            <i class="fas fa-hospital"></i>
            <h3>${clinic.name}</h3>
          </div>
          <div class="clinic-card-body">
            <div class="clinic-info">
              <i class="fas fa-map-marker-alt"></i>
              <span data-en="${clinic.address}" data-hi="${clinic.address}">${clinic.address}</span>
            </div>
            <div class="clinic-info">
              <i class="fas fa-phone"></i>
              <span>${clinic.phone}</span>
            </div>
          </div>
          <div class="clinic-card-actions">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${clinic.lat},${clinic.lng}"
               target="_blank" rel="noreferrer" class="btn-small btn-directions">
              <i class="fas fa-directions"></i> <span data-en="Get Directions" data-hi="à¤¦à¤¿à¤¶à¤¾-à¤¨à¤¿à¤°à¥à¤¦à¥‡à¤¶ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤•à¤°à¥‡à¤‚">Get Directions</span>
            </a>
            <a href="tel:${clinic.phone}" class="btn-small btn-call">
              <i class="fas fa-phone"></i> <span data-en="Call ${clinic.phone}" data-hi="à¤•à¥‰à¤² à¤•à¤°à¥‡à¤‚ ${clinic.phone}">Call ${clinic.phone}</span>
            </a>
          </div>
        </div>
      `
      )
      .join("");
  }

  if (currentLanguage !== "en") {
    changeLanguage(currentLanguage);
  }
}

window.FurstResponseApp = {
  changeLanguage,
  applyTranslations,
  getActivePassport,
  getPassportStore,
  savePassportProfile,
  clearPassportProfile,
  getPassportSummaryFacts,
  renderPassportPreview,
  getRelevantClinics,
  getCurrentPosition,
  getSummaryHistory,
  getSummaryById,
  getLatestSummary,
  saveSummary,
  buildSummaryObject,
  enrichHandoffSummary,
  getEmergencyCases,
  getEmergencyCaseById,
  getLatestEmergencyCase,
  saveEmergencyCase,
  buildEmergencyCase,
  generateEmergencyGuidance,
  getLatestDiagnosis,
  saveLatestDiagnosis,
  formatDateTime,
  severityLabel,
  CLINICS,
  currentLanguage: () => currentLanguage,
};

