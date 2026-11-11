const express = require('express');
const router = express.Router();
const UserRequirementFilesController = require('../controllers/UserRequirementFilesController');

// DELETE /api/requirements/:requirementid/file/:userid
router.delete('/api/requirements/:requirementid/file/:userid', UserRequirementFilesController.deleteUserRequirementFile);

module.exports = router;
