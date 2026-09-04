const { Case, Document } = require('../models');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants/statusCodes');
const { ROLES } = require('../constants/roles');
const { decryptDocumentFields } = require('../utils/crypto');
const config = require('../config/env');
const logger = require('../config/logger');
const vectorService = require('./vector.service');

// Common Indian / legal honorifics and prefixes to strip for normalization
const HONORIFICS_REGEX = /^(shri|smt|mr|mrs|ms|dr|adv|advocate|insp|inspector|si|sub-inspector|asi|constable|officer|sh\.)\s+/i;

/**
 * Robust date parser for extracted document dates
 * Returns { valid: boolean, parsedDate: Date | null, isUncertain: boolean }
 */
function parseExtractedDate(dateVal, confidence = 1.0) {
  if (!dateVal) {
    return { valid: false, parsedDate: null, isUncertain: true, raw: null };
  }

  const str = String(dateVal).trim();
  if (!str || str.toLowerCase() === 'unknown' || str.toLowerCase() === 'unspecified' || str.toLowerCase() === 'n/a') {
    return { valid: false, parsedDate: null, isUncertain: true, raw: str };
  }

  // Check low confidence threshold
  if (confidence < 0.70) {
    return { valid: false, parsedDate: null, isUncertain: true, raw: str };
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY formats commonly found in Indian legal documents
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1; // 0-indexed
    const year = parseInt(ddmmyyyyMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    if (!isNaN(d.getTime()) && year > 1900 && year < 2100) {
      return { valid: true, parsedDate: d, isUncertain: false, raw: str };
    }
  }

  // Standard Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
    return { valid: true, parsedDate: parsed, isUncertain: false, raw: str };
  }

  // Unparseable date format -> mark uncertain rather than inventing
  return { valid: false, parsedDate: null, isUncertain: true, raw: str };
}

/**
 * Clean and normalize entity strings
 */
function normalizeEntityName(name) {
  if (!name || typeof name !== 'string') return '';
  let cleaned = name.trim().replace(HONORIFICS_REGEX, '').trim();
  // Remove multiple whitespace and non-standard punctuation
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned;
}

function getCanonicalKey(name) {
  return normalizeEntityName(name).toLowerCase();
}

class IntelligenceService {
  /**
   * Verify case access clearance for user
   */
  async verifyCaseAccess(caseId, user) {
    const caseItem = await Case.findById(caseId).lean();
    if (!caseItem) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Target case file not found', ERROR_CODES.CASE_NOT_FOUND);
    }

