const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function callOcrService({ name, base64 }) {
  const serviceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
  try {
    const res = await axios.post(`${serviceUrl}/verify-aadhaar`, { name, base64 });
    return res.data;
  } catch (err) {
    console.error('[OCR SERVICE] failed', err.message || err);
    return null;
  }
}

async function readUploadedFile(aadhaarUrl) {
  if (!aadhaarUrl) return null;
  const uploadsPrefix = '/uploads/';
  if (!aadhaarUrl.startsWith(uploadsPrefix)) return null;
  const uploadPath = path.join(__dirname, '../uploads', aadhaarUrl.slice(uploadsPrefix.length));
  if (!fs.existsSync(uploadPath)) return null;
  const fileBuffer = fs.readFileSync(uploadPath);
  const extension = path.extname(uploadPath).slice(1).toLowerCase();
  const contentType = extension === 'pdf' ? 'application/pdf' : `image/${extension === 'jpg' ? 'jpeg' : extension}`;
  return {
    name: path.basename(uploadPath),
    base64: `data:${contentType};base64,${fileBuffer.toString('base64')}`
  };
}

function normalizeAadhaar(value) {
  if (!value) return '';
  return value.replace(/\D/g, '').trim();
}

function computeVerification(entered, ocr, confidence) {
  const normalizedEntered = normalizeAadhaar(entered);
  const normalizedOcr = normalizeAadhaar(ocr);
  if (!normalizedOcr) {
    return {
      verificationStatus: 'pending_manual_review',
      verificationMessage: 'Unable to verify document automatically.'
    };
  }
  if (confidence < 80) {
    return {
      verificationStatus: 'pending_manual_review',
      verificationMessage: 'OCR confidence too low for automatic verification.'
    };
  }
  if (normalizedEntered && normalizedEntered === normalizedOcr) {
    return {
      verificationStatus: 'auto_verified',
      verificationMessage: 'Aadhaar successfully verified.'
    };
  }
  return {
    verificationStatus: 'pending_manual_review',
    verificationMessage: 'Entered Aadhaar does not match uploaded document.'
  };
}

module.exports = {
  callOcrService,
  readUploadedFile,
  normalizeAadhaar,
  computeVerification
};
