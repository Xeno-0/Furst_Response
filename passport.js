document.addEventListener("DOMContentLoaded", () => {
  const app = window.FurstResponseApp;
  if (!app) return;

  const form = document.getElementById("passportForm");
  const status = document.getElementById("passportFormStatus");
  const summary = document.getElementById("passportSummary");
  const clinicOptions = document.getElementById("clinicOptions");
  const photoPreview = document.getElementById("passportPhotoPreview");
  const editBtn = document.getElementById("editPassportBtn");
  const resetBtn = document.getElementById("resetPassportBtn");
  const clearBtn = document.getElementById("clearPassportBtn");
  const fileInput = document.getElementById("photoUpload");
  let currentPhotoData = "";
  let editing = !app.getActivePassport();

  clinicOptions.innerHTML = app.CLINICS.map((clinic) => `<option value="${clinic.name}"></option>`).join("");

  function getField(id) {
    return document.getElementById(id);
  }

  function getFormData() {
    return {
      id: app.getActivePassport()?.id,
      dogName: getField("dogName").value,
      breed: getField("breed").value,
      age: getField("age").value,
      sex: getField("sex").value,
      weight: getField("weight").value,
      neuteredStatus: getField("neuteredStatus").value,
      allergies: getField("allergies").value,
      medications: getField("medications").value,
      chronicConditions: getField("chronicConditions").value,
      vaccinationStatus: getField("vaccinationStatus").value,
      feedingNotes: getField("feedingNotes").value,
      behavioralNotes: getField("behavioralNotes").value,
      emergencyContact: getField("emergencyContact").value,
      preferredClinic: getField("preferredClinic").value,
      photoUrl: currentPhotoData || getField("photoUrl").value,
    };
  }

  function validate(data) {
    if (!data.dogName.trim() || !data.breed.trim()) {
      return currentLanguage() === "hi"
        ? "नाम और नस्ल भरना जरूरी है।"
        : "Dog name and breed are required.";
    }

    if (data.age !== "" && Number(data.age) < 0) {
      return currentLanguage() === "hi" ? "उम्र सही दर्ज करें।" : "Please enter a valid age.";
    }

    if (data.weight !== "" && Number(data.weight) < 0) {
      return currentLanguage() === "hi" ? "वजन सही दर्ज करें।" : "Please enter a valid weight.";
    }

    return "";
  }

  function currentLanguage() {
    return app.currentLanguage();
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function setEditingState(isEditing) {
    editing = isEditing;
    Array.from(form.elements).forEach((element) => {
      if (element.id !== "clearPassportBtn") {
        element.disabled = !editing && element.type !== "hidden";
      }
    });
    editBtn.textContent = editing ? (currentLanguage() === "hi" ? "देखें" : "View") : (currentLanguage() === "hi" ? "संपादित करें" : "Edit");
  }

  function fillForm(passport) {
    const data = passport || {};
    [
      "dogName","breed","age","sex","weight","neuteredStatus","allergies","medications","chronicConditions",
      "vaccinationStatus","feedingNotes","behavioralNotes","emergencyContact","preferredClinic","photoUrl"
    ].forEach((key) => {
      getField(key).value = data[key] || "";
    });
    currentPhotoData = data.photoUrl || "";
    photoPreview.src = currentPhotoData || "Images/Logo.png";
  }

  function renderSummary() {
    const passport = app.getActivePassport();
    if (!passport) {
      summary.innerHTML = `<div class="empty-state"><h3 data-en="No passport yet" data-hi="अभी पासपोर्ट नहीं है">${currentLanguage() === "hi" ? "अभी पासपोर्ट नहीं है" : "No passport yet"}</h3><p data-en="Create a profile once, then it will personalize diagnosis and handoff notes automatically." data-hi="एक बार प्रोफाइल बनाएं, फिर यह निदान और हैंडऑफ नोट्स को अपने आप व्यक्तिगत बना देगा।">${currentLanguage() === "hi" ? "एक बार प्रोफाइल बनाएं, फिर यह निदान और हैंडऑफ नोट्स को अपने आप व्यक्तिगत बना देगा।" : "Create a profile once, then it will personalize diagnosis and handoff notes automatically."}</p></div>`;
      photoPreview.src = "Images/Logo.png";
      return;
    }

    const facts = app.getPassportSummaryFacts(passport).join(" • ");
    summary.innerHTML = `
      <div class="summary-block">
        <h3>${passport.dogName}</h3>
        <p class="page-muted">${facts}</p>
      </div>
      <div class="detail-list">
        <div class="detail-row"><span>${currentLanguage() === "hi" ? "एलर्जी" : "Allergies"}</span><strong>${passport.allergies || (currentLanguage() === "hi" ? "नहीं दर्ज" : "Not listed")}</strong></div>
        <div class="detail-row"><span>${currentLanguage() === "hi" ? "दवाएं" : "Medications"}</span><strong>${passport.medications || (currentLanguage() === "hi" ? "नहीं दर्ज" : "Not listed")}</strong></div>
        <div class="detail-row"><span>${currentLanguage() === "hi" ? "क्रॉनिक स्थिति" : "Chronic Conditions"}</span><strong>${passport.chronicConditions || (currentLanguage() === "hi" ? "नहीं दर्ज" : "Not listed")}</strong></div>
        <div class="detail-row"><span>${currentLanguage() === "hi" ? "टीकाकरण" : "Vaccination"}</span><strong>${passport.vaccinationStatus || (currentLanguage() === "hi" ? "नहीं दर्ज" : "Not listed")}</strong></div>
        <div class="detail-row"><span>${currentLanguage() === "hi" ? "क्लिनिक" : "Preferred Clinic"}</span><strong>${passport.preferredClinic || (currentLanguage() === "hi" ? "नहीं चुना" : "Not selected")}</strong></div>
      </div>`;
    photoPreview.src = passport.photoUrl || "Images/Logo.png";
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      currentPhotoData = reader.result;
      photoPreview.src = currentPhotoData;
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = getFormData();
    const error = validate(data);
    if (error) {
      setStatus(error);
      return;
    }
    app.savePassportProfile(data);
    fillForm(app.getActivePassport());
    renderSummary();
    setEditingState(false);
    setStatus(currentLanguage() === "hi" ? "पासपोर्ट सेव हो गया।" : "Passport saved locally.");
  });

  editBtn.addEventListener("click", () => {
    setEditingState(!editing);
    if (!editing) {
      fillForm(app.getActivePassport());
    }
  });

  resetBtn.addEventListener("click", () => {
    fillForm(app.getActivePassport());
    setStatus(currentLanguage() === "hi" ? "फॉर्म रीसेट हो गया।" : "Form reset to saved values.");
  });

  clearBtn.addEventListener("click", () => {
    app.clearPassportProfile();
    form.reset();
    currentPhotoData = "";
    renderSummary();
    setEditingState(true);
    setStatus(currentLanguage() === "hi" ? "सेव प्रोफाइल हट गई।" : "Saved profile cleared.");
  });

  document.addEventListener("fr:languagechange", () => {
    renderSummary();
    setEditingState(editing);
  });

  fillForm(app.getActivePassport());
  renderSummary();
  setEditingState(editing);
});
