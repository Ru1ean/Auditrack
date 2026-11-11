const db = require('../db');

// Save proof document info to office_proof_document table (requirementid IS NULL for proof documents, not requirement files)
async function saveOfficeProofDocument(officeid, filename, originalName, filepath = null) {
  // First, delete old proof documents for this office (where requirementid IS NULL to only delete proof documents, not requirement files)
  await db.query(
    `DELETE FROM officeproofdocuments WHERE officeid = ? AND requirementid IS NULL`,
    [officeid]
  );
  
  // Ensure filepath is always provided - it should be the relative path from uploads/
  const finalFilePath = filepath || filename;
  
  console.log('Saving proof document to database - officeid:', officeid, 'File path:', finalFilePath);
  
  // Insert new proof document record (requirementid is NULL for proof documents)
  await db.query(
    `INSERT INTO officeproofdocuments (officeid, requirementid, filename, filepath, uploadedat) VALUES (?, NULL, ?, ?, NOW())`,
    [officeid, filename, finalFilePath]
  );
  
  console.log('Proof document saved to database successfully');
}

module.exports = { saveOfficeProofDocument };