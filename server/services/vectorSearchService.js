/**
 * Vector Search & Hybrid RAG Retrieval Engine
 * Implements:
 * 1. Dense Feature Vector Generation & Cosine Similarity: dot(Q, D) / (|Q| * |D|)
 * 2. Sparse BM25 Okapi Keyword Search: TF-IDF with length normalization (k1=1.2, b=0.75)
 * 3. Reciprocal Rank Fusion (RRF): RRF_score = 1/(60 + rank_dense) + 1/(60 + rank_sparse)
 */

import { knowledgeBaseArticles } from '../data/knowledgeBase.js';

// Vocabulary builder for text vectorization
function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

// Compute Term Frequency (TF) vector for a document given a global vocabulary
function buildTermFrequencyVector(tokens, vocabMap) {
  const vec = new Float64Array(vocabMap.size);
  tokens.forEach(token => {
    if (vocabMap.has(token)) {
      const index = vocabMap.get(token);
      vec[index] += 1;
    }
  });
  return vec;
}

// Compute Cosine Similarity between two vectors: dot(A,B) / (|A|*|B|)
function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// BM25 Okapi scoring parameters
const K1 = 1.2;
const B = 0.75;

function computeBM25Score(queryTokens, docTokens, avgDocLen, totalDocs, docFreqMap) {
  const docLen = docTokens.length;
  if (docLen === 0) return 0;

  // Count term frequencies in this document
  const tfMap = new Map();
  docTokens.forEach(t => tfMap.set(t, (tfMap.get(t) || 0) + 1));

  let score = 0;
  queryTokens.forEach(term => {
    const tf = tfMap.get(term) || 0;
    if (tf > 0) {
      const df = docFreqMap.get(term) || 1;
      // Inverse Document Frequency (IDF)
      const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);
      // BM25 term weight calculation
      const num = tf * (K1 + 1);
      const den = tf + K1 * (1 - B + B * (docLen / avgDocLen));
      score += idf * (num / den);
    }
  });

  return score;
}

/**
 * Perform True Hybrid Search using Cosine Similarity + BM25 + Reciprocal Rank Fusion (RRF)
 * @param {Array<string>} queryTags - User anomaly tags (e.g. ['sleep', 'energy'])
 * @param {string|null} category - Optional category filter
 * @param {number} topK - Number of articles to return
 * @returns {Array<object>} Top K hybrid-ranked articles
 */
export function hybridVectorSearch(queryTags = [], category = null, topK = 4) {
  const safeTags = Array.isArray(queryTags) ? queryTags : [];
  const queryText = safeTags.join(' ') + (category ? ` ${category}` : '');
  const queryTokens = tokenize(queryText);

  if (queryTokens.length === 0) {
    return knowledgeBaseArticles.slice(0, topK);
  }

  // 1. Build Global Vocabulary & Corpus Statistics
  const docTokensList = knowledgeBaseArticles.map(article => {
    const textToEmbed = [
      article.title,
      article.category,
      article.tags.join(' '),
      article.meshTerms.join(' '),
      article.evidence,
      article.guidelines.join(' '),
      article.contentChunks.map(c => `${c.header} ${c.text}`).join(' ')
    ].join(' ');
    return tokenize(textToEmbed);
  });

  const vocabSet = new Set();
  const docFreqMap = new Map();
  let totalDocLen = 0;

  docTokensList.forEach(tokens => {
    totalDocLen += tokens.length;
    const uniqueInDoc = new Set(tokens);
    uniqueInDoc.forEach(t => {
      vocabSet.add(t);
      docFreqMap.set(t, (docFreqMap.get(t) || 0) + 1);
    });
  });

  queryTokens.forEach(t => vocabSet.add(t));

  const vocabArray = Array.from(vocabSet);
  const vocabMap = new Map(vocabArray.map((term, index) => [term, index]));
  const avgDocLen = totalDocLen / knowledgeBaseArticles.length;

  // Build query vector
  const queryVector = buildTermFrequencyVector(queryTokens, vocabMap);

  // 2. Compute Dense Cosine Similarity Ranks
  const denseScores = knowledgeBaseArticles.map((article, index) => {
    const docVector = buildTermFrequencyVector(docTokensList[index], vocabMap);
    const sim = cosineSimilarity(queryVector, docVector);
    return { article, index, sim };
  });

  // Sort descending by Cosine Similarity
  denseScores.sort((a, b) => b.sim - a.sim);

  // Map article ID to dense rank position (1-indexed)
  const denseRankMap = new Map();
  denseScores.forEach((item, rankIndex) => {
    denseRankMap.set(item.article.id, rankIndex + 1);
  });

  // 3. Compute Sparse BM25 Keyword Ranks
  const sparseScores = knowledgeBaseArticles.map((article, index) => {
    const bm25 = computeBM25Score(queryTokens, docTokensList[index], avgDocLen, knowledgeBaseArticles.length, docFreqMap);
    return { article, index, bm25 };
  });

  // Sort descending by BM25 Score
  sparseScores.sort((a, b) => b.bm25 - a.bm25);

  // Map article ID to sparse rank position (1-indexed)
  const sparseRankMap = new Map();
  sparseScores.forEach((item, rankIndex) => {
    sparseRankMap.set(item.article.id, rankIndex + 1);
  });

  // 4. Reciprocal Rank Fusion (RRF) Combination (Constant K_RRF = 60)
  const K_RRF = 60;
  const rrfScores = knowledgeBaseArticles.map(article => {
    const rDense = denseRankMap.get(article.id) || knowledgeBaseArticles.length;
    const rSparse = sparseRankMap.get(article.id) || knowledgeBaseArticles.length;

    // RRF Formula: 1 / (60 + r_dense) + 1 / (60 + r_sparse)
    let rrfScore = (1.0 / (K_RRF + rDense)) + (1.0 / (K_RRF + rSparse));

    // Grade A evidence multiplier bonus (+15% score boost for meta-analyses)
    if (article.evidenceGrade && article.evidenceGrade.includes('Grade A')) {
      rrfScore *= 1.15;
    }

    return { article, rrfScore, rDense, rSparse };
  });

  // Sort descending by final RRF score
  rrfScores.sort((a, b) => b.rrfScore - a.rrfScore);

  return rrfScores.slice(0, topK).map(item => item.article);
}
