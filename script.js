let currentLanguage = "en";
const GEMINI_API_KEY = "KeyHere";
async function callGeminiAPI(prompt) {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) throw new Error("API request failed");
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return currentLanguage === "en"
      ? "Sorry, I couldn't process your request. Please try again later."
      : "क्षमा करें, मैं आपका अनुरोध संसाधित नहीं कर पाया। कृपया बाद में पुनः प्रयास करें।";
  }
}

async function getBotResponse(userMessage) {
  const prompt = `You are a helpful and professional veteranian medical support assistant. A user describes their dog's symptoms: "${userMessage}". 
    Provide a concise diagnosis (if possible), recommended action, and severity level (low, medium, high). 
    Format: [Response] [Severity: low/medium/high]
    Make sure your responses are in paragraphs of no more than 30-40 words, dont use bold words`;

  const geminiResponse = await callGeminiAPI(prompt);
  return parseGeminiResponse(geminiResponse);
}

function parseGeminiResponse(response) {
  let severity = "low"; // Default
  if (response.includes("Severity: high")) severity = "high";
  else if (response.includes("Severity: medium")) severity = "medium";

  const cleanedResponse = response
    .replace(/Severity: (low|medium|high)/g, "")
    .trim();

  return {
    response: cleanedResponse,
    severity: severity,
  };
}

document.addEventListener("DOMContentLoaded", function () {
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

  translateBtn.addEventListener("click", () =>
    languageModal.classList.add("active")
  );
  langOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const lang = option.getAttribute("data-lang");
      changeLanguage(lang);
    });
  });
  languageModal.addEventListener("click", (e) => {
    if (e.target === languageModal) languageModal.classList.remove("active");
  });

  const chatMessages = document.getElementById("chatMessages");
  const userInput = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");

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

  async function sendMessage() {
    const message = userInput.value.trim();
    if (message) {
      addMessage(message, true);
      userInput.value = "";

      const typingIndicator = document.createElement("div");
      typingIndicator.classList.add("message", "bot-message");
      typingIndicator.textContent =
        currentLanguage === "en" ? "Typing..." : "टाइप कर रहा है...";
      chatMessages.appendChild(typingIndicator);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      const botResponse = await getBotResponse(message);

      chatMessages.removeChild(typingIndicator);

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
            : "अत्यावश्यक: तुरंत पशु चिकित्सक को दिखाएँ";
      } else if (botResponse.severity === "medium") {
        severitySpan.classList.add("severity-medium");
        severitySpan.textContent =
          currentLanguage === "en"
            ? "CONCERNING: See vet soon"
            : "चिंताजनक: जल्द ही पशु चिकित्सक को दिखाएँ";
      } else {
        severitySpan.classList.add("severity-low");
        severitySpan.textContent =
          currentLanguage === "en"
            ? "MONITOR: Watch at home"
            : "निगरानी: घर पर देखें";
      }

      responseDiv.appendChild(responseText);
      responseDiv.appendChild(severitySpan);
      chatMessages.appendChild(responseDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
  const feedbackForm = document.getElementById("feedbackForm");
  feedbackForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const feedbackData = {
      name: document.getElementById("name").value,
      phone: document.getElementById("phone").value,
      rating: document.querySelector('input[name="rating"]:checked').value,
      comments: document.getElementById("comments").value,
      timestamp: new Date().toISOString(),
    };
    let feedbacks = JSON.parse(localStorage.getItem("feedbacks") || "[]");
    feedbacks.push(feedbackData);
    localStorage.setItem("feedbacks", JSON.stringify(feedbacks));
    feedbackForm.reset();
    alert(
      currentLanguage === "en"
        ? "Thank you for your feedback!"
        : "आपकी प्रतिक्रिया के लिए धन्यवाद!"
    );
  });
});

function changeLanguage(lang) {
  currentLanguage = lang;
  document.querySelectorAll("[data-en], [data-hi]").forEach((element) => {
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      const placeholderKey = `data-${lang}-placeholder`;
      if (element.hasAttribute(placeholderKey)) {
        element.placeholder = element.getAttribute(placeholderKey);
      }
    } else if (element.hasAttribute(`data-${lang}`)) {
      element.textContent = element.getAttribute(`data-${lang}`);
    }
  });
  document.getElementById("languageModal").classList.remove("active");
}
