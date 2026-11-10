const express = require('express');
const router = express.Router();
const OfficeTypesController = require('../controllers/OfficesTypesController.js');
const { auth, requireAdmin } = require('../middleware/auth');

// GET all office types (authenticated)
router.get("/", auth, OfficeTypesController.getAll);
router.get("/:id", auth, OfficeTypesController.getById);
router.post("/", auth, requireAdmin, OfficeTypesController.create);
router.put("/:id", auth, requireAdmin, OfficeTypesController.update);
router.delete("/:id", auth, requireAdmin, OfficeTypesController.delete);

module.exports = router;