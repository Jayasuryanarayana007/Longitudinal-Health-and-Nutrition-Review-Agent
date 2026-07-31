/**
 * Medical Safety Boundary & Refusal Filter
 * Scans text inputs for clinical diagnosis, prescription advice, medication dosages, or treatment queries.
 */
const CLINICAL_KEYWORDS = [
  'diagnose', 'diagnosis', 'prescribe', 'prescription', 'medication', 'medicine',
  'antibiotic', 'antibiotics', 'dosage', 'drug', 'pharmaceutical', 'cure',
  'treatment for', 'treat my', 'insulin', 'steroid', 'painkiller', 'blood pressure med',
  'disease', 'symptom treatment', 'medical advice', 'doctor recommendation'
];

export function checkMedicalSafety(text) {
  if (!text || typeof text !== 'string') {
    return { isClinicalQuery: false, disclaimer: null, matchedTerms: [] };
  }

  const normalized = text.toLowerCase();
  const matchedTerms = CLINICAL_KEYWORDS.filter(kw => normalized.includes(kw));

  if (matchedTerms.length > 0) {
    const disclaimer = '⚠️ Medical Disclaimer: I am an AI Wellness & Lifestyle Review Agent, not a licensed medical professional. I cannot diagnose clinical conditions, prescribe medications, or recommend treatment protocols. Please consult a qualified physician or healthcare professional for medical concerns.';
    return {
      isClinicalQuery: true,
      disclaimer,
      matchedTerms
    };
  }

  return {
    isClinicalQuery: false,
    disclaimer: null,
    matchedTerms: []
  };
}