    if (user.role === ROLES.OFFICER) {
      const isLead = caseItem.leadOfficer?.toString() === user.id.toString();
      const isAssigned = Array.isArray(caseItem.assignedOfficers) && caseItem.assignedOfficers.some(
        (id) => (id._id ? id._id.toString() : id.toString()) === user.id.toString()
      );

      if (!isLead && !isAssigned) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Access forbidden: You do not have clearance for this case dossier.',
          ERROR_CODES.INSUFFICIENT_PERMISSIONS
        );
      }
    }

    return caseItem;
  }

  /**
   * Fetch decrypted case documents for intelligence operations
   */
  async getDecryptedCaseDocuments(caseId) {
    const documents = await Document.find({ caseId })
      .select('title documentType caseId fileName fileSize mimeType classification ocrConfidence status extractedFields extractedText createdAt')
      .lean();

    // Decrypt field-level encrypted values server-side for intelligence processing
    return documents.map((doc) => decryptDocumentFields(doc, config.masterEncryptionKey));
  }

  /**
   * 1. CASE TIMELINE ENGINE
   * Extracts chronological events from all documents in the case
   */
  async generateCaseTimeline(caseId, user) {
    await this.verifyCaseAccess(caseId, user);
    const documents = await this.getDecryptedCaseDocuments(caseId);

    const events = [];
    let eventCounter = 1;

    for (const doc of documents) {
      const fields = doc.extractedFields || {};
      const docType = (doc.documentType || '').toUpperCase();
      const docTitle = doc.title || 'Untitled Document';

      // Helper to push an event safely
      const addEvent = ({ dateVal, confidenceVal, eventType, title, description, locationVal, rawSnippet }) => {
        const { valid, parsedDate, isUncertain, raw } = parseExtractedDate(dateVal, confidenceVal);
        const conf = typeof confidenceVal === 'number' ? confidenceVal : 0.85;

        events.push({
          id: `evt-${doc._id}-${eventCounter++}`,
          date: valid ? parsedDate.toISOString() : null,
          rawDate: raw || dateVal || null,
          formattedDate: valid ? parsedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Uncertain Date',
          eventType,
          title,
          description: description || title,
          sourceDocumentId: doc._id,
          sourceDocumentTitle: docTitle,
          sourceDocumentType: doc.documentType,
          confidence: Math.round(conf * 100) / 100,
          extractedBy: doc.status === 'verified' ? 'human_verified' : 'ai_extraction',
          isUncertain,
          location: locationVal || null,
          snippet: rawSnippet || null,
        });
      };

      // 1. FIR events
      if (docType === 'FIR' || fields.firNumber) {
        if (fields.incidentDate?.value) {
          addEvent({
            dateVal: fields.incidentDate.value,
            confidenceVal: fields.incidentDate.confidence,
            eventType: 'incident_occurred',
            title: 'Alleged Incident Occurred',
            description: `Incident reported at ${fields.incidentLocation?.value || 'stated location'} under sections ${fields.sections?.value || 'relevant legal sections'}.`,
            locationVal: fields.incidentLocation?.value,
            rawSnippet: fields.incidentDate.sourceReference,
          });
        }
        if (fields.filingDate?.value || doc.createdAt) {
          addEvent({
            dateVal: fields.filingDate?.value || doc.createdAt,
            confidenceVal: fields.filingDate?.confidence || 0.95,
            eventType: 'fir_registered',
            title: `FIR Registered: ${fields.firNumber?.value || docTitle}`,
            description: `First Information Report formally logged at ${fields.policeStation?.value || 'Police Station'}. Complainant: ${fields.complainant?.value || 'Unknown'}.`,
            locationVal: fields.policeStation?.value,
          });
        }
      }

      // 2. Witness / Accused Statement events
      else if (docType === 'STATEMENT' || fields.witnessName || fields.statementDate) {
        const witness = fields.witnessName?.value || fields.person_name?.value || fields.witness?.value || 'Witness';
        addEvent({
          dateVal: fields.statementDate?.value || fields.incidentDate?.value || doc.createdAt,
          confidenceVal: fields.statementDate?.confidence || 0.85,
          eventType: 'statement_recorded',
          title: `Statement Recorded (${witness})`,
          description: `Official statement taken under CrPC provisions for ${witness}.`,
          locationVal: fields.location?.value || fields.policeStation?.value,
          rawSnippet: fields.statementDate?.sourceReference,
        });
      }

      // 3. Evidence Collection events
      else if (docType === 'EVIDENCE' || fields.evidenceIdentifier || fields.collectionDate) {
        const item = fields.evidenceIdentifier?.value || fields.description?.value || 'Material Evidence';
        addEvent({
          dateVal: fields.collectionDate?.value || doc.createdAt,
          confidenceVal: fields.collectionDate?.confidence || 0.90,
          eventType: 'evidence_collected',
          title: `Physical Evidence Collected: ${item}`,
          description: `Material evidence logged and sealed into evidence locker. Custodian: ${fields.custodian?.value || 'Investigating Team'}.`,
          locationVal: fields.location?.value,
          rawSnippet: fields.collectionDate?.sourceReference,
        });
      }

      // 4. Forensic Report events
      else if (docType === 'FORENSIC_REPORT' || fields.reportNumber || fields.examinationDate) {
        const lab = fields.laboratory?.value || 'Central Forensic Science Laboratory (CFSL)';
        addEvent({
          dateVal: fields.examinationDate?.value || doc.createdAt,
          confidenceVal: fields.examinationDate?.confidence || 0.92,
          eventType: 'forensic_examination',
          title: `Forensic Examination Completed (${fields.reportNumber?.value || 'Lab Report'})`,
          description: `Scientific analysis and ballistics/chemical report concluded at ${lab}. Findings: ${fields.findings?.value || 'Documented in report'}.`,
          locationVal: lab,
          rawSnippet: fields.examinationDate?.sourceReference,
        });
      }

      // 5. Chargesheet events
      else if (docType === 'CHARGESHEET' || fields.filingDate) {
        addEvent({
          dateVal: fields.filingDate?.value || doc.createdAt,
          confidenceVal: fields.filingDate?.confidence || 0.95,
          eventType: 'chargesheet_filed',
          title: 'Final Police Report / Chargesheet Filed',
          description: `Chargesheet submitted before Judicial Magistrate against ${fields.accused?.value || 'accused persons'}.`,
          rawSnippet: fields.filingDate?.sourceReference,
        });
      }

      // 6. Generic/Other document fallback
      else if (doc.createdAt) {
        addEvent({
          dateVal: doc.createdAt,
          confidenceVal: 0.80,
          eventType: 'document_ingested',
          title: `Evidentiary Filing: ${docTitle}`,
          description: `Document categorized as ${doc.documentType} securely sealed in vault.`,
        });
      }
    }

    // Sort chronologically:
    // Certain dates sorted ascending by timestamp; uncertain events placed at the end.
    events.sort((a, b) => {
      if (a.isUncertain && !b.isUncertain) return 1;
      if (!a.isUncertain && b.isUncertain) return -1;
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    });

    return {
      caseId,
      totalEvents: events.length,
      certainEvents: events.filter((e) => !e.isUncertain),
      uncertainEvents: events.filter((e) => e.isUncertain),
      timeline: events,
    };
  }

  /**
   * 2. CROSS-DOCUMENT ENTITY LINKING ENGINE
   * Strictly case-isolated entity extractor and clusterer
   */
  async extractCaseEntities(caseId, user) {
    await this.verifyCaseAccess(caseId, user);
    const documents = await this.getDecryptedCaseDocuments(caseId);

    // Map of canonicalKey -> entity record
    const entityMap = new Map();

    const registerEntityMention = ({ rawName, category, doc, fieldName, roleHint, confidence = 0.85 }) => {
      if (!rawName || typeof rawName !== 'string') return;
      const normalized = normalizeEntityName(rawName);
      if (!normalized || normalized.length < 2) return;

      const key = `${category}:${getCanonicalKey(normalized)}`;

      if (!entityMap.has(key)) {
        entityMap.set(key, {
          id: `ent-${category}-${Math.abs(getCanonicalKey(normalized).split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0))}`,
          category,
          canonicalName: normalized,
          aliases: new Set([rawName.trim()]),
          roles: new Set(roleHint ? [roleHint] : []),
          mentionCount: 0,
          documentIds: new Set(),
          linkedDocuments: [],
          confidenceScores: [],
        });
      }

      const entity = entityMap.get(key);
      entity.aliases.add(rawName.trim());
      if (roleHint) entity.roles.add(roleHint);
      entity.mentionCount += 1;
      entity.confidenceScores.push(confidence);

      // Add document reference if not already added for this specific field
      const alreadyLinked = entity.linkedDocuments.some(
        (ld) => ld.documentId.toString() === doc._id.toString() && ld.field === fieldName
      );

      if (!alreadyLinked) {
        entity.documentIds.add(doc._id.toString());
        entity.linkedDocuments.push({
          documentId: doc._id,
          documentTitle: doc.title,
          documentType: doc.documentType,
          field: fieldName,
          extractedValue: rawName.trim(),
          snippet: doc.extractedText ? doc.extractedText.substring(0, 180) + '...' : `Extracted as ${fieldName} in ${doc.title}`,
        });
      }
    };

    // Extract entities from all documents in the case
    for (const doc of documents) {
      const fields = doc.extractedFields || {};

      // Helper to process field list or string
      const processField = (fieldObj, category, fieldName, roleHint) => {
        if (!fieldObj || !fieldObj.value) return;
        const conf = typeof fieldObj.confidence === 'number' ? fieldObj.confidence : 0.85;

        if (Array.isArray(fieldObj.value)) {
          fieldObj.value.forEach((v) => registerEntityMention({ rawName: v, category, doc, fieldName, roleHint, confidence: conf }));
        } else if (typeof fieldObj.value === 'string') {
          // Split by comma or semicolon if multiple values are listed
          const parts = fieldObj.value.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
          parts.forEach((part) => registerEntityMention({ rawName: part, category, doc, fieldName, roleHint, confidence: conf }));
        }
      };

      // 1. PERSON ENTITIES
      processField(fields.complainant, 'person', 'complainant', 'Complainant');
      processField(fields.complainant_name, 'person', 'complainant', 'Complainant');
      processField(fields.accused, 'person', 'accused', 'Accused / Suspect');
      processField(fields.accused_name, 'person', 'accused', 'Accused / Suspect');
      processField(fields.witness, 'person', 'witness', 'Witness');
      processField(fields.witness_name, 'person', 'witness', 'Witness');
      processField(fields.witnessName, 'person', 'witness', 'Witness');
      processField(fields.person_name, 'person', 'person_name', 'Person of Interest');
      processField(fields.investigatingOfficer, 'person', 'investigatingOfficer', 'Investigating Officer');
      processField(fields.custodian, 'person', 'custodian', 'Evidence Custodian');

      // 2. LOCATION ENTITIES
      processField(fields.incidentLocation, 'location', 'incidentLocation', 'Crime Scene');
      processField(fields.location, 'location', 'location', 'Location Reference');
      processField(fields.address, 'location', 'address', 'Address');
      processField(fields.policeStation, 'organization', 'policeStation', 'Jurisdiction / Station');

      // 3. ORGANIZATION ENTITIES
      processField(fields.laboratory, 'organization', 'laboratory', 'Forensic Laboratory');
      processField(fields.organization, 'organization', 'organization', 'Entity / Organization');

      // 4. EVIDENCE IDENTIFIER ENTITIES
      processField(fields.evidenceIdentifier, 'evidence_identifier', 'evidenceIdentifier', 'Physical Evidence ID');
      processField(fields.firNumber, 'evidence_identifier', 'firNumber', 'FIR Reference');
      processField(fields.reportNumber, 'evidence_identifier', 'reportNumber', 'Forensic Report ID');
      processField(fields.referencedEvidence, 'evidence_identifier', 'referencedEvidence', 'Referenced Evidence');
    }

    // Convert map to formatted entity list
    const entities = Array.from(entityMap.values()).map((ent) => {
      const distinctDocs = ent.documentIds.size;
      const avgConfidence = ent.confidenceScores.reduce((a, b) => a + b, 0) / (ent.confidenceScores.length || 1);
      
      // Multi-document recurring entities receive higher matching confidence
      let recurrenceBoost = distinctDocs > 1 ? 0.08 : 0;
      const finalConfidence = Math.min(0.99, Math.round((avgConfidence + recurrenceBoost) * 100) / 100);

      return {
        id: ent.id,
        category: ent.category,
        canonicalName: ent.canonicalName,
        aliases: Array.from(ent.aliases),
        roles: Array.from(ent.roles),
        primaryRole: Array.from(ent.roles)[0] || 'Entity',
        mentionCount: ent.mentionCount,
        distinctDocumentCount: distinctDocs,
        confidence: finalConfidence,
        isMultiDocument: distinctDocs > 1,
        linkedDocuments: ent.linkedDocuments,
      };
    });

    // Sort by recurring importance (multi-document entities first, then mention count)
    entities.sort((a, b) => {
      if (a.distinctDocumentCount !== b.distinctDocumentCount) {
        return b.distinctDocumentCount - a.distinctDocumentCount;
      }
      return b.mentionCount - a.mentionCount;
    });

    return {
      caseId,
      totalEntities: entities.length,
      multiDocumentEntitiesCount: entities.filter((e) => e.isMultiDocument).length,
      entities,
    };
  }

  /**
   * 3. CASE PROFILE EXTRACTOR
   * Extracts deterministic representation (entities, locations, legal sections, vectors)
   */
  async buildCaseProfile(caseId) {
    const caseDoc = await Case.findById(caseId).lean();
    if (!caseDoc) return null;

    const documents = await this.getDecryptedCaseDocuments(caseId);

    const personEntities = new Set();
    const orgEntities = new Set();
    const locationEntities = new Set();
    const legalSections = new Set();
    const embeddingVectors = [];

    // Jurisdiction as a baseline location signal
    if (caseDoc.jurisdiction) {
      locationEntities.add(getCanonicalKey(caseDoc.jurisdiction));
    }

    for (const doc of documents) {
      const fields = doc.extractedFields || {};

      // Embeddings
      if (Array.isArray(doc.embeddingVector) && doc.embeddingVector.length > 0) {
        embeddingVectors.push(doc.embeddingVector);
      }

      // Person entities
      const personFields = [
        fields.accused,
        fields.accusedName,
        fields.complainant,
        fields.complainantName,
        fields.witness,
        fields.witnessName,
        fields.person_name,
        fields.personName,
      ];
      for (const pf of personFields) {
        const val = pf?.value;
        if (typeof val === 'string' && val.trim().length > 2) {
          const norm = normalizeEntityName(val);
          if (norm.length > 2 && norm.toLowerCase() !== 'unknown' && !norm.toLowerCase().includes('not specified')) {
            personEntities.add(getCanonicalKey(norm));
          }
        }
      }

      // Organization entities
      const orgFields = [fields.organization, fields.laboratory, fields.bank];
      for (const of_ of orgFields) {
        const val = of_?.value;
        if (typeof val === 'string' && val.trim().length > 2) {
          const norm = normalizeEntityName(val);
          if (norm.length > 2) orgEntities.add(getCanonicalKey(norm));
        }
      }

      // Location entities
      const locFields = [fields.incidentLocation, fields.placeOfOccurrence, fields.policeStation, fields.location, fields.address];
      for (const lf of locFields) {
        const val = lf?.value;
        if (typeof val === 'string' && val.trim().length > 2) {
          const norm = normalizeEntityName(val);
          if (norm.length > 2) locationEntities.add(getCanonicalKey(norm));
        }
      }

      // Legal sections & acts
      const secFields = [fields.sections, fields.sections_laws, fields.act, fields.acts];
      for (const sf of secFields) {
        const val = sf?.value;
        if (typeof val === 'string' && val.trim().length > 1) {
          const tokens = val.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
          for (const t of tokens) {
            legalSections.add(t.toLowerCase().replace(/section\s*/i, 'sec '));
          }
        }
      }
    }

    return {
      caseId: caseDoc._id.toString(),
      caseNumber: caseDoc.caseNumber,
      title: caseDoc.title,
      jurisdiction: caseDoc.jurisdiction,
      status: caseDoc.status,
      personEntities,
      orgEntities,
      locationEntities,
      legalSections,
      embeddingVectors,
      documentsCount: documents.length,
    };
  }

  /**
   * 4. MULTI-SIGNAL SIMILARITY CALCULATION
   * Computes explainable, deterministic similarity score between two case profiles
   */
  calculateProfileSimilarity(profileA, profileB) {
    const reasons = [];
    const sharedEntities = [];
    const sharedLocations = [];
    const sharedSections = [];

    const getIntersection = (setA, setB) => {
      const common = [];
      for (const item of setA) {
        if (setB.has(item)) common.push(item);
      }
      return common;
    };

    // 1. Shared Entities (Persons & Organizations) - Weight 0.35
    const commonPersons = getIntersection(profileA.personEntities, profileB.personEntities);
    const commonOrgs = getIntersection(profileA.orgEntities, profileB.orgEntities);
    const allCommonEntities = [...commonPersons, ...commonOrgs];

    let entityScore = 0;
    if (allCommonEntities.length > 0) {
      const totalUnique = new Set([
        ...profileA.personEntities,
        ...profileB.personEntities,
        ...profileA.orgEntities,
        ...profileB.orgEntities,
      ]).size;
      entityScore = Math.min(1.0, (allCommonEntities.length * 2) / (totalUnique || 1));

      for (const ent of allCommonEntities) {
        sharedEntities.push(ent);
        reasons.push(`Shared entity reference: "${ent.toUpperCase()}"`);
      }
    }

    // 2. Shared Locations & Jurisdiction - Weight 0.20
    const commonLocations = getIntersection(profileA.locationEntities, profileB.locationEntities);
    let locationScore = 0;
    if (commonLocations.length > 0) {
      const totalLocs = new Set([...profileA.locationEntities, ...profileB.locationEntities]).size;
      locationScore = Math.min(1.0, (commonLocations.length * 2) / (totalLocs || 1));

      for (const loc of commonLocations) {
        sharedLocations.push(loc);
        reasons.push(`Shared location / jurisdiction: "${loc.toUpperCase()}"`);
      }
    }

    // 3. Shared Legal Sections & Acts - Weight 0.20
    const commonSections = getIntersection(profileA.legalSections, profileB.legalSections);
    let sectionScore = 0;
    if (commonSections.length > 0) {
      const totalSecs = new Set([...profileA.legalSections, ...profileB.legalSections]).size;
      sectionScore = Math.min(1.0, (commonSections.length * 2) / (totalSecs || 1));

      for (const sec of commonSections) {
        sharedSections.push(sec);
        reasons.push(`Matching legal statute / offence section: "${sec.toUpperCase()}"`);
      }
    }

    // 4. Semantic Embedding Proximity - Weight 0.25
    let semanticScore = 0;
    if (profileA.embeddingVectors.length > 0 && profileB.embeddingVectors.length > 0) {
      let maxSim = 0;
      for (const vA of profileA.embeddingVectors) {
        for (const vB of profileB.embeddingVectors) {
          const sim = vectorService.calculateCosineSimilarity(vA, vB);
          if (sim > maxSim) maxSim = sim;
        }
      }
      semanticScore = Math.max(0, maxSim);
      if (semanticScore >= 0.60) {
        reasons.push(`High semantic similarity across evidentiary documents (${Math.round(semanticScore * 100)}% text alignment)`);
      }
    }

    // Rebalance weights if vectors are absent in either case
    let rawScore = 0;
    if (profileA.embeddingVectors.length > 0 && profileB.embeddingVectors.length > 0) {
      rawScore = (entityScore * 0.35) + (locationScore * 0.20) + (sectionScore * 0.20) + (semanticScore * 0.25);
    } else {
      rawScore = (entityScore * 0.45) + (locationScore * 0.30) + (sectionScore * 0.25);
    }

    const similarityScore = Math.round(Math.min(1.0, Math.max(0, rawScore)) * 100) / 100;

    let confidenceLevel = 'low';
    let relationshipType = 'possible_connection';
    if (similarityScore >= 0.70) {
      confidenceLevel = 'high';
      relationshipType = 'strongly_related';
    } else if (similarityScore >= 0.45) {
      confidenceLevel = 'medium';
      relationshipType = 'potentially_related';
    }

    return {
      similarityScore,
      confidenceLevel,
      relationshipType,
      reasons,
      sharedEntities,
      sharedLocations,
      sharedSections,
    };
  }

  /**
   * 5. CASE-TO-CASE RELATIONSHIP DISCOVERY WITH STRICT RBAC
   * Identifies meaningful connections between authorized cases
   */
  async getCaseRelationships(caseId, user, threshold = 0.25) {
    // Clearance boundary check on target case
    await this.verifyCaseAccess(caseId, user);

    const targetProfile = await this.buildCaseProfile(caseId);
    if (!targetProfile) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Target case not found');
    }

    // Strict Server-Side Scope for comparison pool
    const query = { _id: { $ne: caseId } };
    if (user.role === ROLES.OFFICER) {
      const officerId = user._id ? user._id.toString() : user.id;
      query.$or = [
        { leadOfficer: officerId },
        { assignedOfficers: officerId },
      ];
    }

    const candidateCases = await Case.find(query).select('_id caseNumber title jurisdiction status').lean();
    const relationships = [];

    for (const cand of candidateCases) {
      const candProfile = await this.buildCaseProfile(cand._id);
      if (!candProfile) continue;

      const simResult = this.calculateProfileSimilarity(targetProfile, candProfile);

      // Enforce documented noise filter threshold
      if (simResult.similarityScore >= threshold && simResult.reasons.length > 0) {
        relationships.push({
          targetCaseId: candProfile.caseId,
          caseNumber: candProfile.caseNumber,
          title: candProfile.title,
          jurisdiction: candProfile.jurisdiction,
          status: candProfile.status,
          similarityScore: simResult.similarityScore,
          similarityPercentage: Math.round(simResult.similarityScore * 100),
          confidenceLevel: simResult.confidenceLevel,
          relationshipType: simResult.relationshipType,
          reasons: simResult.reasons,
          sharedEntities: simResult.sharedEntities,
          sharedLocations: simResult.sharedLocations,
          sharedSections: simResult.sharedSections,
        });
      }
    }

    relationships.sort((a, b) => b.similarityScore - a.similarityScore);

    return {
      caseId,
      totalRelatedCases: relationships.length,
      threshold,
      relationships,
    };
  }

  /**
   * 6. COMBINED CASE INTELLIGENCE
   */
  async getCaseIntelligence(caseId, user) {
    const [timelineRes, entitiesRes, relationshipsRes] = await Promise.all([
      this.generateCaseTimeline(caseId, user),
      this.extractCaseEntities(caseId, user),
      this.getCaseRelationships(caseId, user),
    ]);

    return {
      caseId,
      summary: {
        totalEvents: timelineRes.totalEvents,
        certainEventsCount: timelineRes.certainEvents.length,
        uncertainEventsCount: timelineRes.uncertainEvents.length,
        totalEntities: entitiesRes.totalEntities,
        multiDocumentEntitiesCount: entitiesRes.multiDocumentEntitiesCount,
        totalRelatedCases: relationshipsRes.totalRelatedCases,
      },
      timeline: timelineRes.timeline,
      entities: entitiesRes.entities,
      relationships: relationshipsRes.relationships,
    };
  }
}

module.exports = new IntelligenceService();
