/**
 * Comprehensive Evidence-Based Wellness Knowledge Base (RAG Database)
 * Sourced from clinical guidelines (National Sleep Foundation, ACSM, NIH PubMed, WHO)
 */
export const knowledgeBaseArticles = [
  {
    id: 'kb-sleep-hygiene',
    title: 'Circadian Rhythm Alignment & Sleep Hygiene Protocols',
    category: 'Sleep',
    tags: ['sleep', 'energy', 'recovery', 'mood'],
    evidence: 'Clinical trials published by the National Sleep Foundation demonstrate that maintaining consistent wake-up times and restricting high-lux blue light exposure 60 minutes before bed increases deep SWS/REM sleep by 22% and optimizes morning cortisol alignment.',
    guidelines: [
      'Target 7.5 to 8.5 hours of uninterrupted sleep nightly.',
      'Maintain a consistent wake time within a 30-minute window every day including weekends.',
      'Limit caffeine consumption after 2:00 PM to prevent adenosine receptor blockage.'
    ]
  },
  {
    id: 'kb-sleep-consistency',
    title: 'Sleep Variance & Sleep Debt Accumulation',
    category: 'Sleep',
    tags: ['sleep', 'fatigue', 'mood'],
    evidence: 'NIH research reveals that high day-to-day sleep variance (>90 mins difference) induces metabolic dysregulation equivalent to a 2-hour jet lag, reducing daylight alertness and executive cognitive function.',
    guidelines: [
      'Keep sleep duration within +/- 45 minutes night-to-night.',
      'Dim artificial light 90 minutes prior to intended sleep time.',
      'Maintain bedroom ambient temperature between 18-20°C (65-68°F).'
    ]
  },
  {
    id: 'kb-energy-fueling',
    title: 'Macronutrient Timing & Zone 2 Training Fueling',
    category: 'Nutrition',
    tags: ['nutrition', 'calories', 'activity', 'fatigue'],
    evidence: 'Sports nutrition research from the ACSM confirms that adequate carbohydrate replenishment post-exercise preserves glycogen stores, reduces cortisol secretion, and maintains baseline daily energy ratings.',
    guidelines: [
      'Ensure daily caloric intake meets baseline energy output (minimum 1,800-2,200 kcal for active adults).',
      'Target 1.6g to 2.2g of protein per kg body weight to support lean mass synthesis.',
      'Consume complex carbohydrates within 2 hours post-workout to optimize glycogen replenishment.'
    ]
  },
  {
    id: 'kb-protein-synthesis',
    title: 'Dietary Protein Distribution & Muscle Mass Retention',
    category: 'Nutrition',
    tags: ['nutrition', 'protein', 'activity'],
    evidence: 'Meta-analyses in the American Journal of Clinical Nutrition establish that spreading protein evenly across 3-4 meals (25-35g per meal) maximizes muscle protein synthesis (MPS) compared to single heavy evening meals.',
    guidelines: [
      'Distribute 25-40g of high-quality protein per meal across breakfast, lunch, and dinner.',
      'Include leucine-rich foods (eggs, poultry, fish, tofu, dairy) in recovery meals.',
      'Consume 20-30g of protein within 60 minutes post-resistance exercise.'
    ]
  },
  {
    id: 'kb-active-recovery',
    title: 'Active Recovery & Work Capacity Management',
    category: 'Activity',
    tags: ['activity', 'workout', 'recovery', 'fatigue'],
    evidence: 'Journal of Applied Physiology studies show that balancing high-intensity training with low-intensity Zone 2 cardio (30-45 mins brisk walking/cycling) enhances mitochondrial vascularization without central nervous system overtraining.',
    guidelines: [
      'Aim for 150 to 300 minutes of moderate physical activity per week.',
      'Schedule at least 1-2 dedicated low-intensity active recovery days weekly.',
      'Hydrate with electrolytes on days with high physical activity or warm weather.'
    ]
  },
  {
    id: 'kb-zone2-cardio',
    title: 'Mitochondrial Health & Zone 2 Base Aerobic Training',
    category: 'Activity',
    tags: ['activity', 'cardio', 'energy'],
    evidence: 'Cardiovascular research indicates that exercising in Zone 2 heart rate (60-70% max HR) increases fat oxidation capacity, lactate clearance, and long-term resting heart rate efficiency.',
    guidelines: [
      'Maintain an exercise intensity where you can comfortably converse in full sentences.',
      'Aim for 3-4 weekly sessions of 30-45 minutes of continuous low-impact cardio.',
      'Track resting heart rate weekly to assess aerobic adaptation.'
    ]
  },
  {
    id: 'kb-weight-energy-balance',
    title: 'Sustainable Energy Balance & Gradual Body Recomposition',
    category: 'Weight',
    tags: ['weight', 'calories', 'nutrition'],
    evidence: 'Metabolic studies prove that a moderate energy deficit of 300-500 kcal daily produces sustainable body fat reduction (0.5 kg/week) while protecting thyroid activity and resting metabolic rate.',
    guidelines: [
      'Avoid severe caloric deficits below 1,200 kcal daily to protect thyroid function.',
      'Pair weight loss goals with resistance training to preserve lean tissue.',
      'Monitor 7-day rolling weight averages rather than daily scale fluctuations.'
    ]
  },
  {
    id: 'kb-hydration-performance',
    title: 'Fluid Balance & Cognitive Electrolyte Hydration',
    category: 'Hydration',
    tags: ['hydration', 'energy', 'headache', 'fatigue'],
    evidence: 'A 2% drop in body water volume triggers measurable decreases in cognitive concentration, working memory, and physical power output by up to 15%.',
    guidelines: [
      'Drink 30-35 mL of water per kg of body weight daily (approx 2.5-3.5 liters).',
      'Consume 500 mL of water immediately upon waking to offset overnight respiration loss.',
      'Add sodium/potassium electrolyte balance during workouts exceeding 60 minutes.'
    ]
  },
  {
    id: 'kb-stress-cortisol-management',
    title: 'Autonomic Nervous System Regulation & Stress Reduction',
    category: 'Stress & Mood',
    tags: ['mood', 'energy', 'stress', 'sleep'],
    evidence: 'Psychoneuroendocrinology research shows that physiological sighing (double inhalation followed by extended exhalation) rapidly activates vagal nerve parasympathetic tone, reducing heart rate in real time.',
    guidelines: [
      'Practice 5 minutes of physiological sighing or box breathing when feeling acute stress.',
      'Incorporate 10-15 minutes of outdoor daylight exposure prior to 11:00 AM.',
      'Establish a non-work wind-down buffer 2 hours prior to bed.'
    ]
  },
  {
    id: 'kb-stimulant-caffeine-taper',
    title: 'Adenosine Receptor Blockage & Caffeine Tapering',
    category: 'Sleep',
    tags: ['sleep', 'caffeine', 'energy'],
    evidence: 'Caffeine has a half-life of 5-7 hours. Consuming 200mg of caffeine 6 hours before bed reduces sleep duration by over 1 hour and reduces slow-wave delta sleep quality by 30%.',
    guidelines: [
      'Set a strict caffeine cutoff 8-10 hours before your target sleep time.',
      'Limit daily caffeine intake to under 400mg total.',
      'Substitute afternoon coffee with herbal tea or cold water.'
    ]
  }
];

/**
 * RAG Helper: Search Knowledge Base articles by matching query tags or category.
 */
export function searchKnowledgeBase(queryTags = [], category = null) {
  const normalizedTags = queryTags.map(t => t.toLowerCase());

  return knowledgeBaseArticles.filter(article => {
    const categoryMatch = category ? article.category.toLowerCase() === category.toLowerCase() : true;
    const tagMatch = normalizedTags.length > 0 
      ? article.tags.some(tag => normalizedTags.includes(tag.toLowerCase()))
      : true;

    return categoryMatch && tagMatch;
  });
}
