/**
 * Curated Wellness Knowledge Base Guidelines (RAG Database)
 */
export const knowledgeBaseArticles = [
  {
    id: 'kb-sleep-hygiene',
    title: 'Circadian Rhythm Alignment & Sleep Hygiene Protocols',
    category: 'Sleep',
    tags: ['sleep', 'energy', 'recovery', 'mood'],
    evidence: 'Consistent wake-up times and restricting high-lux blue light exposure 60 minutes before bedtime supports natural melatonin synthesis and restorative deep sleep cycles.',
    guidelines: [
      'Target 7.5 to 8.5 hours of uninterrupted sleep nightly.',
      'Maintain a consistent wake time within a 30-minute window every day.',
      'Limit caffeine consumption after 2:00 PM to prevent adenosine receptor blockage.'
    ]
  },
  {
    id: 'kb-energy-fueling',
    title: 'Macronutrient Timing & Zone 2 Training Fueling',
    category: 'Nutrition',
    tags: ['nutrition', 'calories', 'activity', 'fatigue'],
    evidence: 'Adequate carbohydrate replenishment post-exercise preserves muscle glycogen, prevents hormonal fatigue, and maintains consistent daytime energy scores.',
    guidelines: [
      'Ensure daily caloric intake meets baseline energy output (minimum 1,800-2,200 kcal for active adults).',
      'Target 1.6g to 2.2g of protein per kg body weight to support lean mass synthesis.',
      'Consume complex carbohydrates within 2 hours post-workout to optimize glycogen replenishment.'
    ]
  },
  {
    id: 'kb-active-recovery',
    title: 'Active Recovery & Work Capacity Management',
    category: 'Activity',
    tags: ['activity', 'workout', 'recovery', 'fatigue'],
    evidence: 'Balancing high-intensity training with low-intensity Zone 2 cardio (such as 30-45 mins brisk walking) improves mitochondrial density without triggering central nervous system overtraining.',
    guidelines: [
      'Aim for 150 to 300 minutes of moderate physical activity per week.',
      'Schedule at least 1-2 dedicated low-intensity active recovery days weekly.',
      'Hydrate with electrolytes on days with high physical activity or warm weather.'
    ]
  },
  {
    id: 'kb-weight-energy-balance',
    title: 'Sustainable Energy Balance & Gradual Body Recomposition',
    category: 'Weight',
    tags: ['weight', 'calories', 'nutrition'],
    evidence: 'A moderate energy deficit of 300-500 kcal daily produces sustainable body fat reduction (0.5 kg/week) while protecting resting metabolic rate.',
    guidelines: [
      'Avoid severe caloric deficits below 1,200 kcal daily to protect thyroid function.',
      'Pair weight loss goals with resistance training to preserve lean tissue.',
      'Monitor 7-day rolling weight averages rather than daily scale fluctuations.'
    ]
  }
];
