# Agentic AI Usage and Prompt Configurations

This document outlines the tools, prompt schemas, and alignment decisions implemented by **Antigravity** during the development of this project.

---

## 🛠️ MCP & Native Tools Utilized

* **`write_to_file`**: Scaffolded backend index scripts, routes handlers, React components, and styling configurations.
* **`replace_file_content` & `multi_replace_file_content`**: Implemented iterative improvements, added endpoints, and debugged code syntax blocks.
* **`run_command`**: Scaffolded client folders via `create-vite`, ran initial bootstrap NPM installations, and launched the full-stack development servers.
* **`view_file`**: Read files to verify schema attributes and examine process logs.
* **`schedule`**: Paused execution asynchronously to let local processes initialize.
* **`manage_task`**: Inspected background processes and verified execution success status.

---

## 🧠 Representative Prompt Schemas

Below are the actual prompt templates used for server-side Gemini integration:

### 1. Meal Calorie Extraction Prompt
Takes unstructured food text and returns a strict JSON object mapping ingredients:

```text
You are an AI wellness calorie extractor.
Extract the food items and estimate the calories, protein (g), carbs (g), and fats (g) from the following user meal description.
Respond ONLY with a JSON array of food items, with no markdown code fences, no extra text.
If you are highly uncertain about an item, add a flag "isAiUncertain": true inside that item.

Format:
[
  { "foodItem": "item name", "calories": 250, "protein": 10, "carbs": 30, "fats": 8, "isAiUncertain": false }
]

User Input: "${textInput}"
```

### 2. AI Weekly Review & RAG prompt
Integrates RAG guidelines from the wellness knowledge base and generates isolated summaries:

```text
You are an expert AI Wellness Reviewer.
Analyze the user's weekly health logs and draft a retrospective review.

Here is the user's factual logged stats for the last 7 days:
- Average Sleep: ${stats.avgSleep} hours (Target: ${activeGoal.targetSleepHours}h)
- Average Weight: ${stats.avgWeight} kg (Net Change: ${stats.weightChange}kg)
- Average Mood Rating: ${stats.avgMood}/10
- Average Energy Rating: ${stats.avgEnergy}/10
- Total Physical Activity: ${stats.totalActivityMins} minutes (Target: ${activeGoal.targetActivityMinutes} mins daily)
- Daily Calorie Intake: ${stats.avgCalories} kcal

Here is the Curated Wellness Guidance from our Knowledge Base. You MUST use ONLY this guidelines to justify your recommendations:
${JSON.stringify(matchedArticles)}

Respond ONLY with a JSON object, with no markdown formatting or backticks. Follow this exact format:
{
  "facts": "A bulleted list summarizing raw logs and numbers strictly logged by the user.",
  "interpretations": "A list of observations connecting sleep, energy, weight, or exercise with the retrieved wellness guidelines.",
  "retrospective": "A personal weekly summary (2-3 paragraphs) evaluating goals. The user should be able to edit this.",
  "suggestions": [
    {
      "recommendationId": "rec_1",
      "category": "Sleep | Nutrition | Activity | Mood",
      "proposal": "Actionable goal adjustment (e.g. Target sleep 7.5 hours)",
      "evidence": "Clear explanation referencing logged stats and knowledge base guidelines",
      "referencedKbArticleId": "article_id"
    }
  ]
}

Safety Rules:
- DO NOT diagnose any clinical conditions.
- DO NOT prescribe any treatment, diet, or clinical drugs.
- DO NOT present recommendations as guaranteed outcomes.
- Guide users to consult a doctor if inputs suggest severe symptoms.
```

---

## 👥 Collaboration & Delegation
No work was delegated to subagents. All requirements gathering, backend SQLite API architectures, client glassmorphic pages, custom SVG charting logic, and debugging were executed directly by **Antigravity** to keep context tightly unified, ensuring maximum structural coherence and alignment.

---

## 🐞 Mistakes Log & Resolutions

### 1. JSON Stringify Bracket Nesting
* **Symptom**: Vite dependency scanning failed during startup:
  ```text
  [PARSE_ERROR] Expected `,` or `}` but found `)` in src/components/DataLogger.jsx:163:14
  ```
* **Root Cause**: An incorrect parenthesis `)` was closing `JSON.stringify(` before the containing object `details` was closed with a curly brace `}`.
* **Resolution**: Replaced the target code block, moving the curly brace `}` to close the object, followed by the closing parenthesis and semicolon: `} });`

### 2. SQLite vs. NoSQL Debate
* **Discussion**: Evaluated NoSQL document storage models vs. SQL. Determined that because health tracking is deeply relational and numerical (requiring dates, ranges, and stats), a hybrid **SQLite relational model with native JSON fields** was the absolute best industry standard, combining SQL's time-series strength with NoSQL's flexible plan structures.

---

## 🔍 Output Verification Strategy

* **Task Log Reviews**: Inspected startup streams from nodemon to confirm:
  - SQLite database initialized and tables generated successfully.
  - Express server opened port 5000.
* **Seeding Verification**: Connected user registration triggers directly to our custom `seedData.js` utility, ensuring that local testing starts with 14 days of visual data trends.
