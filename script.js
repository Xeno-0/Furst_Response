let currentLanguage = "en";
const GEMINI_API_KEY = "AIzaSyCD6qh_wlI2O7pbjLgOYd2MfRbYhwOSXjw";

// Base URL for API calls (adjust if needed)
const API_BASE_URL = '';

async function callGeminiAPI(prompt) {
  const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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

// API Functions for Backend Integration
async function submitFeedback(feedbackData) {
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(feedbackData),
    });

    if (!response.ok) throw new Error('Failed to submit feedback');
    return await response.json();
  } catch (error) {
    console.error('Error submitting feedback:', error);
    // Fallback to localStorage if backend fails
    let feedbacks = JSON.parse(localStorage.getItem("feedbacks") || "[]");
    feedbackData.id = Date.now();
    feedbackData.timestamp = new Date().toISOString();
    feedbacks.push(feedbackData);
    localStorage.setItem("feedbacks", JSON.stringify(feedbacks));
    return { message: 'Feedback saved locally!' };
  }
}

async function saveAdviceToBackend(advice) {
  try {
    const response = await fetch('/api/advice/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ advice }),
    });

    if (!response.ok) throw new Error('Failed to save advice');
    return await response.json();
  } catch (error) {
    console.error('Error saving advice to backend:', error);
    // Fallback to localStorage
    let savedAdvice = JSON.parse(localStorage.getItem("savedDogAdvice") || "[]");
    if (!savedAdvice.includes(advice)) {
      savedAdvice.push(advice);
      localStorage.setItem("savedDogAdvice", JSON.stringify(savedAdvice));
    }
    return { savedAdvice };
  }
}

async function loadSavedAdviceFromBackend() {
  try {
    const response = await fetch('/api/advice/saved');
    if (!response.ok) throw new Error('Failed to load saved advice');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading saved advice from backend:', error);
    // Fallback to localStorage
    return JSON.parse(localStorage.getItem("savedDogAdvice") || "[]");
  }
}

async function deleteAdviceFromBackend(adviceToRemove) {
  try {
    const response = await fetch('/api/advice/saved', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ advice: adviceToRemove }),
    });

    if (!response.ok) throw new Error('Failed to delete advice');
    return await response.json();
  } catch (error) {
    console.error('Error deleting advice from backend:', error);
    // Fallback to localStorage
    let savedAdvice = JSON.parse(localStorage.getItem("savedDogAdvice") || "[]");
    savedAdvice = savedAdvice.filter(a => a !== adviceToRemove);
    localStorage.setItem("savedDogAdvice", JSON.stringify(savedAdvice));
    return { savedAdvice };
  }
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

  let isSending = false;

  async function sendMessage() {
    if (isSending) return;
    const message = userInput.value.trim();
    if (message) {
      isSending = true;
      addMessage(message, true);
      userInput.value = "";

      const typingIndicator = document.createElement("div");
      typingIndicator.classList.add("message", "bot-message");
      typingIndicator.textContent =
        currentLanguage === "en" ? "Typing..." : "टाइप कर रहा है...";
      chatMessages.appendChild(typingIndicator);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      try {
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

      alert(
        currentLanguage === "en"
          ? "Thank you for your feedback!"
          : "आपकी प्रतिक्रिया के लिए धन्यवाद!"
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

  // Load saved advice on page load
  loadSavedAdvice();

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

  function getRandomAdvice() {
    const categoryAdvice = expertAdvice[currentCategory];
    const randomIndex = Math.floor(Math.random() * categoryAdvice.length);
    currentAdvice.textContent = categoryAdvice[randomIndex];
  }

  async function saveCurrentAdvice() {
    const advice = currentAdvice.textContent;
    if (advice && !advice.includes("Click")) {
      const result = await saveAdviceToBackend(advice);
      savedAdvice = result.savedAdvice || savedAdvice;
      renderSavedAdvice();

      saveFavoriteBtn.innerHTML = '<i class="fas fa-heart"></i> Saved!';
      setTimeout(() => {
        saveFavoriteBtn.innerHTML = '<i class="far fa-heart"></i> Save';
      }, 2000);
    }
  }

  async function loadSavedAdvice() {
    savedAdvice = await loadSavedAdviceFromBackend();
    renderSavedAdvice();
  }

  function renderSavedAdvice() {
    if (!savedList) return;

    savedList.innerHTML = savedAdvice
      .map(
        (advice) => `
          <div class="saved-item">
              <p>${advice}</p>
              <button class="delete-btn" data-advice="${advice}">
                  <i class="fas fa-trash"></i>
              </button>
          </div>
      `
      )
      .join("");

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async function () {
        const adviceToRemove = this.dataset.advice;
        const result = await deleteAdviceFromBackend(adviceToRemove);
        savedAdvice = result.savedAdvice || savedAdvice.filter(a => a !== adviceToRemove);
        renderSavedAdvice();
      });
    });
  }
}

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

// ===== VETS PAGE =====
function initializeVetsPage() {
  const mapContainer = document.getElementById("vet-map");
  if (!mapContainer) return; // Not on vets page

  const clinics = [
    // ===== DELHI (10 clinics — urban + rural outskirts) =====
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

  // Initialize Leaflet map centered on Delhi
  const map = L.map("vet-map").setView([28.6500, 77.1000], 10);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(map);

  // Custom marker icon using theme colors
  const vetIcon = L.divIcon({
    className: "vet-marker-icon",
    html: '<i class="fas fa-map-marker-alt" style="color:#e63946;font-size:32px;filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.4))"></i>',
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42],
  });

  // Add markers with styled popups
  clinics.forEach((clinic) => {
    const popupContent = `
      <div class="popup-content">
        <h3>${clinic.name}</h3>
        <p><i class="fas fa-map-marker-alt"></i>${clinic.address}</p>
        <p><i class="fas fa-phone"></i>${clinic.phone}</p>
        <div class="popup-actions">
          <a href="https://www.google.com/maps/dir/?api=1&destination=${clinic.lat},${clinic.lng}"
             target="_blank" class="btn-small btn-directions">
            <i class="fas fa-directions"></i> <span data-en="Directions" data-hi="दिशा-निर्देश">Directions</span>
          </a>
          <a href="tel:${clinic.phone}" class="btn-small btn-call">
            <i class="fas fa-phone"></i> <span data-en="Call" data-hi="कॉल करें">Call</span>
          </a>
        </div>
      </div>
    `;

    L.marker([clinic.lat, clinic.lng], { icon: vetIcon })
      .addTo(map)
      .bindPopup(popupContent, { maxWidth: 280 });
  });

  // Generate clinic list cards
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
               target="_blank" class="btn-small btn-directions">
              <i class="fas fa-directions"></i> <span data-en="Get Directions" data-hi="दिशा-निर्देश प्राप्त करें">Get Directions</span>
            </a>
            <a href="tel:${clinic.phone}" class="btn-small btn-call">
              <i class="fas fa-phone"></i> <span data-en="Call ${clinic.phone}" data-hi="कॉल करें ${clinic.phone}">Call ${clinic.phone}</span>
            </a>
          </div>
        </div>
      `
      )
      .join("");
  }

  // Apply current language to dynamically generated content
  if (currentLanguage !== "en") {
    changeLanguage(currentLanguage);
  }
}

