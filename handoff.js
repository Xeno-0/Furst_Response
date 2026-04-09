document.addEventListener("DOMContentLoaded", async () => {
  const app = window.FurstResponseApp;
  if (!app) return;

  const params = new URLSearchParams(window.location.search);
  let summary = params.get("summaryId") ? app.getSummaryById(params.get("summaryId")) : app.getLatestSummary();
  const emptyState = document.getElementById("handoffEmptyState");
  const sheet = document.getElementById("handoffSheet");
  const history = document.getElementById("handoffHistory");
  const timestamp = document.getElementById("handoffTimestamp");
  const emergencyLink = document.getElementById("emergencyLink");

  if (!summary) {
    const latestDiagnosis = app.getLatestDiagnosis();
    if (latestDiagnosis) {
      summary = app.saveSummary(
        app.buildSummaryObject({
          symptomText: latestDiagnosis.symptomText,
          diagnosisResponse: latestDiagnosis.diagnosisResponse,
          severity: latestDiagnosis.severity,
          timestamp: latestDiagnosis.timestamp,
          passportSnapshot: latestDiagnosis.passportSnapshot,
        })
      );
    }
  }

  if (!summary) {
    emptyState.hidden = false;
    document.querySelector(".page-shell-grid").hidden = true;
    return;
  }

  summary = await app.enrichHandoffSummary(summary);
  timestamp.textContent = app.formatDateTime(summary.createdAt, app.currentLanguage());

  const caseMatch = app.getEmergencyCases().find((item) => item.summaryId === summary.id);
  emergencyLink.href = caseMatch ? `emergency.html?caseId=${encodeURIComponent(caseMatch.id)}` : "emergency.html";

  const clinics = summary.clinicOptions || app.getRelevantClinics(summary.ownerContext?.preferredClinic, 3);
  const dog = summary.dogProfile;
  sheet.innerHTML = `
    <div class="summary-block">
      <span class="page-pill ${summary.severity === "high" ? "chip-high" : summary.severity === "medium" ? "chip-medium" : "chip-low"}">${summary.severity.toUpperCase()}</span>
      <h2>${dog?.dogName || (app.currentLanguage() === "hi" ? "अनाम डॉग प्रोफाइल" : "Unnamed Dog Profile")}</h2>
      <p class="page-muted">${dog ? `${dog.breed || ""} ${dog.age !== "" ? `• ${dog.age} yr` : ""} ${dog.sex ? `• ${dog.sex}` : ""}` : (app.currentLanguage() === "hi" ? "कोई पासपोर्ट नहीं" : "No passport attached")}</p>
    </div>
    <div class="summary-block"><h3>${app.currentLanguage() === "hi" ? "रिपोर्ट किए गए लक्षण" : "Symptoms reported"}</h3><p>${summary.symptomText}</p></div>
    <div class="summary-block"><h3>${app.currentLanguage() === "hi" ? "संभावित चिंता" : "Possible concern"}</h3><p>${summary.aiSections?.possibleConcern || summary.possibleConcern}</p></div>
    <div class="summary-block"><h3>${app.currentLanguage() === "hi" ? "तुरंत सुझाया गया एक्शन" : "Immediate recommended action"}</h3><p>${summary.aiSections?.recommendedAction || summary.recommendedAction}</p></div>
    <div class="detail-list">
      <div class="detail-row"><span>${app.currentLanguage() === "hi" ? "एलर्जी / दवाएं" : "Allergies / Medications"}</span><strong>${summary.allergiesMedications || (app.currentLanguage() === "hi" ? "नहीं दर्ज" : "Not provided")}</strong></div>
      <div class="detail-row"><span>${app.currentLanguage() === "hi" ? "टीकाकरण संदर्भ" : "Vaccination context"}</span><strong>${summary.vaccinationContext || (app.currentLanguage() === "hi" ? "नहीं दर्ज" : "Not provided")}</strong></div>
      <div class="detail-row"><span>${app.currentLanguage() === "hi" ? "ओनर संदर्भ" : "Owner context"}</span><strong>${summary.aiSections?.ownerContextNote || (app.currentLanguage() === "hi" ? "नहीं दर्ज" : "Not provided")}</strong></div>
      <div class="detail-row"><span>${app.currentLanguage() === "hi" ? "अब तक किए गए एक्शन" : "Immediate actions taken"}</span><strong>${summary.aiSections?.immediateActionsTaken || (app.currentLanguage() === "hi" ? "रिपोर्ट नहीं किया गया" : "Not reported")}</strong></div>
    </div>
    <div class="summary-block"><h3>${app.currentLanguage() === "hi" ? "पास के क्लिनिक विकल्प" : "Nearby clinic options"}</h3><div class="clinic-stack">${clinics.map((clinic) => `<div class="rapid-clinic-card"><strong>${clinic.name}</strong><p class="page-muted">${clinic.address}</p><div class="rapid-contact-actions"><a class="btn btn-ghost" href="tel:${clinic.phone}">${app.currentLanguage() === "hi" ? "कॉल" : "Call"}</a><a class="btn btn-ghost" target="_blank" rel="noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${clinic.lat},${clinic.lng}">${app.currentLanguage() === "hi" ? "दिशा-निर्देश" : "Directions"}</a></div></div>`).join("")}</div></div>`;

  const textSummary = [
    `Dog: ${dog?.dogName || "Not provided"}`,
    `Timestamp: ${app.formatDateTime(summary.createdAt, "en")}`,
    `Severity: ${summary.severity}`,
    `Symptoms: ${summary.symptomText}`,
    `Possible concern: ${summary.aiSections?.possibleConcern || summary.possibleConcern}`,
    `Recommended action: ${summary.aiSections?.recommendedAction || summary.recommendedAction}`,
    `Allergies / medications: ${summary.allergiesMedications || "Not provided"}`,
    `Vaccination context: ${summary.vaccinationContext || "Not provided"}`,
  ].join("\n");

  document.getElementById("copySummaryBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(textSummary);
  });
  document.getElementById("printSummaryBtn").addEventListener("click", () => window.print());

  history.innerHTML = app.getSummaryHistory().map((item) => `<a class="history-item" href="handoff.html?summaryId=${encodeURIComponent(item.id)}"><strong>${item.dogProfile?.dogName || "Dog"}</strong><p class="page-muted">${app.formatDateTime(item.createdAt, app.currentLanguage())}</p><span class="page-pill ${item.severity === "high" ? "chip-high" : item.severity === "medium" ? "chip-medium" : "chip-low"}">${item.severity.toUpperCase()}</span></a>`).join("");
});

document.addEventListener('fr:languagechange', () => window.location.reload());
