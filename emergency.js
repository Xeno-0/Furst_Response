document.addEventListener("DOMContentLoaded", async () => {
  const app = window.FurstResponseApp;
  if (!app) return;

  const params = new URLSearchParams(window.location.search);
  let emergencyCase = params.get("caseId") ? app.getEmergencyCaseById(params.get("caseId")) : app.getLatestEmergencyCase();
  const emptyState = document.getElementById("emergencyEmptyState");
  const contacts = document.getElementById("emergencyContacts");
  const severityChip = document.getElementById("emergencySeverity");
  const timestamp = document.getElementById("emergencyTimestamp");
  const meta = document.getElementById("emergencyMeta");
  const handoffLink = document.getElementById("handoffLink");

  if (!emergencyCase) {
    const latestDiagnosis = app.getLatestDiagnosis();
    if (latestDiagnosis && ["medium", "high"].includes(latestDiagnosis.severity)) {
      emergencyCase = app.saveEmergencyCase(
        app.buildEmergencyCase({
          symptomText: latestDiagnosis.symptomText,
          diagnosisResponse: latestDiagnosis.diagnosisResponse,
          severity: latestDiagnosis.severity,
          timestamp: latestDiagnosis.timestamp,
          passportSnapshot: latestDiagnosis.passportSnapshot,
          summaryId: latestDiagnosis.summaryId,
        })
      );
    }
  }

  if (!emergencyCase) {
    emptyState.hidden = false;
    document.querySelectorAll(".page-card, .guidance-block").forEach((node) => { node.hidden = true; });
    return;
  }

  const summary = emergencyCase.summaryId ? app.getSummaryById(emergencyCase.summaryId) : app.saveSummary(app.buildSummaryObject({
    symptomText: emergencyCase.symptomText,
    diagnosisResponse: emergencyCase.diagnosisResponse,
    severity: emergencyCase.severity,
    timestamp: emergencyCase.createdAt,
    passportSnapshot: emergencyCase.dogProfile,
  }));

  if (!emergencyCase.summaryId) {
    emergencyCase.summaryId = summary.id;
    app.saveEmergencyCase(emergencyCase);
  }
  handoffLink.href = `handoff.html?summaryId=${encodeURIComponent(summary.id)}`;

  severityChip.textContent = app.severityLabel(emergencyCase.severity);
  severityChip.className = `page-pill ${emergencyCase.severity === "high" ? "chip-high" : "chip-medium"}`;
  timestamp.textContent = app.formatDateTime(emergencyCase.createdAt, app.currentLanguage());

  const profile = emergencyCase.dogProfile;
  meta.innerHTML = `
    <div class="detail-row"><span>${app.currentLanguage() === "hi" ? "रिपोर्ट किए गए लक्षण" : "Reported Symptoms"}</span><strong>${emergencyCase.symptomText}</strong></div>
    <div class="detail-row"><span>${app.currentLanguage() === "hi" ? "AI आकलन" : "AI Assessment"}</span><strong>${emergencyCase.diagnosisResponse}</strong></div>
    <div class="detail-row"><span>${app.currentLanguage() === "hi" ? "डॉग प्रोफाइल" : "Dog Profile"}</span><strong>${profile ? `${profile.dogName || "Dog"} • ${profile.breed || ""}` : (app.currentLanguage() === "hi" ? "कोई पासपोर्ट नहीं" : "No passport yet")}</strong></div>`;

  const coordinates = await app.getCurrentPosition();
  const clinics = app.getRelevantClinics(profile?.preferredClinic, 3, coordinates);
  contacts.innerHTML = clinics.map((clinic) => `
    <div class="rapid-clinic-card">
      <h3>${clinic.name}</h3>
      <p class="page-muted">${clinic.address}</p>
      ${clinic.distanceKm ? `<p class="page-muted">${clinic.distanceKm.toFixed(1)} km away</p>` : ""}
      <div class="rapid-contact-actions">
        <a class="btn" href="tel:${clinic.phone}">${app.currentLanguage() === "hi" ? "कॉल करें" : "Call"}</a>
        <a class="btn btn-ghost" target="_blank" rel="noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${clinic.lat},${clinic.lng}">${app.currentLanguage() === "hi" ? "दिशा-निर्देश" : "Get Directions"}</a>
      </div>
    </div>`).join("");

  if (!emergencyCase.guidance) {
    emergencyCase.guidance = await app.generateEmergencyGuidance(emergencyCase);
    app.saveEmergencyCase(emergencyCase);
  }

  document.getElementById("possibleIssue").textContent = emergencyCase.guidance.possibleIssue;
  document.getElementById("urgencyLevel").textContent = emergencyCase.guidance.urgencyLevel;
  document.getElementById("leaveForVet").textContent = emergencyCase.guidance.leaveForVet;
  document.getElementById("doNowList").innerHTML = emergencyCase.guidance.whatToDoRightNow.map((item) => `<p>${item}</p>`).join("");
  document.getElementById("avoidList").innerHTML = emergencyCase.guidance.whatNotToDo.map((item) => `<p>${item}</p>`).join("");
});

document.addEventListener('fr:languagechange', () => window.location.reload());
